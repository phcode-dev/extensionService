/*global describe, it, before, beforeEach, after*/
import mockedFunctions, {setS3Mock} from "../setupMocks.js";
import * as chai from 'chai';
import {initGitHubClient} from "../../../src/github.js";
import {S3} from "../../../src/s3.js";
import db from "../../../src/db.js";
import {_collectStarsWorker} from "../../../src/utils/sync.js";
import {default as registry} from "../data/registry.js";
import {
    EXTENSIONS_BUCKET,
    EXTENSIONS_DETAILS_TABLE,
    FIELD_EXTENSION_ID,
    REGISTRY_FILE
} from "../../../src/constants.js";

let expect = chai.expect;

describe('unit Tests for sync', function () {
    let _getObject, options, githubResponse;

    before(function () {
        initGitHubClient();
        mockedFunctions.githubMock.reset();
        mockedFunctions.githubMock.getRepoDetails("org", "repo");
        _getObject = S3.getObject;
    });

    after(()=>{
        S3.getObject = _getObject;
    });

    let documents = {}, docID = 0;
    beforeEach(function () {
        documents = {};
        db.put = function (tableName, document) {
            let newDocID = "" + docID++;
            documents[tableName + ":" + newDocID] = document;
            return {isSuccess: true, documentId: newDocID};
        };
        setS3Mock(EXTENSIONS_BUCKET, REGISTRY_FILE, JSON.stringify(registry));
        mockedFunctions.githubMock.reset();
        for(let key of Object.keys(registry)){
            let registryEntry = registry[key];
            registryEntry[FIELD_EXTENSION_ID] = key;
            db.put(EXTENSIONS_DETAILS_TABLE, registryEntry);
            if(registryEntry.ownerRepo) {
                let repoSplit = registryEntry.ownerRepo.split("/");//"https://github.com/Brackets-Themes/808"
                const repo = repoSplit[repoSplit.length-1],
                    owner = repoSplit[repoSplit.length-2];
                mockedFunctions.githubMock.getRepoDetails(owner, repo, 2345);
            }
        }
        db.getFromIndex = function (tableName, queryObject) {
            let keys = Object.keys(documents);
            let foundDocs =[];
            for(let key of keys){
                if(key.startsWith(tableName+":")){
                    let doc = documents[key];
                    let qKeys = Object.keys(queryObject);
                    for (let qkey of qKeys){
                        if(doc[qkey] === queryObject[qkey]){
                            foundDocs.push(doc);
                        }
                    }
                }
            }
            return {isSuccess: true,
                documents:foundDocs
            };
        };
        db.update = function () {
            return {isSuccess: true,
                documents:[]
            };
        };
    });

    it('_collectStarsWorker collect stars', async function () {
        let {collectedStarsForExtensions, extensionsStarsCollectedToday} = await _collectStarsWorker();
        extensionsStarsCollectedToday = structuredClone(extensionsStarsCollectedToday);
        expect(extensionsStarsCollectedToday.length).to.gte(collectedStarsForExtensions.length);
        const queryObj = {};
        queryObj[FIELD_EXTENSION_ID] = collectedStarsForExtensions[0];
        let status = await db.getFromIndex(EXTENSIONS_DETAILS_TABLE, queryObj);
        expect(status.isSuccess).to.be.true;
        expect(status.documents[0].gihubStars).eq(2345);
        // run again
        let newRun = await _collectStarsWorker();
        expect(newRun.extensionsStarsCollectedToday.length).to.gt(extensionsStarsCollectedToday.length);
        expect(newRun.collectedStarsForExtensions.length).to.eq(collectedStarsForExtensions.length);
        for(let extension of newRun.collectedStarsForExtensions){
            expect(collectedStarsForExtensions.includes(extension)).to.be.false;
        }
        // now run it a few times so that all extension stars collected
        while(newRun.collectedStarsForExtensions.length){
            newRun = await _collectStarsWorker();
        }
        newRun = await _collectStarsWorker();
        expect(newRun.extensionsStarsCollectedToday.length).to.eq(Object.keys(registry).length);
        expect(newRun.collectedStarsForExtensions.length).to.eq(0);
    });

});
