import follow from 'follow-redirects';
import fs from 'fs';
import path from "path";

/* c8 ignore start */
// not testing this as no time and is manually tested. If you are touching this code, manual test thoroughly
/**
 * downloads a file to a given path
 * @param {string} url
 * @param {string} downloadFilePath Full path of the form /a/f/extension.zip
 * @return {Promise<>}
 */
function downloadFile(url, downloadFilePath) {
    return new Promise((resolve, reject)=>{
        const dir = path.dirname(downloadFilePath);
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        const file = fs.createWriteStream(downloadFilePath);
        follow.https.get(url, function(response) {
            response.pipe(file);
            file.on('finish', function() {
                console.log("Download complete ", url, downloadFilePath);
                file.close(resolve);  // close() is async, call cb after close completes.
            });
        }).on('error', function(err) { // Handle errors
            console.error("Error downloading ", url, downloadFilePath);
            fs.unlink(downloadFilePath, console.error); // Delete the file async. (But we don't check the result)
            reject(err);
        });
    });
}
/* c8 ignore stop */

export const downloader = {
    downloadFile
};
