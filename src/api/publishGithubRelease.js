// Refer https://json-schema.org/understanding-json-schema/index.html
import {HTTP_STATUS_CODES} from "@aicore/libcommonutils";
import {getRepoDetails, getReleaseDetails, createIssue, getOrgDetails} from "../github.js";
import db from "../db.js";
import {downloader} from "../utils/downloader.js";
import {ZipUtils} from "../utils/zipUtils.js";
import {valid, lte, clean} from "semver";
import {
    FIELD_RELEASE_ID, RELEASE_DETAILS_TABLE, EXTENSION_SIZE_LIMIT_MB, BASE_URL,
    EXTENSION_DOWNLOAD_DIR, PROCESSING_TIMEOUT_MS, EXTENSIONS_DETAILS_TABLE, FIELD_EXTENSION_ID, EXTENSIONS_BUCKET
} from "../constants.js";
import fs from "fs";
import {S3} from "../s3.js";

const RELEASE_STATUS_PROCESSING = "processing";

const schema = {
    schema: {
        querystring: {
            type: 'object',
            required: ['releaseRef'],
            properties: {
                releaseRef: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 1000
                }
            }
        },
        response: {
            200: { //HTTP_STATUS_CODES.OK
                type: 'object',
                required: ['message'],
                properties: {
                    message: {type: 'string'}
                }
            }
        }
    }
};

export function getPublishGithubReleaseSchema() {
    return schema;
}

function _validateAndGetParams(releaseRef) {
    // releaseRef of the form <org>/<repo>:refs/tags/<dfg>
    let release = releaseRef.split(":");
    if(release.length !== 2){
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            error: "Expected releaseRef of the form <org>/<repo>:refs/tags/<dfg>"};
    }
    let releaseTag = release[1];
    let repoSplit = release[0].split("/");
    if(repoSplit.length !== 2 || !releaseTag.startsWith("refs/tags/") || releaseTag.split("/").length !== 3){
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            error: "Expected releaseRef of the form <org>/<repo>:refs/tags/<dfg>"};
    }
    let owner= repoSplit[0],
        repo= repoSplit[1],
        tag= releaseTag.split("/")[2];
    if(!owner || !repo || !tag){
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            error: "Expected releaseRef of the form <org>/<repo>:refs/tags/<dfg>"};
    }
    return  {
        owner,
        repo,
        tag
    };
}

async function _getReleaseInfo(release) {
    const releaseRef = `${release.owner}/${release.repo}/${release.tag}`;
    const queryObj = {};
    queryObj[FIELD_RELEASE_ID] = releaseRef;
    let existingRelease = await db.getFromIndex(RELEASE_DETAILS_TABLE, queryObj);
    if(!existingRelease.isSuccess){
        // unexpected error
        throw new Error("Error getting release details from db: " + releaseRef);
    }
    existingRelease = existingRelease.documents.length === 1 ? existingRelease.documents[0] : null;
    return existingRelease;
}

async function _validateAlreadyReleased(release) {
    let repo = await getRepoDetails(release.owner, release.repo);
    const releaseRef = `${release.owner}/${release.repo}/${release.tag}`;
    if(!repo) {
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            error: `Repo ${release.owner}/${release.repo} doesnt exist or is not accessible.`};
    }
    const existingRelease = await _getReleaseInfo(release);
    if(existingRelease?.published){
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            error: `Release ${releaseRef} already published!`};
    }
    if(existingRelease?.status === RELEASE_STATUS_PROCESSING){
        if((Date.now() - existingRelease.lastUpdatedDateUTC) > PROCESSING_TIMEOUT_MS){
            console.log(`Retrying release ${releaseRef} as process timeout exceeded.`);
        } else {
            throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
                error: `Release ${releaseRef} is already being processed. Please wait or retry after ${PROCESSING_TIMEOUT_MS/1000} Seconds`};
        }
    }
    return {
        repoDetails: repo,
        existingRelease
    };
}

/**
 *
 * @param githubReleaseTag
 * @return {Promise<{html_url: string, draft: boolean, prerelease: boolean,
 * assets: Array<{browser_download_url: string, name: string, size: number, content_type: string}>}>}
 * @private
 */
async function _validateGithubRelease(githubReleaseTag) {
    const releaseRef = `${githubReleaseTag.owner}/${githubReleaseTag.repo}/${githubReleaseTag.tag}`;
    let release = await getReleaseDetails(githubReleaseTag.owner, githubReleaseTag.repo, githubReleaseTag.tag);
    if(!release) {
        // this need not be reported in a user issue as it is unlikely to happen.
        // we call this api via github on-released action
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            updatePublishErrors: true,
            error: `Release ${releaseRef} not found in GitHub`};
    }
    return release;
}

