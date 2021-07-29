import { createServer } from 'http';
import { createExpressApp } from './server';
import { PTMeter } from './PtMeter';
import { DbService } from './db';

function start () {
  const app = createExpressApp();
  const port = parseInt(process.env.PORT || '3000', 10);
  app.set('port', port);

  const server = createServer(app)
    .listen(port, '0.0.0.0')
    .on('error', (error: any) => {
      console.error('server.onError', error);
      throw error;
    })
    .on('listening', () => {
      const addr = server.address() || "unknown";
      const listen = typeof addr === 'string' ? addr : `${addr.address}:${addr.port}`

      console.log('Listening on ', listen);
    });
}

process.on('SIGTERM', () => console.log('killed'))

process.on('exit', function (exitCode) {
  console.log('process exit: ', exitCode)
})
process.on('uncaughtException', function (err) {
  console.error('uncaughtException:', err)
  process.exit(1);

})

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at: Promise', p, 'reason:', reason)
  process.exit(1);

})

try {
  PTMeter.getInstance()
  DbService.getInstance()
  start()
} catch (error) {
  console.error('error on start', error);
  process.exit(1);
}

