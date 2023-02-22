// Refer https://json-schema.org/understanding-json-schema/index.html
import {HTTP_STATUS_CODES} from "@aicore/libcommonutils";
import {getRepoDetails, getReleaseDetails} from "../github.js";
import db from "../db.js";
import {FIELD_RELEASE_ID, RELEASE_DETAILS_TABLE} from "../constants.js";

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

async function _validateGithubRelease(githubRelease, issueMessages) {
    const releaseRef = `${githubRelease.owner}/${githubRelease.repo}/${githubRelease.tag}`;
    let release = await getReleaseDetails(githubRelease.owner, githubRelease.repo, githubRelease.tag);
    if(!release) {
        // this need not be reported in a user issue as it is unlikely to happen.
        // we call this api via github on-released action
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            error: `Release ${releaseRef} not found in GitHub`};
    }
}

export async function publishGithubRelease(request, reply) {
    let issueMessages = [],
        existingGithubIssue,
        githubRelease;
    try {
        githubRelease = _validateAndGetParams(request.query.releaseRef);
        const {repoDetails, existingRelease} = await _validateAlreadyReleased(githubRelease);
        existingGithubIssue = existingRelease?.existingGithubIssue;
        await _validateGithubRelease(githubRelease, issueMessages);
        const response = {
            message: "done"
        };
        return response;
    } catch (err) {
        if(err.status){
            reply.status(err.status);
            return err.error;
        }
        console.error("Error while publishGithubRelease ", err);
        throw new Error("Oops, something went wrong while publishGithubRelease");
    }
}