function _validateGitHubReleaseAssets(githubReleaseDetails, issueMessages) {
    let extensionZipAsset;
    for(let asset of githubReleaseDetails.assets){
        if(asset.name === 'extension.zip'){
            extensionZipAsset = asset;
        }
    }
    if(!extensionZipAsset) {
        let userMessage = "Release does not contain required `extension.zip` file attached.";
        issueMessages.push(userMessage);
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            updatePublishErrors: true,
            error: userMessage};
    }
    if(extensionZipAsset.size > EXTENSION_SIZE_LIMIT_MB*1024*1024){
        let userMessage = `Attached \`extension.zip\` file should be smaller than ${EXTENSION_SIZE_LIMIT_MB}MB`;
        issueMessages.push(userMessage);
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            updatePublishErrors: true,
            error: userMessage};
    }
    return extensionZipAsset;
}

async function _getRegistryPkgJSON(githubReleaseTag, extensionName) {
    const queryObj = {};
    const releaseRef = `${githubReleaseTag.owner}/${githubReleaseTag.repo}/${githubReleaseTag.tag}`;
    queryObj[FIELD_EXTENSION_ID] = extensionName;
    let registryPKGJSON = await db.getFromIndex(EXTENSIONS_DETAILS_TABLE, queryObj);
    if(!registryPKGJSON.isSuccess){
        // unexpected error
        throw new Error("Error getting extensionPKG details from db: " + releaseRef);
    }
    if(registryPKGJSON.documents.length === 1){
        let existingRegistryDocumentId = registryPKGJSON.documents[0].documentId;
        delete registryPKGJSON.documents[0].documentId;
        return {
            existingRegistryDocumentId,
            registryPKGJSON: registryPKGJSON.documents[0]
        };
    }
    return {
        existingRegistryDocumentId: null,
        registryPKGJSON: null
    };
}

async function _validateExtensionPackageJson(githubReleaseTag, packageJSON, repoDetails, issueMessages) {
    const newOwner = `github:${githubReleaseTag.owner}`;
    let existingRegistryPKGVersion = null;
    let {registryPKGJSON, existingRegistryDocumentId} = await _getRegistryPkgJSON(githubReleaseTag, packageJSON.name);
    let error = "";
    if(registryPKGJSON && registryPKGJSON.owner !== newOwner) {
        let errorMsg = `Extension of the same name "${packageJSON.name}" already exists (owned by https://github.com/${registryPKGJSON.owner.split(":")[1]}). Please choose a different extension name.`;
        error = error + errorMsg;
        issueMessages.push(errorMsg);
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            updatePublishErrors: true,
            error};
    }
    if(!valid(packageJSON.version)) {
        let errorMsg = `Invalid package version "${packageJSON.version}" in zip.`;
        error = error + `\n${errorMsg}`;
        issueMessages.push(errorMsg);
    }
    packageJSON.version = clean(packageJSON.version); // '  =v1.2.3   ' ->  '1.2.3'
    if(registryPKGJSON) {
        for(let versionInfo of registryPKGJSON.versions){
            if(versionInfo.version === packageJSON.version){
                let errorMsg = `Package version "${packageJSON.version}" already published on ${versionInfo.published}. Please update version number to above ${registryPKGJSON.metadata.version}.`;
                error = error + `\n${errorMsg}`;
                issueMessages.push(errorMsg);
                break;
            }
        }
        existingRegistryPKGVersion = registryPKGJSON.metadata.version;
        if(lte(packageJSON.version, existingRegistryPKGVersion)){
            let errorMsg = `Package version should be greater than ${existingRegistryPKGVersion}, but received "${packageJSON.version}".`;
            error = error + `\n${errorMsg}`;
            issueMessages.push(errorMsg);
        }
    }
    if(error){
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            updatePublishErrors: true,
            error};
    }
    let org = await getOrgDetails(githubReleaseTag.owner);
    let ownershipVerifiedByGitHub = null;
    if(org && org.is_verified && org.blog){
        ownershipVerifiedByGitHub = [org.blog];
    }
    // now create the new registry package json
    registryPKGJSON = registryPKGJSON || {
        "versions": [],
        "totalDownloads": 0,
        "recent": {}
    };
    registryPKGJSON.metadata= packageJSON;
    registryPKGJSON.owner= `github:${githubReleaseTag.owner}`;
    registryPKGJSON.gihubStars = repoDetails.stargazers_count;
    registryPKGJSON.ownerRepo = `https://github.com/${githubReleaseTag.owner}/${githubReleaseTag.repo}`;
    registryPKGJSON.ownershipVerifiedByGitHub = ownershipVerifiedByGitHub;
    registryPKGJSON.versions.push({
        "version": clean(packageJSON.version),
        "published": new Date().toISOString(),
        "brackets": packageJSON.engines.brackets,
        "downloads": 0
    });

    return {existingRegistryPKGVersion, existingRegistryDocumentId, registryPKGJSON};
}

