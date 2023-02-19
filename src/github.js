import { Octokit } from "@octokit/rest";
import {githubAPIToken} from "./constants.js";

// github api docs: https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#create-an-issue
export const _gitHub = {
    Octokit
};

let octokit;

export function initClient() {
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
 * Creates a new issue.
 * @param {string} owner
 * @param {string} repo
 * @param {string|number} issueNumber
 * @param {string} commentString
 * @return {Promise<{number:number, html_url:string}>}
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
