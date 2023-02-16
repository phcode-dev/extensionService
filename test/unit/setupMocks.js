import * as chai from 'chai';
import db from "../../src/db.js";
import {s3} from "../../src/s3.js";

let expect = chai.expect;

let setupDone = false;
let mockedFunctions = {
    db,
    s3MockedKeyValues:{}
};

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
    db.createDb = db.createTable = db.createIndex = db.put = db.update = successMock;
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

    s3.S3Client = class s3c{
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

    s3.GetObjectCommand = function ({ Bucket, Key }){
        return { Bucket, Key, type: "get"};
    };

    s3.PutObjectCommand = function ({ Bucket, Key, Body }){
        return { Bucket, Key, type: "put", thingToPut: Body};
    };
}

_setup();

export function setS3Mock(bucket, key, contents) {
    mockedFunctions.s3MockedKeyValues[bucket+"#"+key] = contents;
}

export default mockedFunctions;