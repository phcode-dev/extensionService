// Testing framework: Mocha , assertion style: chai
// See https://mochajs.org/#getting-started on how to write tests
// Use chai for BDD style assertions (expect, should etc..). See move here: https://www.chaijs.com/guide/styles/#expect

// Mocks and spies: sinon
// if you want to mock/spy on fn() for unit tests, use sinon. refer docs: https://sinonjs.org/

// Note on coverage suite used here:
// we use c8 for coverage https://github.com/bcoe/c8. Its reporting is based on nyc, so detailed docs can be found
// here: https://github.com/istanbuljs/nyc ; We didn't use nyc as it do not yet have ES module support
// see: https://github.com/digitalbazaar/bedrock-test/issues/16 . c8 is drop replacement for nyc coverage reporting tool
/*global describe, it, beforeEach, before*/

import mockedFunctions from "./setupMocks.js";
import {createIssue, commentOnIssue, initGitHubClient, getOrgDetails} from "../../src/github.js";
import * as chai from 'chai';

let expect = chai.expect;

describe('github mock Tests', function() {
    let url, options, githubResponse;

    before(function () {
        initGitHubClient();
    });

    beforeEach(function () {
        mockedFunctions.githubRequestFnMock = function (_url, _options) {
            url = _url;
            options = _options;
            return githubResponse;
        };
    });

    it('should createIssue', async function() {
        let data = {
            number: 1,
            html_url: "url"
        };
        githubResponse = {
            data
        };
        let response = await createIssue("own", "repo", "title", "message");
        expect(url).to.equal("POST /repos/own/repo/issues");
        expect(options.title).to.equal("title");
        expect(options.body).to.equal("message");
        expect(response).to.eql(data);
    });

    it('should comment on issue', async function() {
        let data = {
            html_url: "url"
        };
        githubResponse = {
            data
        };
        let response = await commentOnIssue("own", "repo", 1, "message");
        expect(url).to.equal("POST /repos/own/repo/issues/1/comments");
        expect(options.body).to.equal("message");
        expect(response).to.eql(data);
    });

    it('should get org details', async function() {
        let data = {
            name: 'Phoenix Code',
            company: null,
            blog: 'https://phcode.dev',
            is_verified: true,
            html_url: 'https://github.com/phcode-dev'
        };
        githubResponse = {
            data
        };
        let response = await getOrgDetails("org");
        expect(url).to.equal("GET /orgs/org");
        expect(options.org).to.equal("org");
        expect(response).to.eql(data);
    });
});
