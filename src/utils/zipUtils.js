import StreamZipAsync from 'node-stream-zip';

/* c8 ignore start */
// not testing this as no time and is manually tested. If you are touching this code, manual test thoroughly
/**
 * Resolves the contents of the package.json file if a valid package.json file is found in extension. Else rejects.
 * package.json can be in the root zip dir as "package.json" or in a single child sub dir like "extension/package.json"
 * @param zipPath
 * @return {Promise<unknown>}
 */
function getExtensionPackageJSON(zipPath) {
    return new Promise((resolve)=>{
        const zip = new StreamZipAsync.async({ file: zipPath });
        const rootFolders = {};
        let packageJSONFilePaths = {};
        zip.entries().then(entries=>{
            for (const entry of Object.values(entries)) {
                let pathSplit = entry.name.split("/");
                if(entry.isDirectory){
                    rootFolders[pathSplit[0]] = true;
                } else if(entry.name === "package.json" || entry.name.endsWith("/package.json")) {
                    packageJSONFilePaths[entry.name] = entry;
                }
            }
            // if package.json is in the root folder ni zip, return that
            if(packageJSONFilePaths['package.json']) {
                zip.entryData('package.json')
                    .then(data => {
                        resolve({packageJSON: data.toString()});
                    })
                    .catch(()=>{
                        resolve({error: "Invalid Zip file. Could not find package.json from the extension zip"});
                    });
                return;
            }
            // Extension authors sometimes submits zip file with extension contents in single subdirectory. So
            // check if it is a single sub dir in the zip and then check if that sub dir has a package.json
            // remove turds that MacOs drops in zip files.
            delete rootFolders["__MACOSX"];
            delete rootFolders[".DS_Store"];
            delete rootFolders["._fileName"];
            let subDirectoriesOfRoot = Object.keys(rootFolders);
            if(subDirectoriesOfRoot.length !== 1 || !packageJSONFilePaths[`${subDirectoriesOfRoot[0]}/package.json`]){
                // multiple subdirectories are not allowed if the root dir doesn't contain package.json
                console.log("Could not find package.json from the extension zip", zipPath);
                resolve({error: "Invalid Zip file. Could not find package.json from the extension zip"});
                return;
            }
            zip.entryData(`${subDirectoriesOfRoot[0]}/package.json`)
                .then(data => {
                    resolve({packageJSON: data.toString()});
                })
                .catch(()=>{
                    resolve({error: "Invalid Zip file. Could not find package.json from the extension zip"});
                });
        }).catch(err=>{
            console.error(`Error reading Zip: ${zipPath}`, err);
            resolve({error: "Error reading Zip File: The Zip File may be corrupted."});
        });
    });
}
/* c8 ignore stop */

export const ZipUtils = {
    getExtensionPackageJSON
};
