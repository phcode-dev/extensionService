import {writeFileSync, existsSync} from "fs";

// Security Warning: please don't put any actual secrets here!!! Use APP_CONFIG_FOR_INTEG_TESTS env variable
// in case you have to setup secrets
const defaultTestConfig = {
    "port": 5000,
    "authKey": "hehe",
    "allowPublicAccess": false,
    "cocoEndPoint": "Provide coco endpoint in testConfig.json file to run integ tests",
    "cocoAuthKey": "update in testConfig.json file to run integ tests",
    "stage": "can be dev/prod . update in testConfig.json",
    "accessKeyId": "update in testConfig.json file to run integ tests",
    "secretAccessKey": "update in testConfig.json file to run integ tests",
    "githubAPIToken": "update in testConfig.json file to run integ tests",
    "baseURL": "update in testConfig.json file to run integ tests"
};


if (process.env.APP_CONFIG_FOR_INTEG_TESTS) {
    console.log("CI environment detected: using app config from environment variable APP_CONFIG_FOR_INTEG_TESTS");
    writeFileSync("src/testConfig.json", process.env.APP_CONFIG_FOR_INTEG_TESTS);
} else if(existsSync("src/testConfig.json")) {
    console.warn("src/testConfig.json already exists, using that for tests");
}else {
    console.warn("using default app config file for tests. " +
        "as no CI environment variable APP_CONFIG_FOR_INTEG_TESTS detected \n If you wish to run this from GitHub " +
        "actions, set a repository secret APP_CONFIG_FOR_INTEG_TESTS which contains the app config");
    console.warn("Please edit src/testConfig.json to add your own app config for tests!!");
    writeFileSync("src/testConfig.json", JSON.stringify(defaultTestConfig, null, 4));
}
