// Refer https://json-schema.org/understanding-json-schema/index.html
import {EXTENSIONS_DETAILS_TABLE, FIELD_EXTENSION_ID} from "../constants.js";
import db from "../db.js";
import {HTTP_STATUS_CODES} from "@aicore/libcommonutils";

const schema = {
    schema: {
        querystring: {
            type: 'object',
            required: ['extensionName', 'extensionVersion'],
            properties: {
                extensionName: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 256
                },
                extensionVersion: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 32
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

export function getCountDownloadSchema() {
    return schema;
}

async function _getRegistryPkgJSON(extensionName) {
    const queryObj = {};
    queryObj[FIELD_EXTENSION_ID] = extensionName;
    let registryPKGJSON = await db.getFromIndex(EXTENSIONS_DETAILS_TABLE, queryObj);
    if(!registryPKGJSON.isSuccess){
        // unexpected error
        throw new Error("Error getting extensionPKG details from db: " + extensionName);
    }
    if(registryPKGJSON.documents.length === 1){
        let existingRegistryDocumentId = registryPKGJSON.documents[0].documentId;
        delete registryPKGJSON.documents[0].documentId;
        return {
            existingRegistryDocumentId,
            registryPKGJSON: registryPKGJSON.documents[0]
        };
    }
    return null;
}

/**
 * Checks if the given version is in the list of published versions in the registry entry.
 * @param registryPKGJSON
 * @param version
 * @private
 */
function _isPublishedVersion(registryPKGJSON, version) {
    let versions = [];
    versions.push(registryPKGJSON.metadata.version);
    for(let versionInfo of registryPKGJSON.versions){
        versions.push(versionInfo.version);
    }
    return versions.includes(version);
}

export async function countDownload(request, reply) {
    const extensionName = request.query.extensionName; // extension.name
    const extensionVersion = request.query.extensionVersion; // 1.0.2
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET");
    let registryEntry = await _getRegistryPkgJSON(extensionName);
    if(!registryEntry) {
        reply.status(HTTP_STATUS_CODES.BAD_REQUEST);
        throw new Error("No such extension");
    }
    if(!_isPublishedVersion(registryEntry.registryPKGJSON, extensionVersion)) {
        reply.status(HTTP_STATUS_CODES.BAD_REQUEST);
        throw new Error("No such extension version");
    }
    let status = await db.mathAdd(EXTENSIONS_DETAILS_TABLE, registryEntry.existingRegistryDocumentId, {
        totalDownloads: 1
    });
    if(!status.isSuccess) {
        throw new Error("Could not increment download count.");
    }
    const response = {
        message: `Done`
    };
    return response;
}
