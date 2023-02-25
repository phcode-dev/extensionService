import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import {Upload} from "@aws-sdk/lib-storage";
import {accessKeyId, secretAccessKey} from "./constants.js";
import {createWriteStream, createReadStream} from "fs";

export const _s3 = {
    S3Client,
    GetObjectCommand,
    PutObjectCommand
};

let client;

function _initClient() {
    if(client){
        return;
    }
    client = new _s3.S3Client({
        region: "us-east-1",
        credentials: {
            accessKeyId,
            secretAccessKey
        }
    });
}

/**
 *
 * @param Bucket
 * @param Key
 * @return {Promise<string>}
 */
function getObject (Bucket, Key) {
    _initClient();
    return new Promise((resolve, reject) => {
        const getObjectCommand = new _s3.GetObjectCommand({ Bucket, Key });
        console.log(`getting ${Bucket} : ${Key}`);
        client.send(getObjectCommand)
            .then((response)=>{
                // Store all of data chunks returned from the response data stream
                // into an array then use Array#join() to use the returned contents as a String
                let responseDataChunks = [];

                // Handle an error while streaming the response body
                response.Body.once('error', err => reject(err));

                // Attach a 'data' listener to add the chunks of data to our array
                // Each chunk is a Buffer instance
                response.Body.on('data', chunk => responseDataChunks.push(chunk));

                // Once the stream has no more data, join the chunks into a string and return the string
                response.Body.once('end', () => resolve(responseDataChunks.join('')));
            })
            .catch(reject);
    });
}

/* c8 ignore start */
// not testing this as no time and is manually tested. If you are touching this code, manual test thoroughly
function downloadFile(Bucket, Key, targetPath) {
    _initClient();
    return new Promise((resolve, reject) => {
        const getObjectCommand = new _s3.GetObjectCommand({ Bucket, Key });
        console.log(`downloading file ${Bucket} : ${Key}`);
        client.send(getObjectCommand)
            .then(response=>{
                const inputStream = response.Body;
                const outputStream = createWriteStream(targetPath);
                inputStream.pipe(outputStream);
                outputStream
                    .on('error', err => reject(err))
                    .on('finish', () => resolve());
            })
            .catch(reject);
    });
}

// not testing this as no time and is manually tested. If you are touching this code, manual test thoroughly
async function uploadFile(Bucket, Key, filePathToUpload){
    _initClient();
    console.log(`uploading file ${Bucket} : ${Key}`);
    const params = {
        Bucket,
        Key,
        Body: createReadStream(filePathToUpload)
    };

    const upload = new Upload({
        client,
        params
    });

    return upload.done();
}
/* c8 ignore stop */

function putObject (Bucket, Key, str) {
    _initClient();
    return new Promise((resolve, reject) => {
        const putObjectCommand = new _s3.PutObjectCommand({ Bucket, Key,
            Body: str
        });
        console.log(`putting ${Bucket} : ${Key}`);
        client.send(putObjectCommand)
            .then(resolve)
            .catch(reject);
    });
}

export const S3 = {
    getObject,
    putObject,
    downloadFile,
    uploadFile
};
