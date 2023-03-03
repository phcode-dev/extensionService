// Refer https://json-schema.org/understanding-json-schema/index.html
import {FIELD_RELEASE_ID, RELEASE_DETAILS_TABLE} from "../constants.js";
import db from "../db.js";

const schema = {
    schema: {
        querystring: {
            type: 'object',
            required: ['owner', "repo", "tag"],
            properties: {
                owner: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 256
                }, repo: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 256
                }, tag: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 256
                }
            }
        },
        response: {
            200: { //HTTP_STATUS_CODES.OK
                type: 'object',
                required: ['status', 'errors'],
                properties: {
                    status: {type: 'string'},
                    publishedExtensionName: {type: 'string'},
                    publishedVersion: {type: 'string'},
                    errors: {type: 'array', "items": {"type": "string"}},
                    published: {type: 'boolean'},
                    githubIssue: {type: 'string'},
                    lastUpdatedDateUTC: {type: 'number'}
                }
            }
        }
    }
};

export function getGetGithubReleaseStatusSchema() {
    return schema;
}

export async function getGithubReleaseStatus(request, _reply) {
    // ?owner=${release.owner}&repo=${release.repo}&tag=${release.tag}
    const owner = request.query.owner;
    const repo = request.query.repo;
    const tag = request.query.tag;
    const releaseRef = `${owner}/${repo}/${tag}`;
    const queryObj = {};
    queryObj[FIELD_RELEASE_ID] = releaseRef;
    let existingRelease = await db.getFromIndex(RELEASE_DETAILS_TABLE, queryObj);
    if (!existingRelease.isSuccess) {
        // unexpected error
        throw new Error("Error getting release details from db: " + releaseRef);
    }
    existingRelease = existingRelease.documents.length === 1 ? existingRelease.documents[0] : null;
    if (!existingRelease) {
        throw new Error("Release not found. IF this is a recent release," +
            " please wait for 1 minute before checking again.");
    }

    const response = {
        published: existingRelease.published || false,
        status: existingRelease.status,
        errors: existingRelease.errors,
        githubIssue: "" + existingRelease.githubIssue,
        lastUpdatedDateUTC: existingRelease.lastUpdatedDateUTC
    };
    if(existingRelease.publishedExtensionName){
        response.publishedExtensionName = existingRelease.publishedExtensionName;
    }
    if(existingRelease.publishedVersion){
        response.publishedVersion = existingRelease.publishedVersion;
    }

    return response;
}
