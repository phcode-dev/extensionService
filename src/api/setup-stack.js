import {
    DATABASE_NAME, EXTENSIONS_DETAILS_TABLE, RELEASE_DETAILS_TABLE, FIELD_EXTENSION_ID, FIELD_RELEASE_ID,
    FIELD_TYPE, EXTENSIONS_BUCKET, REGISTRY_FILE
}
    from "../constants.js";
import db from "../db.js";
import {getObject} from "../s3.js";

// Refer https://json-schema.org/understanding-json-schema/index.html
const schema = {
    schema: {
        response: {
            200: { //HTTP_STATUS_CODES.OK
                type: 'object',
                required: ['status'],
                properties: {
                    status: {type: 'string'}
                }
            }
        }
    }
};

export function getSetupStackSchema() {
    return schema;
}

async function _putDataInTable(allExtensionData, tableName) {
    let extensionIDs = Object.keys(allExtensionData);
    console.log("adding db entries for extensions: ", extensionIDs.length);
    let getPromises = [];
    for (let i = 0; i < extensionIDs.length; i++) {
        let extensionID = extensionIDs[i];
        getPromises.push(db.getFromIndex(tableName, {
            EXTENSION_ID: extensionID
        }));
    }
    let allGetData = await Promise.all(getPromises);
    console.log("got record details from " + tableName);
    let putPromises = [], newExtensionsAdded = 0;
    for (let i = 0; i < allGetData.length; i++) {
        let extensionID = extensionIDs[i];
        let currentExtensionData = allExtensionData[extensionID];
        currentExtensionData.EXTENSION_ID = extensionID;
        let getData = allGetData[i];
        if(!getData.isSuccess){
            console.error(getData);
            continue;
        }
        if(getData.documents.length === 1){
            putPromises.push(db.update(tableName, getData.documents[0].documentId,
                currentExtensionData));
        } else {
            newExtensionsAdded ++;
            putPromises.push(db.put(tableName, currentExtensionData));
        }
    }
    console.log(`${newExtensionsAdded} new extension data detected, ${allGetData.length-newExtensionsAdded} old extensions of ${allGetData.length}`);
    let allPutData = await Promise.all(putPromises);
    console.log("updated record details in " + tableName);
    for (let i = 0; i < allPutData.length; i++) {
        let putData = allPutData[i];
        if(!putData.isSuccess){
            console.error(`Error putting ${extensionIDs[i]}`, putData);
        }
    }
    console.log("done");
}

export async function setupStackForStage() {
    try{
        console.log("creating stack", DATABASE_NAME);
        console.log("creating db ", await db.createDb(DATABASE_NAME));
        // EXTENSIONS_DETAILS_TABLE
        console.log("creating table ", await db.createTable(EXTENSIONS_DETAILS_TABLE));
        console.log("creating Index ", await db.createIndex(EXTENSIONS_DETAILS_TABLE, FIELD_EXTENSION_ID, FIELD_TYPE,
            true, true));
        console.log("creating table ", await db.createTable(RELEASE_DETAILS_TABLE));
        console.log("creating Index ", await db.createIndex(RELEASE_DETAILS_TABLE, FIELD_RELEASE_ID, FIELD_TYPE,
            true, true));
        console.log("reading registry file");
        let registry = JSON.parse(await getObject(EXTENSIONS_BUCKET, REGISTRY_FILE));
        console.log("updating tables with registry");
        await _putDataInTable(registry, EXTENSIONS_DETAILS_TABLE);
        console.log("done");
        return {
            status: "done"
        };
    } catch (e){
        console.error(e);
        throw new Error("Oops, something went wrong");
    }
}
