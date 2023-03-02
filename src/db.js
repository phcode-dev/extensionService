import * as coco from "@aicore/cocodb-ws-client";

let db = {
    init: coco.init,
    createDb: coco.createDb,
    createTable: coco.createTable,
    createIndex: coco.createIndex,
    put: coco.put,
    update: coco.update,
    getFromIndex: coco.getFromIndex,
    query: coco.query,
    close: coco.close
};

export default db;