async function _downloadAndValidateExtensionZip(githubReleaseTag, extensionZipAsset, repoDetails, issueMessages) {
    const extensionZipPath = `${EXTENSION_DOWNLOAD_DIR}/${githubReleaseTag.owner}_${githubReleaseTag.repo}_${githubReleaseTag.tag}_${extensionZipAsset.name}`;
    await downloader.downloadFile(extensionZipAsset.browser_download_url, extensionZipPath);
    let {packageJSON, error} = await ZipUtils.getExtensionPackageJSON(extensionZipPath);
    if(error) {
        issueMessages.push(error);
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            updatePublishErrors: true,
            error};
    }
    let requiredParams = ["name", "title", "description", "homepage", "version", "author", "license"];
    let missingParams = [];
    for(let param of requiredParams){
        if(!packageJSON[param]){
            missingParams.push(param);
        }
    }
    if(!packageJSON?.engines?.brackets){
        missingParams.push(`"engines":{"brackets":<version Eg. ">=0.34.0"}>`);
    }
    if(missingParams.length){
        error = "Required parameters missing in package.json: " + missingParams;
        issueMessages.push(error);
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            updatePublishErrors: true,
            error};
    }
    const {existingRegistryPKGVersion, registryPKGJSON} =
        await _validateExtensionPackageJson(githubReleaseTag, packageJSON, repoDetails, issueMessages);
    return {extensionZipPath, existingRegistryPKGVersion, registryPKGJSON};
}

async function _createGithubIssue(release) {
    let {number} = await createIssue(release.owner, release.repo,
        `[Phcode.dev Bot] Publishing Release \`${release.tag}\` to Extension Store`,
`Thank you for contributing to [phcode.dev](https://phcode.dev) extension store.\n
[Please track extension/theme publish status by clicking this link.](${BASE_URL}/www/publish/?owner=${release.owner}&repo=${release.repo}&tag=${release.tag})\n
You may close this issue at any time.`);
    return number;
}

async function _updatePublishErrors(release, issueMessages) {
    try{
        const existingReleaseInfo = await _getReleaseInfo(release);
        const releaseRef = `${release.owner}/${release.repo}/${release.tag}`;
        console.log(`existing release ${releaseRef} found: `, existingReleaseInfo);
        existingReleaseInfo.errors = issueMessages;
        existingReleaseInfo.status = "failed";
        existingReleaseInfo.lastUpdatedDateUTC = Date.now();
        if(!existingReleaseInfo.githubIssue){
            existingReleaseInfo.githubIssue = await _createGithubIssue(release);
        }
        await db.update(RELEASE_DETAILS_TABLE, existingReleaseInfo.documentId,
            existingReleaseInfo);
    } catch (e) {
        console.error("Error while putting error status of release. ", e);
        // silently bail out
    }
}

/**
 * create github issue if not already created, creates or updates release entry in release table to track
 * @param release
 * @param existingReleaseInfo
 * @private
 */
async function _UpdateReleaseInfo(release, existingReleaseInfo) {
    try{
        const releaseRef = `${release.owner}/${release.repo}/${release.tag}`;
        if(existingReleaseInfo && existingReleaseInfo.documentId) {
            console.log(`existing release ${releaseRef} found: `, existingReleaseInfo);
            existingReleaseInfo.errors = [];
            existingReleaseInfo.status = RELEASE_STATUS_PROCESSING;
            existingReleaseInfo.lastUpdatedDateUTC = Date.now();
            if(!existingReleaseInfo.githubIssue){
                existingReleaseInfo.githubIssue = await _createGithubIssue(release);
            }
            console.log("Update release table: ", await db.update(RELEASE_DETAILS_TABLE, existingReleaseInfo.documentId,
                existingReleaseInfo));
            return existingReleaseInfo;
        } else {
            console.log(`creating new release ${releaseRef} details: `);
            let releaseInfo = {
                errors: [],
                status: RELEASE_STATUS_PROCESSING,
                lastUpdatedDateUTC: Date.now(),
                githubIssue: await _createGithubIssue(release)
            };
            releaseInfo[FIELD_RELEASE_ID] = releaseRef;
            console.log(`Putting release ${releaseRef} details to db`,
                await db.put(RELEASE_DETAILS_TABLE, releaseInfo));
            return  await _getReleaseInfo(release);
        }
    } catch (e) {
        console.error("Error while putting error status of release. ", e);
        return release;
        // silently bail out
    }
}

