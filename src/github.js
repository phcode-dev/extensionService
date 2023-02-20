import { Octokit } from "@octokit/rest";
import {githubAPIToken} from "./constants.js";

// github api docs: https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#create-an-issue
export const _gitHub = {
    Octokit
};

let octokit;

export function initGitHubClient() {
    if(octokit){
        console.warn("GitHub Client already initialized.");
        return;
    }
    octokit = new _gitHub.Octokit({
        auth: githubAPIToken,
        userAgent: 'phcode.dev extensions service',
        log: {
            debug: () => {},
            info: () => {},
            warn: console.warn,
            error: console.error
        }
    });
}

/**
 * Creates a new issue.
 * @param {string} owner
 * @param {string} repo
 * @param {string} title
 * @param {string} body
 * @return {Promise<{number:number, html_url:string}>}
 */
export async function createIssue(owner, repo, title, body) {
    // https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#create-an-issue
    // {... "html_url": "https://github.com/octocat/Hello-World/issues/1347", ...}
    console.log("create Github issue: ", arguments);
    let response = await octokit.request(`POST /repos/${owner}/${repo}/issues`, {
        owner,
        repo,
        title,
        body
    });

    console.log("created issue: ", response.data.html_url);
    return {
        number: response.data.number,
        html_url: response.data.html_url
    };
}

/**
 * comments on an issue
 * @param {string} owner
 * @param {string} repo
 * @param {string|number} issueNumber
 * @param {string} commentString
 * @return {Promise<{html_url:string}>}
 */
export async function commentOnIssue(owner, repo, issueNumber, commentString) {
    // https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28
    console.log("Comment on Github issue: ", arguments);
    let response = await octokit.request(`POST /repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
        owner,
        repo,
        issue_number: `${issueNumber}`,
        body: commentString
    });

    console.log("commented on issue: ", response.data.html_url);
    return {
        html_url: response.data.html_url
    };
}

/**
 * Get the org details
 * or null if org doesn't exist/ it is just a plain user and not an org.
 * @param {string} org
 * @return {Promise<{is_verified:boolean, html_url:string, blog:string,
 * name:string, company:string}> | null} blog is the verified url for the org. null if org doesnt exist
 */
export async function getOrgDetails(org) {
    // https://docs.github.com/en/rest/orgs/orgs?apiVersion=2022-11-28#get-an-organization
    console.log("Get Org details: ", arguments);
    try{
        let response = await octokit.request(`GET /orgs/${org}`, {
            org
        });

        let orgDetails = {
            name: response.data.name,
            company: response.data.company,
            blog: response.data.blog,
            is_verified: response.data.is_verified,
            html_url: response.data.html_url
        };

        console.log("GitHub org details: ", orgDetails);
        return orgDetails;
    } catch (e) {
        if(e.status === 404){
            console.log("no such org: ", org);
            return null;
        }
        console.error("error getting github org: ", e);
        throw e;
    }
}

/**
 * Get the repo details
 * or null if repo doesn't exist.
 * @param {string} owner
 * @param {string} repo
 * @return {Promise<{html_url:string, stargazers_count:number}> | null}
 */
export async function getRepoDetails(owner, repo) {
    // https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#get-a-repository
    console.log("Get Repo details: ", arguments);
    try{
        let response = await octokit.request(`GET /repos/${owner}/${repo}`, {
            owner, repo
        });

        let repoDetails = {
            html_url: response.data.html_url,
            stargazers_count: response.data.stargazers_count
        };

        console.log("GitHub repo details: ", repoDetails);
        return repoDetails;
    } catch (e) {
        if(e.status === 404){
            console.log("no such repo: ", owner, repo);
            return null;
        }
        console.error("error getting github repo: ", e);
        throw e;
    }
}

/**
 * Get the release details
 * or null if release doesn't exist.
 * @param {string} owner
 * @param {string} repo
 * @param {string} tag
 * @return {Promise<{html_url:string, stargazers_count:number}> | null}
 */
export async function getReleaseDetails(owner, repo, tag) {
    // https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#get-a-repository
    console.log("Get Release details: ", arguments);
    try{
        let response = await octokit.request(`GET /repos/${owner}/${repo}/releases/tags/${tag}`, {
            owner, repo, tag
        });

        let releaseDetails = {
            html_url: response.data.html_url,
            draft: response.data.draft,
            prerelease: response.data.prerelease,
            assets: []
        };
        for(let asset of response.data.assets){
            releaseDetails.assets.push({
                //Eg. "https://github.com/octocat/Hello-World/releases/download/v1.0.0/example.zip",
                browser_download_url: asset.browser_download_url,
                name: asset.name, //"example.zip",
                size: asset.size, // 1024
                content_type: asset.content_type // Eg. application/zip
            });
        }

        console.log("GitHub release details: ", releaseDetails);
        return releaseDetails;
    } catch (e) {
        if(e.status === 404){
            console.log("no such release: ", owner, repo);
            return null;
        }
        console.error("error getting github release: ", e);
        throw e;
    }
}
