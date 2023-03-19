/*
 * GNU AGPL-3.0 License
 *
 * Copyright (c) 2021 - present core.ai . All rights reserved.
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see https://opensource.org/licenses/AGPL-3.0.
 *
 */

import db from "./db.js";
import {setupStackForStage, getSetupStackSchema} from "./api/setup-stack.js";
import {backupRegistry, getBackupRegistrySchema, setupTasks, cancelTasks} from "./api/backup-registry.js";
import fastify from "fastify";
import {fastifyStatic} from "@fastify/static";
import {init, isAuthenticated, addUnAuthenticatedAPI} from "./auth/auth.js";
import {HTTP_STATUS_CODES} from "@aicore/libcommonutils";
import {getConfigs} from "./utils/configs.js";
import {cocoEndPoint, cocoAuthKey} from "./constants.js";
import {getHelloSchema, hello} from "./api/hello.js";
import {getPublishGithubReleaseSchema, publishGithubRelease} from "./api/publishGithubRelease.js";
import path from 'path';
import { fileURLToPath } from 'url';
import {initGitHubClient, setupGitHubOpsMonitoring} from "./github.js";
import {getGetGithubReleaseStatusSchema, getGithubReleaseStatus} from "./api/getGithubReleaseStatus.js";
import {getCountDownloadSchema, countDownload} from "./api/countDownload.js";
import {getChangeOwnershipSchema, changeOwnership} from  "./api/changeOwnership.js";
import {startCollectStarsWorker} from "./utils/sync.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = fastify({
    logger: true,
    // https://www.fastify.io/docs/latest/Reference/Server/#trustproxy
    // needed to forward correct IP addresses in a reverse proxy configuration
    trustProxy: true
});

/* Adding an authentication hook to the server. A hook is a function that is called when a request is made to
the server. */
server.addHook('onRequest', (request, reply, done) => {
    const routeExists = server.hasRoute({
        url: request.raw.url,
        method: request.raw.method
        // constraints: { version: '1.0.0' } specify this if you are doing something custom
    });

    if (!routeExists) {
        console.error("route does not exist for ", request.raw.url);
        reply.code(HTTP_STATUS_CODES.NOT_FOUND);
        done('Not Found');
    } else if (!isAuthenticated(request)) {
        console.error(`Unauthorised access for ${request.raw.url} from IP ${request.ips} `);
        reply.code(HTTP_STATUS_CODES.UNAUTHORIZED);
        done("Unauthorized");
    } else {
        done();
    }
});


// static web pages
console.log("Serving static files from path: ", __dirname + '/www/');
addUnAuthenticatedAPI('/www/*');
server.register(fastifyStatic, {
    root: __dirname + '/www/',
    prefix: '/www/'
});
addUnAuthenticatedAPI('/www');
server.get('/www', function(req, res){
    // redirect www to www/
    res.redirect(301, req.url + '/');
});

// public hello api
addUnAuthenticatedAPI('/hello');
server.get('/hello', getHelloSchema(), function (request, reply) {
    return hello(request, reply);
});

// public publishGithubRelease api
addUnAuthenticatedAPI('/publishGithubRelease');
server.get('/publishGithubRelease', getPublishGithubReleaseSchema(), function (request, reply) {
    return publishGithubRelease(request, reply);
});

// public getGithubReleaseStatus api
addUnAuthenticatedAPI('/getGithubReleaseStatus');
server.get('/getGithubReleaseStatus', getGetGithubReleaseStatusSchema(), function (request, reply) {
    return getGithubReleaseStatus(request, reply);
});

// public countDownload api
addUnAuthenticatedAPI('/countDownload');
server.get('/countDownload', getCountDownloadSchema(), function (request, reply) {
    return countDownload(request, reply);
});


// An authenticated version of the hello api
server.get('/helloAuth', getHelloSchema(), function (request, reply) {
    return hello(request, reply);
});

// private internal apis
server.get('/backupRegistry', getBackupRegistrySchema(), async function (request, reply) {
    return await backupRegistry(request, reply);
});

server.get('/setupStack', getSetupStackSchema(), async function (request, reply) {
    return await setupStackForStage(request, reply);
});

server.get('/changeOwnership', getChangeOwnershipSchema(), function (request, reply) {
    return changeOwnership(request, reply);
});


/**
 * It starts the server and listens on the port specified in the configs
 */
export async function startServer() {
    console.log("awaiting connection to coco db");
    await db.init(cocoEndPoint, cocoAuthKey);
    initGitHubClient();
    setupGitHubOpsMonitoring();
    startCollectStarsWorker();
    console.log("connected to coco db");
    setupTasks();
    const configs = getConfigs();
    init(configs.authKey);
    await server.listen({port: configs.port, host: configs.allowPublicAccess ? '0.0.0.0' : 'localhost'});
}

export async function close() {
    cancelTasks();
    await db.close();
    await server.close();
}
