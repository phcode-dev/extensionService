import {isString} from "@aicore/libcommonutils";

let key = null;
const customAuthAPIPath = {},
    prefixCustomAuthAPIPath = [],
    API_AUTH_NONE = 1,
    API_AUTH_CUSTOM = 2;

export function init(authKey) {
    if (!isString(authKey)) {
        throw new Error('please set authKey in config file');
    }
    key = authKey;
}

function _isBasicAuthPass(request) {
    if (!request.headers) {
        return false;
    }
    const authHeader = request.headers.authorization;
    if (!authHeader) {
        return false;
    }
    const split = authHeader.trim().split(' ');
    if (split && split.length === 2) {
        if (split[0] !== 'Basic') {
            return false;
        }
        const reqKey = split[1].trim();
        if (reqKey === key) {
            return true;
        }
    }
    return false;
}

/**
 * path of form '/x/y#df?a=30' to '/x/y' or 'https://d/x/y#df?a=30' to 'https://d/x/y'
 * @param url any url
 * @return {string} url or path without any query string or # params
 * @private
 */
function _getBaseURL(url = "") {
    return url.split("?")[0].split("#")[0];
}

function _findAuthorizer(request) {
    const baseURL = _getBaseURL(request.raw.url);
    let customAuth = customAuthAPIPath[baseURL];
    if(customAuth) {
        return customAuth;
    }
    for(let prefixOptions of prefixCustomAuthAPIPath){
        if(baseURL.startsWith(prefixOptions.urlPrefix)){
            return prefixOptions;
        }
    }
    return null;
}

export function isAuthenticated(request) {
    let customAuth = _findAuthorizer(request);
    if(!customAuth){
        return _isBasicAuthPass(request);
    }
    if( customAuth.authType === API_AUTH_NONE){
        return true;
    }
    if( customAuth.authType === API_AUTH_CUSTOM && customAuth.authCallback){
        return customAuth.authCallback(request);
    }
    // should never reach here.
}

/**
 * There would be certain APIs that you need to work without auth. This function sets a given API path
 * as requiring no authentication. You can either specify an exact apiPath("/public/api/") or a prefix("/static/site*")
 * @param {string} apiPathOrPrefix Path of the form "/path/to/api", route must exactly match api in `server.get` call.
 *  or if you want to allow all urls starting with a prefix say `/static/www` , use `/static/www/*`
 */
export function addUnAuthenticatedAPI(apiPathOrPrefix) {
    if(apiPathOrPrefix.endsWith('*')){
        prefixCustomAuthAPIPath.push({
            urlPrefix: apiPathOrPrefix.slice(0, -1), // remove * for easier compare
            authType: API_AUTH_NONE
        });
        return;
    }
    customAuthAPIPath[apiPathOrPrefix] = {
        authType: API_AUTH_NONE
    };
}

/**
 * There would be certain APIs that you have to provide your own custom auth logic. Use this API for that.
 * @param {string} apiPathOrPrefix Path of the form "/path/to/api", route must exactly match api in `server.get` call.
 *  or if you want to allow all urls starting with a prefix say `/static/www` , use `/static/www/*`
 * @param {function} authCallback will be called with the request and should return true if the request is authorised
 * and able to continue, else return false.
 */
export function addCustomAuthorizer(apiPathOrPrefix, authCallback) {
    if(apiPathOrPrefix.endsWith('*')){
        prefixCustomAuthAPIPath.push({
            urlPrefix: apiPathOrPrefix.slice(0, -1), // remove * for easier compare
            authType: API_AUTH_CUSTOM,
            authCallback
        });
        return;
    }
    customAuthAPIPath[apiPathOrPrefix] = {
        authType: API_AUTH_CUSTOM,
        authCallback
    };
}

export function getAuthKey() {
    return key;
}
