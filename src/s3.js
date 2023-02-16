import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import {accessKeyId, secretAccessKey} from "./constants.js";

export const s3 = {
    S3Client,
    GetObjectCommand,
    PutObjectCommand
};

let client;

function _initClient() {
    if(client){
        return;
    }
    client = new s3.S3Client({
        region: "us-east-1",
        credentials: {
            accessKeyId,
            secretAccessKey
        }
    });
}

export function getObject (Bucket, Key) {
    _initClient();
    return new Promise(async (resolve, reject) => {
        const getObjectCommand = new s3.GetObjectCommand({ Bucket, Key });

        try {
            console.log(`getting ${Bucket} : ${Key}`);
            const response = await client.send(getObjectCommand);

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
        } catch (err) {
            // Handle the error or throw
            return reject(err);
        }
    });
}

export function putObject (Bucket, Key, str) {
    _initClient();
    return new Promise(async (resolve, reject) => {
        const putObjectCommand = new s3.PutObjectCommand({ Bucket, Key,
            Body: str
        });

        try {
            console.log(`putting ${Bucket} : ${Key}`);
            const response = await client.send(putObjectCommand);
            resolve(response);
        } catch (err) {
            // Handle the error or throw
            return reject(err);
        }
    });
}
