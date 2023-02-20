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
import {createIssue, commentOnIssue, initGitHubClient, getOrgDetails,
getRepoDetails, getReleaseDetails} from "../../src/github.js";
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

    it('should return null if org doesnt exist', async function() {
        mockedFunctions.githubRequestFnMock = function () {
            throw {
                status: 404
            };
        };
        let response = await getOrgDetails("org");
        expect(response).to.be.null;
    });

    it('should throw if throws with any other error than 404', async function() {
        mockedFunctions.githubRequestFnMock = function () {
            throw {status: 500};
        };
        let errored = false;
        try{
            await getOrgDetails("org");
        } catch(e){
            errored = true;
        }
        expect(errored).to.be.true;
    });

    it('should get repo details', async function() {
        let data = {
            stargazers_count: 3,
            html_url: 'https://github.com/phcode-dev'
        };
        githubResponse = {
            data
        };
        let response = await getRepoDetails("org", "repo");
        expect(url).to.equal("GET /repos/org/repo");
        expect(options.owner).to.equal("org");
        expect(options.repo).to.equal("repo");
        expect(response).to.eql(data);
    });

    it('should return null if repo doesnt exist', async function() {
        mockedFunctions.githubRequestFnMock = function () {
            throw {
                status: 404
            };
        };
        let response = await getRepoDetails("org", "repo");
        expect(response).to.be.null;
    });

    it('should getRepoDetails throw if throws with any other error than 404', async function() {
        mockedFunctions.githubRequestFnMock = function () {
            throw {status: 500};
        };
        let errored = false;
        try{
            await getRepoDetails("org", "repo");
        } catch(e){
            errored = true;
        }
        expect(errored).to.be.true;
    });

    it('should get release details', async function() {
        let data =  {
            html_url: 'https://github.com/tt/wer/releases/tag/dfg',
            draft: false,
            prerelease: false,
            assets: [
                {
                    browser_download_url:
                        'https://github.com/tt/wer/releases/download/dfg/42yeah.aliasing-1.0.0.zip',
                    name: '42yeah.aliasing-1.0.0.zip',
                    size: 718,
                    content_type: 'application/x-zip-compressed'
                }
            ]
        };
        githubResponse = {
            data
        };
        let response = await getReleaseDetails("org", "repo", "releaseRef");
        expect(url).to.equal("GET /repos/org/repo/releases/tags/releaseRef");
        expect(options.owner).to.equal("org");
        expect(options.repo).to.equal("repo");
        expect(response).to.eql(data);
    });

    it('should return null if release doesnt exist', async function() {
        mockedFunctions.githubRequestFnMock = function () {
            throw {
                status: 404
            };
        };
        let response = await getReleaseDetails("org", "repo", "releaseRef");
        expect(response).to.be.null;
    });

    it('should getReleaseDetails throw if throws with any other error than 404', async function() {
        mockedFunctions.githubRequestFnMock = function () {
            throw {status: 500};
        };
        let errored = false;
        try{
            await getReleaseDetails("org", "repo", "releaseRef");
        } catch(e){
            errored = true;
        }
        expect(errored).to.be.true;
    });
});
