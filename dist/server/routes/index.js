"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIndexRouter = void 0;
const express_1 = require("express");
const json_2_csv_1 = require("json-2-csv");
const fs_1 = require("fs");
const PtMeter_1 = require("../../PtMeter");
const db_1 = require("../../db");
const createError = require("http-errors");
function getIndexRouter() {
    const indexRouter = express_1.Router();
    let dbState = undefined;
    function refreshDbState() {
        dbState = db_1.DbService.getInstance().getEnvironmentsAndWindowStates();
    }
    /* GET home page. */
    indexRouter.get('/', function (req, res, next) {
        const meterStatus = PtMeter_1.PTMeter.getInstance().getMeterStatus();
        if (!dbState || !!req.query["refreshDb"]) {
            console.log('dbState');
            refreshDbState();
        }
        res.render('index', { meterStatus, dbState });
    });
    indexRouter.post('/environment', function (req, res, next) {
        PtMeter_1.PTMeter.getInstance().setEnvironment({ environment: req.body.id });
        res.status(201).send();
    });
    indexRouter.post('/windowstate', function (req, res, next) {
        PtMeter_1.PTMeter.getInstance().setEnvironment({ windowState: req.body.id });
        res.status(201).send();
    });
    indexRouter.get('/export/db*', function (req, res, next) {
        res.setHeader("content-type", "application/binary");
        res.setHeader('Content-Disposition', 'ptmeter.sqlite.db');
        fs_1.createReadStream(db_1.DbService.getInstance().dbPath).pipe(res);
    });
    indexRouter.get('/export/csv*', function (req, res, next) {
        let from, to;
        let queryFrom = req.query["from"];
        if (typeof queryFrom === 'string') {
            from = parseInt(queryFrom, 10);
        }
        let queryTo = req.query["to"];
        if (typeof queryTo === 'string') {
            to = parseInt(queryTo, 10);
        }
        const values = db_1.DbService.getInstance().getValues(from, to);
        json_2_csv_1.json2csv(values, (err, csv) => {
            if (err) {
                return next(createError(err));
            }
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'ptmeter_export.csv');
            res.status(200).send(csv);
        });
    });
    return indexRouter;
}
exports.getIndexRouter = getIndexRouter;
