import {
    EXTENSIONS_BUCKET,
    EXTENSIONS_DETAILS_TABLE,
    POPULARITY_FILE,
    REGISTRY_FILE,
    REGISTRY_VERSION_FILE
} from "../constants.js";
import db from "../db.js";
import {S3} from "../s3.js";

export async function syncRegistryDBToS3JSON() {
    console.log("syncing non synced extension data in db to s3 extension.json");
    let pending = await db.query(EXTENSIONS_DETAILS_TABLE, "$.syncPending='Y'");
    if(!pending.isSuccess){
        // unexpected error
        throw new Error("Error getting syncPending extensions from: " + EXTENSIONS_DETAILS_TABLE);
    }
    if(!pending.documents.length){
        console.log("nothing to sync from db to s3 registry.json");
        return;
    }
    console.log("getting registry file from S3");
    let registry = JSON.parse(await S3.getObject(EXTENSIONS_BUCKET, REGISTRY_FILE));
    let popularity = JSON.parse(await S3.getObject(EXTENSIONS_BUCKET, POPULARITY_FILE));
    for(let document of pending.documents){
        // remove internal variables
        let newDoc = structuredClone(document);
        delete newDoc.documentId;
        delete newDoc.syncPending;
        console.log("Updating Registry entry with[existing, new]: ", registry[newDoc.metadata.name], newDoc);
        registry[newDoc.metadata.name] = newDoc;
        popularity[newDoc.metadata.name]= {
            "totalDownloads": newDoc.totalDownloads || 0,
            "gihubStars": newDoc.gihubStars || 0 // should have been gitHubStars, refactor in phcode tech debt.
        };
    }
    // now update all jsons in registry
    console.log("Writing main registry file: ", REGISTRY_FILE);
    await S3.putObject(EXTENSIONS_BUCKET, REGISTRY_FILE, JSON.stringify(registry));
    let registryVersion = JSON.parse(await S3.getObject(EXTENSIONS_BUCKET, REGISTRY_VERSION_FILE));
    registryVersion.version = registryVersion.version + 1;
    console.log("Writing registry version file version: ", registryVersion.version, REGISTRY_VERSION_FILE);
    await S3.putObject(EXTENSIONS_BUCKET, REGISTRY_VERSION_FILE, JSON.stringify(registryVersion));
    console.log("Writing registry popularity file version: ", POPULARITY_FILE);
    await S3.putObject(EXTENSIONS_BUCKET, POPULARITY_FILE, JSON.stringify(popularity));

    // now update all syncPending flags
    let updatePromises = [];
    for(let document of pending.documents){
        // remove internal variables
        let documentID = document.documentId;
        delete document.documentId;
        delete document.syncPending;
        console.log("Setting syncPending for: ", document.metadata.name, documentID);
        // conditional update to make sure than no new release happened while we were updating this release
        updatePromises.push(db.update(EXTENSIONS_DETAILS_TABLE, documentID, document,
            `$.metadata.version='${document.metadata.version}'`));
    }
    console.log("syncPending status updated in db for: ", await Promise.all(updatePromises));
}
