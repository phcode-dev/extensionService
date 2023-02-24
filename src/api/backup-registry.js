import {EXTENSIONS_BUCKET, REGISTRY_FILE, REGISTRY_VERSION_FILE,
    POPULARITY_FILE, ARCHIVE_FOLDER} from "../constants.js";
import {S3} from "../s3.js";

const ONE_DAY_IN_MS = 24*60*60*1000;

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
        let contents = await S3.getObject(EXTENSIONS_BUCKET, REGISTRY_FILE);
        await S3.putObject(EXTENSIONS_BUCKET, getArchiveObjectPath(REGISTRY_FILE), contents);
        contents = await S3.getObject(EXTENSIONS_BUCKET, REGISTRY_VERSION_FILE);
        await S3.putObject(EXTENSIONS_BUCKET, getArchiveObjectPath(REGISTRY_VERSION_FILE), contents);
        contents = await S3.getObject(EXTENSIONS_BUCKET, POPULARITY_FILE);
        await S3.putObject(EXTENSIONS_BUCKET, getArchiveObjectPath(POPULARITY_FILE), contents);
        return {
            status: "done"
        };
    } catch (e){
        console.error(e);
        throw new Error("Oops, something went wrong");
    }
}

// Backup the registry daily to the archives folder in s3
let dailyBackupTimer;
export function setupTasks() {
    dailyBackupTimer = setInterval(backupRegistry, ONE_DAY_IN_MS);
}

export function cancelTasks() {
    if(dailyBackupTimer){
        clearInterval(dailyBackupTimer);
        dailyBackupTimer = null;
    }
}
