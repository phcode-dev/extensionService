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

export async function createIssue(owner, repo, title, body) {
    return await octokit.request(`POST /repos/${owner}/${repo}/issues`, {
        owner,
        repo,
        title,
        body
    });
}
