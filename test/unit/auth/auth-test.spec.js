import {isAuthenticated, init, getAuthKey, addUnAuthenticatedAPI, addCustomAuthorizer} from "../../../src/auth/auth.js";
/*global describe, it*/

import * as chai from 'chai';
import {getConfigs} from "../../../src/utils/configs.js";

let expect = chai.expect;

describe('unit tests for auth module', function () {

    it('init should pass', function () {
        const authKey = '1234';
        init(authKey);
        const key = getAuthKey();
        expect(key).eql(authKey);
    });
    it('should throw exception if key is null', function () {
        let exceptionOccurred = false;
        try {
            init(null);
        } catch (e) {
            exceptionOccurred = true;
            expect(e.toString()).eql('Error: please set authKey in config file');
        }
        expect(exceptionOccurred).eql(true);

    });
    it('isAuthenticated should pass', function () {
        init('1');
        const authenticated = isAuthenticated({
            headers: {
                authorization: 'Basic 1'
            }, raw: {
                url: ""
            }

        }, {});
        expect(authenticated).eql(true);
    });
    it('isAuthenticated should fail if headers are missing', function () {
        init(getConfigs().authKey);
        const authenticated = isAuthenticated({raw: {
            url: ""
        }}, {});
        expect(authenticated).eql(false);
    });
    it('isAuthenticated should fail', function () {
        init('1');
        const authenticated = isAuthenticated({
            headers: {
                authorization: 'Basic 10'
            }, raw: {
                url: ""
            }

        }, {});
        expect(authenticated).eql(false);
    });

    it('isAuthenticated should fail if auth header has invalid entry', function () {
        init('1');
        const authenticated = isAuthenticated({
            headers: {
                authorization: 'Basic 1 1234'
            }, raw: {
                url: ""
            }

        }, {});
        expect(authenticated).eql(false);
    });
    it('isAuthenticated should fail if auth is not basic', function () {
        init('1');
        const authenticated = isAuthenticated({
            headers: {
                authorization: '123 1'
            }, raw: {
                url: ""
            }

        }, {});
        expect(authenticated).eql(false);
    });
    it('isAuthenticated should fail if auth header is not defined', function () {
        init(getConfigs().authKey);
        const authenticated = isAuthenticated({
            headers: {
                abc: '123'
            }, raw: {
                url: ""
            }

        }, {});
        expect(authenticated).eql(false);
    });

    function _verifyAuthenticated(url, expectedAuthenticated) {
        const authenticated = isAuthenticated({
            headers: {
                abc: '123'
            }, raw: {
                url
            }
        }, {});
        expect(authenticated).eql(expectedAuthenticated);
    }

    it('addUnAuthenticatedAPI should disable authentication for given api', function () {
        init(getConfigs().authKey);
        addUnAuthenticatedAPI("/testAPI01");
        _verifyAuthenticated("/testAPI01#43?z=34", true);
    });

    it('addUnAuthenticatedAPI should disable authentication for given api prefix', function () {
        init(getConfigs().authKey);
        addUnAuthenticatedAPI("/testAPI02/*");
        _verifyAuthenticated("/testAPI02/#43?z=34", true);
        _verifyAuthenticated("/testAPI02/x#43?z=34", true);
        _verifyAuthenticated("/testAPI02/x/y#43?z=34", true);
        _verifyAuthenticated("/testAPI02/index.html", true);
        addUnAuthenticatedAPI("/testAPI03*");
        _verifyAuthenticated("/testAPI03#43?z=34", true);
        _verifyAuthenticated("/testAPI03/#43?z=34", true);
        _verifyAuthenticated("/testAPI03hello/y/index.html#43?z=34", true);
    });

    it('addUnAuthenticatedAPI should not disable authentication for given api prefix not match', function () {
        init(getConfigs().authKey);
        addUnAuthenticatedAPI("/testAPI04/*");
        _verifyAuthenticated("/testAPI04#43?z=34", false);
        _verifyAuthenticated("/testAPI04d/#43?z=34", false);
    });

    it('addUnAuthenticatedAPI should not disable authentication if api signature mismatch with /', function () {
        addUnAuthenticatedAPI("/testAPI01");
        _verifyAuthenticated("/testAPI01/#43?z=34", false);  // note the / at the end of url
    });

    function _verifyCustomAuthorizerCalled(addCustomAuthURL, urlToTest) {
        let customAuthRequest;
        addCustomAuthorizer(addCustomAuthURL, (request)=>{
            customAuthRequest = request;
            return false;
        });
        const authenticated = isAuthenticated({
            headers: {
                abc: '123',
                auth: 'custom'
            }, raw: {
                url: urlToTest
            }

        }, {});
        expect(authenticated).eql(false);
        expect(customAuthRequest.headers.auth).eql('custom');
    }

    it('addCustomAuthorizer should be called for given api', function () {
        _verifyCustomAuthorizerCalled("/testAPI01", "/testAPI01#43?z=34");
    });

    it('addCustomAuthorizer should be called for given api prefix', function () {
        _verifyCustomAuthorizerCalled("/testAPICustom/*", "/testAPICustom/x#43?z=34");
        _verifyCustomAuthorizerCalled("/testAPICustom2*", "/testAPICustom2index/x#43?z=34");
    });

});
