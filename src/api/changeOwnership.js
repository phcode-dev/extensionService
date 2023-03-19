// Refer https://json-schema.org/understanding-json-schema/index.html
import {
    EXTENSIONS_BUCKET,
    EXTENSIONS_DETAILS_TABLE,
    FIELD_EXTENSION_ID,
    REGISTRY_FILE
} from "../constants.js";
import db from "../db.js";
import {HTTP_STATUS_CODES} from "@aicore/libcommonutils";
import {syncRegistryDBToS3JSON} from "../utils/sync.js";
import {S3} from "../s3.js";
import {createIssue} from "../github.js";

const schema = {
    schema: {
        querystring: {
            type: 'object',
            required: ["extensionName", 'newOwner', "newRepo"],
            properties: {
                extensionName: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 256
                }, newOwner: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 256
                }, newRepo: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 256
                }
            }
        },
        response: {
            200: { //HTTP_STATUS_CODES.OK
                type: 'object',
                required: ["oldEntry", 'newEntry'],
                properties: {
                    oldEntry: {type: 'string'},
                    newEntry: {type: 'string'}
                }
            }
        }
    }
};

export function getChangeOwnershipSchema() {
    return schema;
}

// internal private API, please change error messages if exposing to public, as internal error details are returned.
async function _getRegistryPkgJSON(extensionName, reply) {
    const queryObj = {};
    queryObj[FIELD_EXTENSION_ID] = extensionName;
    let registryPKGJSON = await db.getFromIndex(EXTENSIONS_DETAILS_TABLE, queryObj);
    if(!registryPKGJSON.isSuccess){
        // unexpected error
        throw new Error("Error getting extensionPKG details from db for: " + extensionName);
    }
    if(registryPKGJSON.documents.length !== 1){
        reply.status(HTTP_STATUS_CODES.BAD_REQUEST);
        throw new Error("no such extension id: " + extensionName);
    }
    return  registryPKGJSON.documents[0];
}


async function _updateRegistryJSONinDB(registryPKGJSON) {
    const existingRegistryDocumentId = registryPKGJSON.documentId;
    let status;
    registryPKGJSON.syncPending = 'Y';// coco db doesnt support boolean queries yet
    registryPKGJSON.EXTENSION_ID = registryPKGJSON.metadata.name;
    // we need to update existing extension release only if no one updated the release while this change
    // was being published, so the conditional update with version check.
    console.log("updating extension", registryPKGJSON.EXTENSION_ID);
    status = await db.update(EXTENSIONS_DETAILS_TABLE, existingRegistryDocumentId,
        registryPKGJSON, `$.metadata.version='${registryPKGJSON.metadata.version}'`);
    if(!status.isSuccess) {
        throw new Error("Another update in progress? Failed to update extension in db for: "
            + registryPKGJSON.EXTENSION_ID);
    }
}

async function _validateOwnershipChange(registryPKGJSON) {
    let registry = JSON.parse(await S3.getObject(EXTENSIONS_BUCKET, REGISTRY_FILE));
    let registryEntry = registry[registryPKGJSON.metadata.name];
    if(registryEntry.metadata.repository.url !== registryPKGJSON.metadata.repository.url
        || registryEntry.owner !== registryPKGJSON.owner
        || registryEntry.ownerRepo !== registryPKGJSON.ownerRepo){
        throw new Error("registry.json update failed for: " + registryPKGJSON.metadata.name);
    }
    return registryEntry;
}

async function _notifyOwnersWithGithubIssue(newOwnerRepo, oldOwnerRepo, extensionName) {
    if(oldOwnerRepo === newOwnerRepo){
        return;
    }
    try{
        let oldOwner = oldOwnerRepo.replace("https://github.com/", "").split("/")[0],
            oldRepo = oldOwnerRepo.replace("https://github.com/", "").split("/")[1];
        console.log(await createIssue(oldOwner, oldRepo,
            `[Phcode.dev Bot] Ownership Transferred. You no longer own the extension \`${extensionName}\`.`,
            `Greetings from [phcode.dev](https://phcode.dev). You no longer own the extension \`${extensionName}\`. \n\nOwnership of this extension is now transferred from ${oldOwnerRepo} to ${newOwnerRepo}.`));
    } catch (e) {
        // ignore error as the old owner repo may not be present if the user deleted old repos
        console.error(e);
    }
    try{
        let newOwner = newOwnerRepo.replace("https://github.com/", "").split("/")[0],
            newRepo = newOwnerRepo.replace("https://github.com/", "").split("/")[1];
        console.log(await createIssue(newOwner, newRepo,
            `[Phcode.dev Bot] Ownership Transferred: Gained ownership of \`${extensionName}\``,
            `Greetings from [phcode.dev](https://phcode.dev). You have gained ownership of the extension \`${extensionName}\`. \n\nOwnership of this extension is now transferred from ${oldOwnerRepo} to ${newOwnerRepo}.`));
    } catch (e) {
        console.error(e);
    }
}

// this entire file is private api and hence not unit or coverage tested. Please tread carefully if making changes.
// remove this file from covergae exclusion file `.nycrc.unit.json` if adding as public api in the future.
export async function changeOwnership(request, reply) {
    const extensionName = request.query.extensionName;
    const newOwner = request.query.newOwner;
    const newRepo = request.query.newRepo;
    const registryPKGJSON = await _getRegistryPkgJSON(extensionName, reply);
    console.log("old entry", registryPKGJSON);
    const oldEntry = JSON.stringify(registryPKGJSON);
    const oldOwnerRepo = registryPKGJSON.ownerRepo;
    const newOwnerRepo = `https://github.com/${newOwner}/${newRepo}`;
    registryPKGJSON.owner = `github:${newOwner}`;
    registryPKGJSON.ownerRepo = newOwnerRepo;
    if(registryPKGJSON.metadata.homepage && registryPKGJSON.metadata.homepage.startsWith("https://github.com/")){
        registryPKGJSON.metadata.homepage = `https://github.com/${newOwner}/${newRepo}`;
    }
    registryPKGJSON.metadata.repository= {
        type: "git",
        url: `https://github.com/${newOwner}/${newRepo}.git`
    };
    console.log("Updating entry", registryPKGJSON);
    await _updateRegistryJSONinDB(registryPKGJSON);
    await syncRegistryDBToS3JSON();
    const registryEntry = await _validateOwnershipChange(registryPKGJSON);
    console.log("updated registry entry", registryEntry);
    await _notifyOwnersWithGithubIssue(newOwnerRepo, oldOwnerRepo, extensionName);
    const response = {
        oldEntry,
        newEntry: JSON.stringify(registryEntry)
    };
    return response;
}
