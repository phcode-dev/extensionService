import {EXTENSIONS_BUCKET, REGISTRY_FILE, REGISTRY_VERSION_FILE,
    POPULARITY_FILE, ARCHIVE_FOLDER} from "../constants.js";
import {putObject, getObject} from "../s3.js";

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

export function getBackupRegistrySchema() {
    return schema;
}

let date = new Date();
export function getArchiveObjectPath(fileName) {
    return `${ARCHIVE_FOLDER}/${date.getUTCFullYear()}/${date.getUTCMonth()}/${date.getUTCDate()}/${fileName}`;
}

export async function backupRegistry() {
    try {
        let contents = await getObject(EXTENSIONS_BUCKET, REGISTRY_FILE);
        await putObject(EXTENSIONS_BUCKET, getArchiveObjectPath(REGISTRY_FILE), contents);
        contents = await getObject(EXTENSIONS_BUCKET, REGISTRY_VERSION_FILE);
        await putObject(EXTENSIONS_BUCKET, getArchiveObjectPath(REGISTRY_VERSION_FILE), contents);
        contents = await getObject(EXTENSIONS_BUCKET, POPULARITY_FILE);
        await putObject(EXTENSIONS_BUCKET, getArchiveObjectPath(POPULARITY_FILE), contents);
        return {
            status: "done"
        };
    } catch (e){
        console.error(e);
        throw new Error("Oops, something went wrong");
    }
}
