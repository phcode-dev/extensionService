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
    // https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#create-an-issue
    // {... "html_url": "https://github.com/octocat/Hello-World/issues/1347", ...}
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
 * Get the org details. Throws if org doesn't exist or is simple GitHub username passed.
 * @param {string} org
 * @return {Promise<{is_verified:boolean, html_url:string, blog:string,
 * name:string, company:string}>} blog is the verified url for the org.
 * @throws if org doesn't exist
 */
export async function getOrgDetails(org) {
    // https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#create-an-issue
    // {... "html_url": "https://github.com/octocat/Hello-World/issues/1347", ...}
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

    console.log("getting org details: ", orgDetails);
    return orgDetails;
}
