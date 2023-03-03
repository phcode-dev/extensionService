/*global describe, it, before, after, beforeEach*/
import mockedFunctions from "../setupMocks.js";
import * as chai from 'chai';
import {countDownload, getCountDownloadSchema} from "../../../src/api/countDownload.js";
import {getSimpleGetReply, getSimpleGETRequest} from '../data/simple-request.js';
import {REGISTRY_PACKAGE_JSON, VALID_PACKAGE_JSON} from '../data/packagejson.js';
import Ajv from "ajv";
import db from "../../../src/db.js";

export const AJV = new Ajv();


let expect = chai.expect;

describe('unit Tests for countDownload api', function () {
    let savedGetFromIndex, savedMathAdd;
    before(()=>{
        savedGetFromIndex = db.getFromIndex;
        savedMathAdd = db.mathAdd;
    });
    after(()=>{
        db.getFromIndex = savedGetFromIndex;
        db.mathAdd = savedMathAdd;
    });
    beforeEach(function () {
        db.getFromIndex = function (_tableName) {
            return {
                isSuccess: true,
                documents: [REGISTRY_PACKAGE_JSON]};
        };
        db.mathAdd  = function (_tableName) {
            return {
                isSuccess: true
            };
        };
    });
    function _getRequest(extensionName="ext.name", extensionVersion ="0.0.1") {
        let request = getSimpleGETRequest();
        request.query.extensionName = extensionName;
        request.query.extensionVersion = extensionVersion;
        return request;
    }

    it('should countDownload throw if db get failed', async function () {
        db.getFromIndex = function (_tableName) {
            return {isSuccess: false};
        };
        let error;
        try{
            await countDownload(_getRequest(), getSimpleGetReply());
        } catch(e){
            error = e;
        }
        expect(error.message).eql("Error getting extensionPKG details from db: ext.name");
    });
    it('should countDownload throw if no such extension', async function () {
        db.getFromIndex = function (_tableName) {
            return {isSuccess: true, documents:[]};
        };
        let error;
        try{
            await countDownload(_getRequest(), getSimpleGetReply());
        } catch(e){
            error = e;
        }
        expect(error.message).eql("No such extension");
    });
    it('should countDownload throw if no such extension version', async function () {
        let error;
        try{
            await countDownload(_getRequest("dd", "1.2.3"), getSimpleGetReply());
        } catch(e){
            error = e;
        }
        expect(error.message).eql("No such extension version");
    });

    it('should countDownload increment download', async function () {
        let helloResponse = await countDownload(_getRequest(), getSimpleGetReply());
        expect(helloResponse).eql({
            "message": "Done"
        });
    });

    it('should countDownload failed is failed to increment in db', async function () {
        db.mathAdd  = function (_tableName) {return {isSuccess: false};};
        let error;
        try{
            await countDownload(_getRequest(), getSimpleGetReply());
        } catch(e){
            error = e;
        }
        expect(error.message).eql("Could not increment download count.");
    });

    it('should validate schemas for sample request/responses', async function () {
        let request = _getRequest();
        // request
        const requestValidator = AJV.compile(getCountDownloadSchema().schema.querystring);
        expect(requestValidator(request.query)).to.be.true;
        // remove a required field
        delete request.query.extensionName;
        expect(requestValidator(request.query)).to.be.false;
        // response
        const successResponseValidator = AJV.compile(getCountDownloadSchema().schema.response["200"]);
        let response = await countDownload(_getRequest(), getSimpleGetReply());
        expect(successResponseValidator(response)).to.be.true;
    });
});
