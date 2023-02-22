/*global describe, it, beforeEach, before*/
import mockedFunctions from "../setupMocks.js";
import * as chai from 'chai';
import db from "../../../src/db.js";
import {publishGithubRelease, getPublishGithubReleaseSchema} from "../../../src/api/publishGithubRelease.js";
import {getSimpleGetReply, getSimpleGETRequest} from '../data/simple-request.js';
import Ajv from "ajv";
import {initGitHubClient} from "../../../src/github.js";

export const AJV = new Ajv();


let expect = chai.expect;

describe('unit Tests for publishGithubRelease api', function () {
    let request, reply;

    before(function () {
        initGitHubClient();
        mockedFunctions.githubMock.reset();
        mockedFunctions.githubMock.getRepoDetails("org", "repo");
        mockedFunctions.githubMock.getReleaseDetails("org", "repo", "gitTag");
    });

    beforeEach(function () {
        request = getSimpleGETRequest();
        reply = getSimpleGetReply();
        request.query.releaseRef = "org/repo:refs/tags/gitTag";
    });

    it('should publishGithubRelease', async function () {
        let helloResponse = await publishGithubRelease(request, reply);
        expect(helloResponse).eql({message: 'done'});
    });

    it('should validate schemas for sample request/responses', async function () {
        // request
        const requestValidator = AJV.compile(getPublishGithubReleaseSchema().schema.querystring);
        expect(requestValidator(request.query)).to.be.true;
        // response
        const successResponseValidator = AJV.compile(getPublishGithubReleaseSchema().schema.response["200"]);
        let response = await publishGithubRelease(request, reply);
        expect(successResponseValidator(response)).to.be.true;
    });

    async function _testBadRequest(releaseRef) {
        request.query.releaseRef = releaseRef;
        let helloResponse = await publishGithubRelease(request, reply);
        expect(reply.statusCode).to.eq(400);
        expect(helloResponse).eql("Expected releaseRef of the form <org>/<repo>:refs/tags/<dfg>");
    }
    it('should fail publishGithubRelease for bad request', async function () {
        await _testBadRequest("");
        await _testBadRequest("a:b/sd/f/f");
        await _testBadRequest("org/repo:refs/tags/");
        await _testBadRequest("org/repo/:refs/tags/");
        await _testBadRequest("org/:refs/tags/");
        await _testBadRequest("org/repo/:refs/tag/");
    });

    it('should return bad request if repo not found for publishGithubRelease', async function () {
        request.query.releaseRef = "org/repoNotFound:refs/tags/gitTag";
        let helloResponse = await publishGithubRelease(request, reply);
        expect(reply.statusCode).to.eq(400);
        expect(helloResponse).eql("Repo org/repoNotFound doesnt exist or is not accessible.");
    });

    it('should throw if unexpected error in publishGithubRelease', async function () {
        request.query.releaseRef = 123;
        let errorThrown = false;
        try {
            await publishGithubRelease(request, reply);
        } catch (e) {
            errorThrown = true;
        }
        expect(errorThrown).to.be.true;
    });

    it('should throw if get release details from db errors out', async function () {
        let tableName;
        db.getFromIndex = function (_tableName) {
            tableName = _tableName;
            return {isSuccess: false};
        };
        let errorThrown = false;
        try {
            await publishGithubRelease(request, reply);
        } catch (e) {
            errorThrown = true;
        }
        expect(errorThrown).to.be.true;
        expect(tableName).to.eq("phcode_extensions_test.releaseDetails");
    });

    it('should return bad request if release already published', async function () {
        db.getFromIndex = function (_tableName) {
            return {isSuccess: true,
                documents:[{published: true}]
            };
        };
        let response = await publishGithubRelease(request, reply);
        expect(reply.statusCode).to.eq(400);
        expect(response).eql("Release org/repo/gitTag already published!");
    });

    it('should return bad request if no such release', async function () {
        request.query.releaseRef = "org/repo:refs/tags/gitTag2";
        db.getFromIndex = function (_tableName) {
            return {isSuccess: true,
                documents:[]
            };
        };
        let response = await publishGithubRelease(request, reply);
        expect(reply.statusCode).to.eq(400);
        expect(response).eql("Release org/repo/gitTag2 not found in GitHub");
    });
});
