import {getConfigs} from './utils/configs.js';

export const stage = getConfigs().stage;
export const accessKeyId = getConfigs().accessKeyId;
export const secretAccessKey = getConfigs().secretAccessKey;
export const githubAPIToken = getConfigs().githubAPIToken;
export const cocoEndPoint = getConfigs().cocoEndPoint;
export const cocoAuthKey = getConfigs().cocoAuthKey;
// GitHub API rate limit is 5000 for authenticated users. Be conservative and set this to 2000.
export const githubHourlyRateLimit = getConfigs().githubHourlyRateLimit;
// the repository where public ops related issues can be created. Eg. "phcode-dev/extensionService"
export const opsRepo = getConfigs().opsRepo;
export const DATABASE_NAME = `phcode_extensions_${stage}`;
export const EXTENSIONS_DETAILS_TABLE = `${DATABASE_NAME}.extensionDetails`;
export const RELEASE_DETAILS_TABLE = `${DATABASE_NAME}.releaseDetails`;
export const EXTENSIONS_BUCKET = (stage === 'prod') ? "phcode-extensions" : `phcode-extensions-${stage}`;
export const ARCHIVE_FOLDER = "archive";
export const POPULARITY_FILE = "popularity.json";
export const REGISTRY_FILE = "registry.json";
export const REGISTRY_VERSION_FILE = "registry_version.json";
export const EXTENSION_SIZE_LIMIT_MB = 50;
export const FIELD_EXTENSION_ID = "EXTENSION_ID",
    FIELD_RELEASE_ID = "RELEASE_ID",
    FIELD_TYPE = 'VARCHAR(128)';
export const BASE_URL = getConfigs().baseURL;
export const EXTENSION_DOWNLOAD_DIR = process.cwd() + "/downloads";
export const PROCESSING_TIMEOUT_MS = 60000; // you can retry publish after a minute in processing status

console.log("Using stage", stage);
console.log("Using Tables", EXTENSIONS_DETAILS_TABLE, RELEASE_DETAILS_TABLE);
console.log("Using S3 bucket", EXTENSIONS_BUCKET);
