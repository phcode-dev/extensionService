import * as chai from 'chai';
import db from "../../src/db.js";
import {_s3} from "../../src/s3.js";
import {_gitHub} from "../../src/github.js";

let expect = chai.expect;

let setupDone = false;

let getOrgDetailsResponses = {},
    getRepoDetailsResponses = {},
    getReleaseDetailsResponses = {};
async function githubRequestFnMock(url, options) {
    if(url.startsWith("GET /orgs/")){ // getOrgDetails api
        if(getOrgDetailsResponses[`${options.owner}`]) {
            return getOrgDetailsResponses[`${options.owner}`];
        }
        throw {status: 404};
    }
    if(url.startsWith("GET /repos/") && !url.includes("/releases/tags/")){ // getRepoDetails api
        if(getRepoDetailsResponses[`${options.owner}/${options.repo}`]) {
            return getRepoDetailsResponses[`${options.owner}/${options.repo}`];
        }
        throw {status: 404};
    }
    if(url.startsWith("GET /repos/") && url.includes("/releases/tags/")){ // getRepoDetails api
        if(getReleaseDetailsResponses[`${options.owner}/${options.repo}/${options.tag}`]) {
            return getReleaseDetailsResponses[`${options.owner}/${options.repo}/${options.tag}`];
        }
        throw {status: 404};
    }
    if(url.startsWith("POST /repos/") && url.endsWith("/issues") ){ // issue related api
        return  {
            data: {
                number: 1,
                html_url: "https://github.com/owner/repo/issues/1"
            }
        };
    }
    if(url.startsWith("POST /repos/") && url.endsWith("/comments") ){ // issue related api
        return  {
            data: {
                html_url: "https://github.com/owner/repo/issues/1#issuecomment-1370538185"
            }
        };
    }
}

const MOCKED_ENV_VAR = "mocked_env_var";

function _setup() {
    if (setupDone) {
        return;
    }
    db.init = function (url, apiKey){
        console.log("coco init mocked");
        expect(url).to.equal(MOCKED_ENV_VAR);
        expect(apiKey).to.equal(MOCKED_ENV_VAR);
    };
    async function successMock(...args) {
        return {
            isSuccess: true
        };
    };
    db.createDb = db.createTable = db.createIndex = db.put = db.update = db.mathAdd = successMock;
    db.getFromIndex = (...args)=>{
        return {
            isSuccess: true,
            documents: []
        };
    };
    const requiredEnvVars = ["cocoEndPoint", "cocoAuthKey", "stage"];
    for (let envName of requiredEnvVars){
        process.env[envName] = MOCKED_ENV_VAR;
    }

    _s3.S3Client = class s3c{
        constructor(param) {
            expect(param.region).eq("us-east-1");
        }
        async send({ Bucket, Key, type, thingToPut }){
            function getHandler(type, cb) {
                if(type === 'data'){
                    if(typeof mockedFunctions.s3MockedKeyValues[Bucket+"#"+Key] !== "undefined"){
                        cb(mockedFunctions.s3MockedKeyValues[Bucket+"#"+Key]);
                    }
                } else if(type === 'end'){
                    cb();
                } else if(type === 'error'){
                    if(!mockedFunctions.s3MockedKeyValues[Bucket+"#"+Key]){
                        cb("not found: "+Bucket+","+Key);
                    }
                }
            }
            if(type === "get"){
                return{
                    Body:{
                        on: getHandler,
                        once: getHandler
                    }
                };
            }else if(type === "put"){
                mockedFunctions.s3MockedKeyValues[Bucket+"#"+Key] = thingToPut;
            }
        }
    };

    _s3.GetObjectCommand = function ({ Bucket, Key }){
        return { Bucket, Key, type: "get"};
    };

    _s3.PutObjectCommand = function ({ Bucket, Key, Body }){
        return { Bucket, Key, type: "put", thingToPut: Body};
    };

    _gitHub.Octokit = class Octokit{
        constructor(param) {
            expect(param.auth).eq("githubToken");
            expect(param.userAgent).eq("phcode.dev extensions service");
        }
        async request(...args){
            return mockedFunctions.githubRequestFnMock(...args);
        }
    };
}

_setup();

export function setS3Mock(bucket, key, contents) {
    mockedFunctions.s3MockedKeyValues[bucket+"#"+key] = contents;
}

/**
 * mocks existance of the repo for github::getRepoDetails api
 * @param org
 * @param repo
 */
export function getRepoDetails(org, repo) {
    mockedFunctions.githubRequestFnMock = githubRequestFnMock;
    getRepoDetailsResponses[`${org}/${repo}`] = {
        data: {
            stargazers_count: 3,
            html_url: `https://github.com/${org}/${repo}`
        }
    };
}

export function getOrgDetails(org) {
    mockedFunctions.githubRequestFnMock = githubRequestFnMock;
    getOrgDetailsResponses[`${org}`] = {
        data: {
            name: org,
            company: org,
            blog: `https://org`,
            is_verified: true,
            html_url: 'https://github.com/org'
        }
    };
}

export function getReleaseDetails(owner, repo, tag, assetName = 'extension.zip', size = 1024) {
    mockedFunctions.githubRequestFnMock = githubRequestFnMock;
    getReleaseDetailsResponses[`${owner}/${repo}/${tag}`] = {
        data: {
            html_url: `https://github.com/${owner}/${repo}/releases/tag/${tag}`,
            draft: false,
            prerelease: false,
            assets: [
                {
                    browser_download_url:
                        'https://download/extension.zip',
                    name: assetName,
                    size,
                    content_type: 'application/x-zip-compressed'
                }
            ]
        }
    };
}


let mockedFunctions = {
    db,
    s3MockedKeyValues: {},
    githubRequestFnMock, // you should almost always use githubMock instead of githubRequestFnMock
    githubMock: {
        getOrgDetails,
        getRepoDetails,
        getReleaseDetails,
        reset: function () {
            getRepoDetailsResponses = {};
            getReleaseDetailsResponses = {};
        }
    }
};
export default mockedFunctions;
