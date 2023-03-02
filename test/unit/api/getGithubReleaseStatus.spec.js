/*global describe, it*/
import mockedFunctions from "../setupMocks.js";
import * as chai from 'chai';
import {getGithubReleaseStatus, getGetGithubReleaseStatusSchema} from "../../../src/api/getGithubReleaseStatus.js";
import {getSimpleGetReply, getSimpleGETRequest} from '../data/simple-request.js';
import Ajv from "ajv";
import db from "../../../src/db.js";

export const AJV = new Ajv();


let expect = chai.expect;

describe('unit Tests for getGithubReleaseStatus api', function () {
    function _getRequest(owner="owner", repo ="repo", tag= "tag") {
        let request = getSimpleGETRequest();
        request.query.owner = owner;
        request.query.repo = repo;
        request.query.tag = tag;
        return request;
    }

    it('should getGithubReleaseStatus return no such release if no release', async function () {
        let helloResponse = await getGithubReleaseStatus(_getRequest(), getSimpleGetReply());
        expect(helloResponse).eql({
            "errors": [
                "Release not found. IF this is a recent release, please wait for 1 minute before checking again."
            ],
            "status": "NO_SUCH_RELEASE"
        });
    });

    it('should getGithubReleaseStatus return existing release details', async function () {
        db.getFromIndex = function (_tableName) {
            return {
                isSuccess: true,
                documents: [{
                    published: false,
                    status: "PROCESSING",
                    errors: ["oops"],
                    githubIssue: "5",
                    lastUpdatedDateUTC: 1234
                }]};
        };
        let helloResponse = await getGithubReleaseStatus(_getRequest(), getSimpleGetReply());
        expect(helloResponse).eql({
            "errors": [
                "oops"
            ],
            "githubIssue": "5",
            "lastUpdatedDateUTC": 1234,
            "published": false,
            "status": "PROCESSING"
        });
    });

    it('should getGithubReleaseStatus return existing release with optional details', async function () {
        db.getFromIndex = function (_tableName) {
            return {
                isSuccess: true,
                documents: [{
                    published: false,
                    status: "PROCESSING",
                    errors: ["oops"],
                    githubIssue: "5",
                    lastUpdatedDateUTC: 1234,
                    publishedExtensionName: "a.x",
                    publishedVersion: "1.0.0"
                }]};
        };
        let helloResponse = await getGithubReleaseStatus(_getRequest(), getSimpleGetReply());
        expect(helloResponse).eql({
            "errors": [
                "oops"
            ],
            "githubIssue": "5",
            "lastUpdatedDateUTC": 1234,
            "published": false,
            "status": "PROCESSING",
            publishedExtensionName: "a.x",
            publishedVersion: "1.0.0"
        });
    });

    it('should validate schemas for sample request/responses', async function () {
        let request = _getRequest();
        // request
        const requestValidator = AJV.compile(getGetGithubReleaseStatusSchema().schema.querystring);
        expect(requestValidator(request.query)).to.be.true;
        // response
        const successResponseValidator = AJV.compile(getGetGithubReleaseStatusSchema().schema.response["200"]);
        let response = await getGithubReleaseStatus(_getRequest(), getSimpleGetReply());
        expect(successResponseValidator(response)).to.be.true;
    });

    it('should throw if db non success getGithubReleaseStatus', async function () {
        db.getFromIndex = function (_tableName) {
            return {isSuccess: false};
        };
        let error;
        try{
            await getGithubReleaseStatus(_getRequest(), getSimpleGetReply());
        } catch(e){
            error = e;
        }
        expect(error).to.exist;
    });
});
