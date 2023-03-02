/*globals window, document, location*/
const urlParams = new URLSearchParams(window.location.search);
document.title = `${urlParams.get('tag')} Release Publish status`;
const owner = urlParams.get('owner'),
    repo = urlParams.get('repo'),
    tag = urlParams.get('tag');
function _addError(errorMessage) {
    let errorNode = document.getElementById("publishErrorList");
    errorNode.innerHTML = errorNode.innerHTML + `<div
        class="alert alert-danger alert-dismissible fade show"
        role="alert">
        ${errorMessage}
        </div>`;
}

function retryRelease() {
    document.getElementById("retryRelease").setAttribute('disabled', '');
    document.getElementById("retryRelease").textContent = "Publishing....";
    fetch(`../../publishGithubRelease?releaseRef=${owner}/${repo}:refs/tags/${tag}`)
        .finally(()=>{
            location.reload();
        });
}

function showStatus() {
    fetch(`../../getGithubReleaseStatus?owner=${owner}&repo=${repo}&tag=${tag}`).then(async result=>{
        let releaseDetail = await result.json();
        console.log(releaseDetail);
        if(releaseDetail.published) {
            document.getElementById("releaseCheckingSection").classList.add("hidden");
            document.getElementById("releaseSuccessSection").classList.remove("hidden");
            document.getElementById("successReleaseLink").textContent =
                `${releaseDetail.publishedExtensionName} Published`;
            document.getElementById("successReleaseLink").setAttribute("href",
                `https://github.com/${owner}/${repo}/releases/tag/${tag}`);
            document.getElementById("successVersion").textContent =
                `Version: ${releaseDetail.publishedVersion}`;
            document.getElementById("publishedDate").textContent =
                `${new Date(releaseDetail.lastUpdatedDateUTC)}`;
        } else {
            document.getElementById("releaseCheckingSection").classList.add("hidden");
            document.getElementById("releaseFailedSection").classList.remove("hidden");
            document.getElementById("failedReleaseLink").textContent =
                `${tag} Failed to Publish`;
            document.getElementById("failedReleaseLink").setAttribute("href",
                `https://github.com/${owner}/${repo}/releases/tag/${tag}`);
            document.getElementById("processedDate").textContent =
                `${new Date(releaseDetail.lastUpdatedDateUTC)}`;
            for(let error of releaseDetail.errors){
                _addError(error);
            }
            let timeSinceRelease = (Date.now() - releaseDetail.lastUpdatedDateUTC) / 1000;
            if(releaseDetail.status === "processing" && timeSinceRelease < 60){
                // if release is in processing state, we dont allow retry for 60 seconds.
                // There is a check in server too, so it will fail anyway.
                document.getElementById("retryRelease").setAttribute('disabled', '');
                _addError(`Release is in progress. You can Retry release in ${60 - timeSinceRelease} Seconds.`);
            }
        }
    }).catch((err)=>{
        console.error("Error while fetching release status", err);
        document.getElementById("releaseCheckStatus").textContent = "Could not retrieve release status.";
    });
}
