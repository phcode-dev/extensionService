/*global describe, it, beforeEach*/
import * as chai from 'chai';
import {publishGithubRelease, getPublishGithubReleaseSchema} from "../../../src/api/publishGithubRelease.js";
import {getSimpleGetReply, getSimpleGETRequest} from '../data/simple-request.js';
import Ajv from "ajv";

export const AJV = new Ajv();


let expect = chai.expect;

describe('unit Tests for publishGithubRelease api', function () {
    let request, reply;
    beforeEach(function () {
        request = getSimpleGETRequest();
        reply = getSimpleGetReply();
        request.query.releaseRef = "test";
    });

    it('should publishGithubRelease', async function () {
        request.query.releaseRef = "org/repo:refs/tags/gitTag";
        let helloResponse = await publishGithubRelease(request, reply);
        expect(helloResponse).eql({message: 'done'});
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

    it('should validate schemas for sample request/responses', async function () {
        // request
        request.query.releaseRef = "org/repo:refs/tags/gitTag";
        const requestValidator = AJV.compile(getPublishGithubReleaseSchema().schema.querystring);
        expect(requestValidator(request.query)).to.be.true;
        // response
        const successResponseValidator = AJV.compile(getPublishGithubReleaseSchema().schema.response["200"]);
        let response = await publishGithubRelease(request, reply);
        expect(successResponseValidator(response)).to.be.true;
    });
});
