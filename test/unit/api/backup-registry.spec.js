/*global describe, it*/
import {setS3Mock} from "../setupMocks.js";
import * as chai from 'chai';
import {backupRegistry, getArchiveObjectPath} from "../../../src/api/backup-registry.js";
import {getObject} from "../../../src/s3.js";
import {REGISTRY_FILE, REGISTRY_VERSION_FILE, POPULARITY_FILE} from "../../../src/constants.js";

let expect = chai.expect;
const bucket = "phcode-extensions-test";

describe('unit Tests for setupStack api', function () {

    it('should backupRegistry', async function() {
        setS3Mock(bucket, REGISTRY_FILE, "h1");
        setS3Mock(bucket, REGISTRY_VERSION_FILE, "h2");
        setS3Mock(bucket, POPULARITY_FILE, "h3");
        let response = await backupRegistry();
        expect(response.status).to.equal("done");
        let s3Obj = await getObject(bucket, getArchiveObjectPath(REGISTRY_FILE));
        expect(s3Obj).to.equal("h1");
        s3Obj = await getObject(bucket, getArchiveObjectPath(REGISTRY_VERSION_FILE));
        expect(s3Obj).to.equal("h2");
        s3Obj = await getObject(bucket, getArchiveObjectPath(POPULARITY_FILE));
        expect(s3Obj).to.equal("h3");
    });
});
