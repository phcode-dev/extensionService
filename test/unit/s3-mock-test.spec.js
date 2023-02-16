// Testing framework: Mocha , assertion style: chai
// See https://mochajs.org/#getting-started on how to write tests
// Use chai for BDD style assertions (expect, should etc..). See move here: https://www.chaijs.com/guide/styles/#expect

// Mocks and spies: sinon
// if you want to mock/spy on fn() for unit tests, use sinon. refer docs: https://sinonjs.org/

// Note on coverage suite used here:
// we use c8 for coverage https://github.com/bcoe/c8. Its reporting is based on nyc, so detailed docs can be found
// here: https://github.com/istanbuljs/nyc ; We didn't use nyc as it do not yet have ES module support
// see: https://github.com/digitalbazaar/bedrock-test/issues/16 . c8 is drop replacement for nyc coverage reporting tool
/*global describe, it*/

import {setS3Mock} from "./setupMocks.js";
import {getObject, putObject} from "../../src/s3.js";
import * as chai from 'chai';

let expect = chai.expect;

describe('s3 mock Tests', function() {
    it('should reject if object not there', async function() {
        let err = false;
        try{
            await getObject("bucket", "key");
        } catch (e) {
            err = e;
        }
        expect(err).to.equal("not found: bucket,key");
    });

    it('should mock object', async function() {
        setS3Mock("t1", "t2", "hello");
        let s3Obj = await getObject("t1", "t2");
        expect(s3Obj).to.equal("hello");
    });

    it('should mock put and get object', async function() {
        await putObject("t1", "t2", "hello world");
        let s3Obj = await getObject("t1", "t2");
        expect(s3Obj).to.equal("hello world");
    });
});
