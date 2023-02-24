// Refer https://json-schema.org/understanding-json-schema/index.html
import {HTTP_STATUS_CODES} from "@aicore/libcommonutils";
import {getRepoDetails, getReleaseDetails, createIssue} from "../github.js";
import db from "../db.js";
import {FIELD_RELEASE_ID, RELEASE_DETAILS_TABLE, EXTENSION_SIZE_LIMIT_MB, BASE_URL} from "../constants.js";

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

async function _validateAlreadyReleased(release) {
    let repo = await getRepoDetails(release.owner, release.repo);
    if(!repo) {
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            error: `Repo ${release.owner}/${release.repo} doesnt exist or is not accessible.`};
    }
    const releaseRef = `${release.owner}/${release.repo}/${release.tag}`;
    const queryObj = {};
    queryObj[FIELD_RELEASE_ID] = releaseRef;
    let existingRelease = await db.getFromIndex(RELEASE_DETAILS_TABLE, queryObj);
    if(!existingRelease.isSuccess){
        // unexpected error
        throw new Error("Error getting release details from db: " + releaseRef);
    }
    existingRelease = existingRelease.documents.length === 1 ? existingRelease.documents[0] : null;
    if(existingRelease?.published){
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            error: `Release ${releaseRef} already published!`};
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
            error: `Release ${releaseRef} not found in GitHub`};
    }
    return release;
}

function _validateExtensionZip(githubReleaseDetails, issueMessages) {
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
            error: userMessage};
    }
    if(extensionZipAsset.size > EXTENSION_SIZE_LIMIT_MB*1024*1024){
        let userMessage = `Attached \`extension.zip\` file should be smaller than ${EXTENSION_SIZE_LIMIT_MB}MB`;
        issueMessages.push(userMessage);
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            error: userMessage};
    }
}

async function _createGithubIssue(release) {
    let {number} = await createIssue(release.owner, release.repo,
        `[Phcode.dev Bot] Publishing Release ${release.tag} to Extension Store`,
`Thank you for contributing to [phcode.dev](https://phcode.dev) extension store.\n
[Please track extension/theme publish status by clicking this link.](${BASE_URL}/www/publish/?owner=${release.owner}&repo=${release.repo}&tag=${release.tag})`);
    return number;
}

async function _updatePublishErrors(release, existingReleaseInfo, issueMessages) {
    try{
        const releaseRef = `${release.owner}/${release.repo}/${release.tag}`;
        if(existingReleaseInfo && existingReleaseInfo.documentId) {
            console.log(`existing release ${releaseRef} found: `, existingReleaseInfo);
            existingReleaseInfo.errors = issueMessages;
            if(!existingReleaseInfo.githubIssue){
                existingReleaseInfo.githubIssue = await _createGithubIssue(release);
            }
            await db.update(RELEASE_DETAILS_TABLE, existingReleaseInfo.documentId,
                existingReleaseInfo);
        } else {
            console.log(`updating new release ${releaseRef} error messages: `, issueMessages);
            let releaseInfo = {
                errors: issueMessages,
                githubIssue: await _createGithubIssue(release)
            };
            releaseInfo[FIELD_RELEASE_ID] = releaseRef;
            console.log(`Putting release ${releaseRef} details to db`,
                await db.put(RELEASE_DETAILS_TABLE, releaseInfo));
        }
    } catch (e) {
        console.error("Error while putting error status of release. ", e);
        // silently bail out
    }
}

export async function publishGithubRelease(request, reply) {
    let issueMessages = [],
        existingReleaseInfo = null,
        githubReleaseTag = null;
    try {
        // releaseRef of the form <org>/<repo>:refs/tags/<dfg>
        githubReleaseTag = _validateAndGetParams(request.query.releaseRef);
        const {repoDetails, existingRelease} = await _validateAlreadyReleased(githubReleaseTag);
        existingReleaseInfo = existingRelease;
        const githubReleaseDetails = await _validateGithubRelease(githubReleaseTag);
        await _validateExtensionZip(githubReleaseDetails, issueMessages);
        const response = {
            message: "done"
        };
        return response;
    } catch (err) {
        if(issueMessages.length){
            _updatePublishErrors(githubReleaseTag, existingReleaseInfo, issueMessages);
        }
        if(err.status){
            reply.status(err.status);
            return err.error;
        }
        console.error("Error while publishGithubRelease ", err);
        throw new Error("Oops, something went wrong while publishGithubRelease");
    }
}
