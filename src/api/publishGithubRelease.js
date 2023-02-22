// Refer https://json-schema.org/understanding-json-schema/index.html
import {HTTP_STATUS_CODES} from "@aicore/libcommonutils";
import {getRepoDetails} from "../github.js";
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

async function _processGithubRelease(release) {
    let repo = await getRepoDetails(release.owner, release.repo);
    if(!repo) {
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            error: `Repo ${release.owner}/${release.repo} doesnt exist or is not accessible.`};
    }
    const releaseRef = `${release.owner}/${release.repo}/${release.tag}`;
    const queryObj = {};
    queryObj[FIELD_RELEASE_ID] = releaseRef;
    const releaseDetails = await db.getFromIndex(RELEASE_DETAILS_TABLE, queryObj);
    if(!releaseDetails.isSuccess){
        // unexpected error
        throw new Error("Error getting release details from db: " + releaseRef);
    }
    if(releaseDetails.documents.length === 1 && releaseDetails.documents[0].published){
        throw {status: HTTP_STATUS_CODES.BAD_REQUEST,
            error: `Release ${releaseRef} already published!`};
    }
    console.log(releaseDetails);
}

export async function publishGithubRelease(request, reply) {
    try {
        let githubRelease = _validateAndGetParams(request.query.releaseRef);
        await _processGithubRelease(githubRelease);
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
