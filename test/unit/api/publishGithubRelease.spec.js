/*global describe, it, beforeEach, before*/
import mockedFunctions from "../setupMocks.js";
import * as chai from 'chai';
import db from "../../../src/db.js";
import {downloader} from "../../../src/utils/downloader.js";
import {ZipUtils} from "../../../src/utils/zipUtils.js";
import {publishGithubRelease, getPublishGithubReleaseSchema} from "../../../src/api/publishGithubRelease.js";
import {getSimpleGetReply, getSimpleGETRequest} from '../data/simple-request.js';
import {VALID_PACKAGE_JSON} from "../data/packagejson.js";
import registryJSON from "../data/registry.js";
import Ajv from "ajv";
import {initGitHubClient} from "../../../src/github.js";
import {EXTENSION_SIZE_LIMIT_MB} from "../../../src/constants.js";
import {S3} from '../../../src/s3.js';

export const AJV = new Ajv();


let expect = chai.expect;

describe('unit Tests for publishGithubRelease api', function () {
    let request, reply;

    before(function () {
        initGitHubClient();
        mockedFunctions.githubMock.reset();
        mockedFunctions.githubMock.getRepoDetails("org", "repo");
        mockedFunctions.githubMock.getReleaseDetails("org", "repo", "gitTag");
        mockedFunctions.githubMock.getOrgDetails("org");
        downloader.downloadFile = async function () {
            return "/path/to/file.zip";
        };
        ZipUtils.getExtensionPackageJSON = function () {
            return {packageJSON: VALID_PACKAGE_JSON};
        };
    });

    beforeEach(function () {
        request = getSimpleGETRequest();
        reply = getSimpleGetReply();
        request.query.releaseRef = "org/repo:refs/tags/gitTag";
        db.getFromIndex = function (_tableName) {
            return {isSuccess: true,
                documents:[]
            };
        };
    });

    async function _testPublishSuccess() {
        let bucket, key, filePathToUpload;
        S3.uploadFile = function (_bucket, _key, _filePathToUpload) {
            bucket = _bucket; key = _key; filePathToUpload = _filePathToUpload;
        };
        let helloResponse = await publishGithubRelease(request, reply);
        expect(helloResponse).eql({message: 'done'});
        expect(bucket).eql("phcode-extensions-test");
        expect(key).eql("extensions/angular.moduler-0.0.1.zip");
        expect(filePathToUpload.endsWith("downloads/org_repo_gitTag_extension.zip")).to.be.true;
        return helloResponse;
    }

    it('should publishGithubRelease', async function () {
        await _testPublishSuccess();
    });

    it('should validate schemas for sample request/responses', async function () {
        // request
        const requestValidator = AJV.compile(getPublishGithubReleaseSchema().schema.querystring);
        expect(requestValidator(request.query)).to.be.true;
        // response
        const successResponseValidator = AJV.compile(getPublishGithubReleaseSchema().schema.response["200"]);
        let response = await _testPublishSuccess();
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
        let response = await publishGithubRelease(request, reply);
        expect(reply.statusCode).to.eq(400);
        expect(response).eql("Release org/repo/gitTag2 not found in GitHub");
    });

    it('should return bad request if extension.zip not attached in release', async function () {
        mockedFunctions.githubMock.getReleaseDetails("org", "repo", "gitTag3", "nop.zip");
        request.query.releaseRef = "org/repo:refs/tags/gitTag3";
        db.getFromIndex = function (_tableName) {
            return {isSuccess: true,
                documents:[]
            };
        };
        let response = await publishGithubRelease(request, reply);
        expect(reply.statusCode).to.eq(400);
        expect(response).eql("Release does not contain required `extension.zip` file attached.");
    });

    it('should return bad request if extension.zip greater than 50MB', async function () {
        mockedFunctions.githubMock.getReleaseDetails("org", "repo", "gitTag3", "extension.zip",
            EXTENSION_SIZE_LIMIT_MB*1024*1024+1);
        request.query.releaseRef = "org/repo:refs/tags/gitTag3";
        db.getFromIndex = function (_tableName) {
            return {isSuccess: true,
                documents:[]
            };
        };
        let response = await publishGithubRelease(request, reply);
        expect(reply.statusCode).to.eq(400);
        expect(response).eql(`Attached \`extension.zip\` file should be smaller than ${EXTENSION_SIZE_LIMIT_MB}MB`);
    });
});
