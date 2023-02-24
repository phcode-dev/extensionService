import * as fs from "fs";

let APP_CONFIG = null;

function _checkRequiredConfigs(config) {
    const requiredConfigVars = ["cocoEndPoint", "cocoAuthKey", "stage", "githubAPIToken", "baseURL"];
    let missingEnvVars = [];
    for (let envName of requiredConfigVars){
        if(!config[envName]){
            missingEnvVars.push(envName);
        }
    }
    if(missingEnvVars.length > 0){
        console.error("Required AppConfig variable missing: ", missingEnvVars);
        throw new Error("Required AppConfig variable missing: " + missingEnvVars);
    }
}

function _getValidatedConfig(configText) {
    let config = JSON.parse(configText);
    if(typeof config.port !== 'number'){
        throw new Error("Invalid port(expected number) in config " + config.port);
    }
    _checkRequiredConfigs(config);
    console.log("using port: ", config.port);
    return config;
}

/**
 * It returns an object with the port, authKey, and mySqlConfigs
 * @returns An object with the following properties:
 *     port: The port number for the database server default port is 5000.
 *     authKey: A random string used to authenticate the client. this value can also be given using environment variable
 *
 */
export function getConfigs() {
    if (APP_CONFIG) {
        return APP_CONFIG;
    }
    if (!process.env.APP_CONFIG) {
        throw new Error('Please provide valid app config file by setting APP_CONFIG environment variable' +
            ' for example APP_CONFIG=./abc.json');
    }
    APP_CONFIG = _getAppConfig(process.env.APP_CONFIG);
    return APP_CONFIG;
}

function _getAppConfig(file) {
    const appConfigFile = fs.readFileSync(file);
    return _getValidatedConfig(appConfigFile.toString());
}

export function deleteAppConfig() {
    APP_CONFIG = null;
}
