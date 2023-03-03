/*global describe, it, before, beforeEach, after*/
import mockedFunctions, {setS3Mock} from "../setupMocks.js";
import * as chai from 'chai';
import {initGitHubClient} from "../../../src/github.js";
import {S3} from "../../../src/s3.js";
import db from "../../../src/db.js";
import {_collectStarsWorker, _syncPopularityEvery15Minutes} from "../../../src/utils/sync.js";
import {default as registry} from "../data/registry.js";
import {default as popularity} from "../data/popularity.js";
import {
    EXTENSIONS_BUCKET,
    EXTENSIONS_DETAILS_TABLE,
    FIELD_EXTENSION_ID, POPULARITY_FILE,
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
            document.documentId = newDocID;
            return {isSuccess: true, documentId: newDocID};
        };
        setS3Mock(EXTENSIONS_BUCKET, REGISTRY_FILE, JSON.stringify(registry));
        setS3Mock(EXTENSIONS_BUCKET, POPULARITY_FILE, JSON.stringify(popularity));
        mockedFunctions.githubMock.reset();
        mockedFunctions.githubMock.getRepoDetails("org", "repo");
        for(let key of Object.keys(registry)){
            let registryEntry = structuredClone(registry[key]);
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
        db.update = function (tableName, documentID, document) {
            if(!documents[tableName + ":" + documentID]){
                return {isSuccess: false};
            }
            documents[tableName + ":" + documentID] = document;
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

    it('_syncPopularityEvery15Minutes create extension and popularity json', async function () {
        let oldRegistry = JSON.parse(await S3.getObject(EXTENSIONS_BUCKET, REGISTRY_FILE));
        let oldPopularity = JSON.parse(await S3.getObject(EXTENSIONS_BUCKET, POPULARITY_FILE));

        // make some changes to total downloads and github stars
        for (let entry of Object.keys(oldRegistry)) {
            entry = oldRegistry[entry];
            const queryObj = {};
            queryObj[FIELD_EXTENSION_ID] = entry.metadata.name;
            let status = await db.getFromIndex(EXTENSIONS_DETAILS_TABLE, queryObj);
            expect(status.isSuccess).to.be.true;
            let document = status.documents[0];
            document.gihubStars = 5577;
            document.totalDownloads = 987654321;
            status = await db.update(EXTENSIONS_DETAILS_TABLE, document.documentId, document);
            expect(status.isSuccess).to.be.true;
        }

        await _syncPopularityEvery15Minutes();
        let registry = JSON.parse(await S3.getObject(EXTENSIONS_BUCKET, REGISTRY_FILE));
        let popularity = JSON.parse(await S3.getObject(EXTENSIONS_BUCKET, POPULARITY_FILE));
        expect(registry["808"].gihubStars).eq(5577);
        expect(oldRegistry["808"].gihubStars).not.eq(registry["808"].gihubStars);
        expect(popularity["808"].gihubStars).eq(5577);
        expect(oldPopularity["808"].gihubStars).not.eq(popularity["808"].gihubStars);
        expect(registry["808"].totalDownloads).eq(987654321);
        expect(oldRegistry["808"].totalDownloads).not.eq(registry["808"].totalDownloads);
        expect(popularity["808"].totalDownloads).eq(987654321);
        expect(oldPopularity["808"].totalDownloads).not.eq(popularity["808"].totalDownloads);
    });

});
