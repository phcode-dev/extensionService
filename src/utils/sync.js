import {
    EXTENSIONS_BUCKET,
    EXTENSIONS_DETAILS_TABLE,
    POPULARITY_FILE,
    REGISTRY_FILE,
    REGISTRY_VERSION_FILE,
    FIELD_EXTENSION_ID
} from "../constants.js";
import db from "../db.js";
import {S3} from "../s3.js";
import {getRepoDetails} from "../github.js";

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


const ONE_HOUR = 1000*60*60, HOURS_IN_DAY = 24, ONE_DAY = ONE_HOUR * HOURS_IN_DAY;
let extensionsStarsCollectedToday = []; // will be reset every day, collect stars from GitHub once daily

async function _updateStargazerCount(owner, repo, extensionId) {
    let repoDetails = await getRepoDetails(owner, repo, false);
    if(repoDetails) {
        const queryObj = {};
        queryObj[FIELD_EXTENSION_ID] = extensionId;
        let registryPKGJSON = await db.getFromIndex(EXTENSIONS_DETAILS_TABLE, queryObj);
        if(!registryPKGJSON.isSuccess){
            console.error("Error getting extensionPKG details from db: " + extensionId);
            // dont fail, continue with next repo
            return;
        }
        if(registryPKGJSON.documents.length === 1){
            const document = registryPKGJSON.documents[0];
            const documentId = registryPKGJSON.documents[0].documentId;
            document.gihubStars = repoDetails.stargazers_count;
            let status = await db.update(EXTENSIONS_DETAILS_TABLE, documentId, document,
                `$.metadata.version='${document.metadata.version}'`);
            if(!status.isSuccess) {
                console.error("Error updating stars for extension in db: " + extensionId);
                // dont fail, continue with next repo
                return;
            }
        }
    }
}

/**
 * Collects github star count every hour in batches considering GitHub throttles at 2000 GitHub Api requests per hour.
 */
export async function _collectStarsWorker() { // exported for tests only
    console.log("Number of extensions whose stars collected today: ", extensionsStarsCollectedToday.length);
    let registry = JSON.parse(await S3.getObject(EXTENSIONS_BUCKET, REGISTRY_FILE));
    let extensionIDs = Object.keys(registry);
    const numExtensionsToCollect = (extensionIDs.length/HOURS_IN_DAY) * 2; // so that the task completes in half day
    let extensionsToCollect = []; // all extensions whose stars have not been collected today
    for(let extensionID of extensionIDs) {
        if(extensionsStarsCollectedToday.includes(extensionID)){
            // already collected
            continue;
        }
        if(!registry[extensionID].ownerRepo){
            // no repo, so nothing to see here
            extensionsStarsCollectedToday.push(extensionID);
            continue;
        }
        extensionsToCollect.push(extensionID);
    }
    let collectedStarsForExtensions = [];
    for(let i=0; i < numExtensionsToCollect && i < extensionsToCollect.length; i++){
        let extensionID = extensionsToCollect[i];
        let repoSplit = registry[extensionID].ownerRepo.split("/");//"https://github.com/Brackets-Themes/808"
        const repo = repoSplit[repoSplit.length-1],
            owner = repoSplit[repoSplit.length-2];
        // this is purposefully serial
        await _updateStargazerCount(owner, repo, extensionID);
        extensionsStarsCollectedToday.push(extensionID);
        collectedStarsForExtensions.push(extensionID);
    }
    console.log(`collecting stars for ${collectedStarsForExtensions.length} extensions of MAX allowed ${numExtensionsToCollect}`);
    return {collectedStarsForExtensions, extensionsStarsCollectedToday};
}

/* c8 ignore start */
// not testing this as no time and is manually tested. If you are touching this code, manual test thoroughly
let worker;
export function startCollectStarsWorker() {
    if(worker){
        return;
    }
    worker = setInterval(_collectStarsWorker, ONE_HOUR);
    setInterval(()=>{
        extensionsStarsCollectedToday = [];
    }, ONE_DAY);
}
/* c8 ignore end */
/**
 * sets download count of extensions.
 * publishes registry.json and popularity.json into s3
 * does not increase registry_version.json
 * @private
 */
function _syncPopularityHourly() {

}
