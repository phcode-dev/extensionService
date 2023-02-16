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
import {backupRegistry, getBackupRegistrySchema} from "./api/backup-registry.js";
import fastify from "fastify";
import {init, isAuthenticated, addUnAuthenticatedAPI} from "./auth/auth.js";
import {HTTP_STATUS_CODES} from "@aicore/libcommonutils";
import {getConfigs} from "./utils/configs.js";
import {cocoEndPoint, cocoAuthKey} from "./constants.js";
import {getHelloSchema, hello} from "./api/hello.js";

const server = fastify({logger: true});
/* Adding an authentication hook to the server. A hook is a function that is called when a request is made to
the server. */
server.addHook('onRequest', (request, reply, done) => {
    if (!isAuthenticated(request)) {
        reply.code(HTTP_STATUS_CODES.UNAUTHORIZED);
        done(new Error('Wrong key'));
    } else {
        done();
    }
});

// public hello api
addUnAuthenticatedAPI('/hello');
server.get('/hello', getHelloSchema(), function (request, reply) {
    return hello(request, reply);
});

// An authenticated version of the hello api
server.get('/helloAuth', getHelloSchema(), function (request, reply) {
    return hello(request, reply);
});

server.get('/backupRegistry', getBackupRegistrySchema(), async function (request, reply) {
    return await backupRegistry(request, reply);
});

server.get('/setupStack', getSetupStackSchema(), async function (request, reply) {
    return await setupStackForStage(request, reply);
});

/**
 * It starts the server and listens on the port specified in the configs
 */
export async function startServer() {
    await db.init(cocoEndPoint, cocoAuthKey);
    const configs = getConfigs();
    init(configs.authKey);
    await server.listen({port: configs.port, host: configs.allowPublicAccess ? '0.0.0.0' : 'localhost'});
}

export async function close() {
    await db.close();
    await server.close();
}
