import { Router } from 'express';
import { json2csv } from 'json-2-csv';
import { createReadStream } from 'fs';

import { PTMeter } from '../../PtMeter';
import { DbEnvironmentsAndWindowState } from '../../common';
import { DbService } from '../../db';
import * as createError from 'http-errors';

export function getIndexRouter(): Router {
	const indexRouter = Router();
	let dbState: DbEnvironmentsAndWindowState | undefined = undefined;

	function refreshDbState() {
		dbState = DbService.getInstance().getEnvironmentsAndWindowStates();
	}

	/* GET home page. */
	indexRouter.get('/', function (req, res, next) {
		const meterStatus = PTMeter.getInstance().getMeterStatus();
		if (!dbState || !!req.query["refreshDb"]) {
			console.log('dbState');
			refreshDbState()
		}

		res.render('index', {meterStatus, dbState});
	});

	indexRouter.post('/environment', function (req, res, next) {
		PTMeter.getInstance().setEnvironment({environment: req.body.id});
		res.status(201).send();
	});

	indexRouter.post('/windowstate', function (req, res, next) {
		PTMeter.getInstance().setEnvironment({windowState: req.body.id});
		res.status(201).send();
	});

	indexRouter.get('/export/db*', function (req, res, next) {
		res.setHeader("content-type", "application/binary");
		res.setHeader('Content-Disposition', 'ptmeter.sqlite.db')
		createReadStream(DbService.getInstance().dbPath).pipe(res);
	})

	indexRouter.get('/export/csv*', function (req, res, next) {
		let from: number | undefined, to: number | undefined;

		let queryFrom = req.query["from"];
		if (typeof queryFrom === 'string') {
			from = parseInt(queryFrom, 10)
		}
		let queryTo = req.query["to"];
		if (typeof queryTo === 'string') {
			to = parseInt(queryTo, 10)
		}

		const values = DbService.getInstance().getValues(from, to)

		json2csv(values, (err, csv) => {
			if (err) {
				return next(createError(err));
			}

			res.setHeader('Content-Type', 'text/csv')
			res.setHeader('Content-Disposition', 'ptmeter_export.csv')
			res.status(200).send(csv);
		})
	});

	return indexRouter;
}