async function _updateRegistryJSONinDB(existingRegistryPKGVersion, existingRegistryDocumentId, registryPKGJSON,
    issueMessages) {
    let status;
    registryPKGJSON.syncPending = true;
    registryPKGJSON.EXTENSION_ID = registryPKGJSON.metadata.name;
    if(existingRegistryDocumentId){
        // we need to update existing extension release only if no one updated the release while this release
        // was being published, so the conditional update with version check.
        console.log("updating extension", registryPKGJSON.EXTENSION_ID);
        status = await db.update(EXTENSIONS_DETAILS_TABLE, existingRegistryDocumentId,
            registryPKGJSON, `$.metadata.version='${existingRegistryPKGVersion}'`);
    } else {
        console.log("Creating extension", registryPKGJSON.EXTENSION_ID);
        status = await db.put(EXTENSIONS_DETAILS_TABLE, registryPKGJSON);
    }
    if(!status.isSuccess){
        console.error(`Error putting/updating extension details(did another release happen while releasing this version) in db ${EXTENSIONS_DETAILS_TABLE} :`+
            ` documentId: ${existingRegistryDocumentId} existing version: ${existingRegistryPKGVersion}, new pkg: ${JSON.stringify(registryPKGJSON)}`, status);
        const message = `Release failed. Did another release happen for the same extension? ${registryPKGJSON.metadata.name}`+
            ` while this release was being published?\n If so you may have to update your version number and make a new release with higher version number.`;
        issueMessages.push(message);
        throw {status: HTTP_STATUS_CODES.CONFLICT,
            error: message};
    }
}

export async function publishGithubRelease(request, reply) {
    let issueMessages = [],
        existingReleaseInfo = null,
        githubReleaseTag = null,
        _extensionZipPath = null;
    try {
        // releaseRef of the form <org>/<repo>:refs/tags/<dfg>
        githubReleaseTag = _validateAndGetParams(request.query.releaseRef);
        const {repoDetails, existingRelease} = await _validateAlreadyReleased(githubReleaseTag);
        existingReleaseInfo = existingRelease;
        const newGithubReleaseDetails = await _validateGithubRelease(githubReleaseTag);
        // at this point the release is accepted for processing. make status/issue entries in release table/GitHub
        existingReleaseInfo = await _UpdateReleaseInfo(githubReleaseTag, existingReleaseInfo);
        if(newGithubReleaseDetails.draft || newGithubReleaseDetails.prerelease){
            issueMessages.push(`Draft or PreRelease builds cannot be published.`);
            throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
                error: `Draft or PreRelease builds cannot be published.`};
        }
        const extensionZipAsset = _validateGitHubReleaseAssets(newGithubReleaseDetails, issueMessages);
        const {extensionZipPath, existingRegistryPKGVersion, existingRegistryDocumentId, registryPKGJSON}=
            await _downloadAndValidateExtensionZip(githubReleaseTag, extensionZipAsset, repoDetails, issueMessages);
        _extensionZipPath = extensionZipPath;
        // we should also in the future do a virus scan, but will rely on av in users machine for the time being
        // https://developers.virustotal.com/reference/files-scan by Google Cloud is available for non-commercial apps.

        await S3.uploadFile(EXTENSIONS_BUCKET,
            `extensions/${registryPKGJSON.metadata.name}-${registryPKGJSON.metadata.version}.zip`,
            _extensionZipPath);
        fs.unlink(_extensionZipPath, console.error); // cleanup downloads. (But we don't check the result)

        // publish new package json to registry db
        await _updateRegistryJSONinDB(existingRegistryPKGVersion, existingRegistryDocumentId, registryPKGJSON,
            issueMessages);

        const response = {
            message: "done"
        };
        return response;
    } catch (err) {
        console.error("Error while publishGithubRelease ", err);
        if(err.updatePublishErrors) {
            _updatePublishErrors(githubReleaseTag, issueMessages); // dont await, background task
        }
        if(_extensionZipPath){
            fs.unlink(_extensionZipPath, console.error); // cleanup after an exception. (But we don't check the result)
        }
        if(err.status){
            reply.status(err.status);
            return err.error;
        }
        throw new Error("Oops, something went wrong while publishGithubRelease");
    }
}
