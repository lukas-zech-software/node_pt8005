"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const server_1 = require("./server");
const PtMeter_1 = require("./PtMeter");
const db_1 = require("./db");
function start() {
    const app = server_1.createExpressApp();
    const port = parseInt(process.env.PORT || '3000', 10);
    app.set('port', port);
    const server = http_1.createServer(app)
        .listen(port, '0.0.0.0')
        .on('error', (error) => {
        console.error('server.onError', error);
        throw error;
    })
        .on('listening', () => {
        const addr = server.address() || "unknown";
        const listen = typeof addr === 'string' ? addr : `${addr.address}:${addr.port}`;
        console.log('Listening on ', listen);
    });
}
process.on('SIGTERM', () => console.log('killed'));
process.on('exit', function (exitCode) {
    console.log('process exit: ', exitCode);
});
process.on('uncaughtException', function (err) {
    console.error('uncaughtException:', err);
    process.exit(1);
});
process.on('unhandledRejection', (reason, p) => {
    console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
    process.exit(1);
});
try {
    PtMeter_1.PTMeter.getInstance();
    db_1.DbService.getInstance();
    start();
}
catch (error) {
    console.error('error on start', error);
    process.exit(1);
}
