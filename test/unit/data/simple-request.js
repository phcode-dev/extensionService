import {pino} from 'pino';
const logger = pino();

const simpleGETRequest = {
    id: "req-1",
    params:{},
    query:{
        "name": "rambo"
    },
    body: undefined,
    raw:{
        httpVersionMajor: 1,
        httpVersionMinor: 1,
        httpVersion: "1.1",
        complete: false,
        rawHeaders: [
            "Host",
            "127.0.0.1:5000",
            "Connection",
            "keep-alive",
            "Pragma",
            "no-cache",
            "Cache-Control",
            "no-cache",
            "sec-ch-ua",
            "\"Not_A Brand\";v=\"99\", \"Google Chrome\";v=\"109\", \"Chromium\";v=\"109\"",
            "sec-ch-ua-mobile",
            "?0",
            "sec-ch-ua-platform",
            "\"Windows\"",
            "Upgrade-Insecure-Requests",
            "1",
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
            "Accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
            "Sec-Fetch-Site",
            "none",
            "Sec-Fetch-Mode",
            "navigate",
            "Sec-Fetch-User",
            "?1",
            "Sec-Fetch-Dest",
            "document",
            "Accept-Encoding",
            "gzip, deflate, br",
            "Accept-Language",
            "en-US,en;q=0.9,ml;q=0.8",
            "Cookie",
            "_ga=GA1.1.1981449340.1672298314; mp_49c4d164b592be2350fc7af06a259bf3_mixpanel=%7B%22distinct_id%22%3A%20%221855cbf392c2bf-0bfd9797ae7728-26021151-144000-1855cbf392df35%22%2C%22%24device_id%22%3A%20%221855cbf392c2bf-0bfd9797ae7728-26021151-144000-1855cbf392df35%22%2C%22%24initial_referrer%22%3A%20%22http%3A%2F%2F127.0.0.1%3A8000%2F%22%2C%22%24initial_referring_domain%22%3A%20%22127.0.0.1%3A8000%22%7D; _ga_P4HJFPDB76=GS1.1.1672298314.1.1.1672298372.0.0.0"
        ],
        rawTrailers: [],
        aborted: false,
        upgrade: false,
        url: "/hello?name=rambo",
        method: "GET",
        statusCode: null,
        statusMessage: null
    }
};
export function getSimpleGETRequest() {
    let request = structuredClone(simpleGETRequest);
    request.log = logger;
    return request;
}

const simpleGetReply = {
    request: simpleGETRequest,
    raw: {}
};
export function getSimpleGetReply() {
    let reply = structuredClone(simpleGetReply);
    reply.log = logger;
    reply.status = function (code) {
        reply.statusCode = code;
    }
    return reply;
}


