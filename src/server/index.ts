import * as createError from 'http-errors';
import type { Express as ExpressApp, Request, Response } from 'express';
import * as express from 'express';
import * as cookieParser from 'cookie-parser';
import * as path from 'path';
import { getIndexRouter } from './routes';

export function createExpressApp (): ExpressApp {
  const server = express();

// view engine setup
  server.set('views', path.join(__dirname, 'views'));
  server.set('view engine', 'pug');

  //server.use(logger('dev'));
  server.use(express.json());
  server.use(express.urlencoded({ extended: false }));
  server.use(cookieParser());
  server.use(express.static(path.join(__dirname, 'public')));

  server.use('/', getIndexRouter());

// catch 404 and forward to error handler
  server.use(function (req, res, next) {
    next(createError(404));
  });

// error handler
  server.use(function (err: any, req: Request, res: Response) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
  });

  return server;
}

