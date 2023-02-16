/*global describe, it*/
import {setS3Mock} from "../setupMocks.js";
import * as chai from 'chai';
import {setupStackForStage} from "../../../src/api/setup-stack.js";
import db from "../../../src/db.js";
import {default as registry} from "../data/registry.js";

let expect = chai.expect;
const bucket = "phcode-extensions-test";

describe('unit Tests for setupStack api', function () {

    it('should setupStackForStage', async function() {
        setS3Mock(bucket, "registry.json", JSON.stringify(registry));
        let createDbParam = "";
        db.createDb = function (dbName) {
            createDbParam = dbName;
        };
        let response = await setupStackForStage();
        expect(createDbParam).to.equal('phcode_extensions_test');
        expect(response.status).to.equal("done");
    });
});
