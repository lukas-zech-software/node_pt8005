import * as SqliteDatabase from 'better-sqlite3'
import { Database } from 'better-sqlite3'
import {
  DbEnvironmentsAndWindowState,
  MeasurementValuesEntry,
  MeasurementValuesExport,
  PtMeterEnvironmentInfo
} from './common';

let instance: DbService;

export class DbService {
  public static getInstance (): DbService {
    if (instance === undefined) {
      instance = new DbService()
    }

    return instance;
  }

  private readonly db: Database;

  constructor () {
    this.db = this.connectDb();
  }

  connectDb (): Database {
    let dbfilename = 'database.db';

    const db = new SqliteDatabase(dbfilename, {})

    db.exec(`
        CREATE TABLE IF NOT EXISTS last_state (
          id INTEGER UNIQUE,
          environment_id INTEGER NOT NULL,
          window_state_id INTEGER NOT NULL,
          FOREIGN KEY (environment_id)
            REFERENCES environments (id) 
          FOREIGN KEY (window_state_id) 
            REFERENCES window_states (id) 
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS window_states (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS environments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS measurement_values (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          environment_id INTEGER NOT NULL,
          window_state_id INTEGER NOT NULL,
          timestamp INTEGER NOT NULL,
          interval INTEGER NOT NULL,
          min REAL NOT NULL,
          max REAL NOT NULL,
          mean REAL NOT NULL,
          FOREIGN KEY (environment_id) 
            REFERENCES environments (id) 
          FOREIGN KEY (window_state_id) 
            REFERENCES window_states (id) 
        );
    `);

    const insertEnvironments = db.prepare('INSERT OR IGNORE INTO environments (name) VALUES (@name)');
    const insertWindowStates = db.prepare('INSERT OR IGNORE INTO window_states (name) VALUES (@name)');
    const insertLastState = db.prepare('INSERT OR IGNORE INTO last_state (id,environment_id,window_state_id) VALUES (@id,@environment, @windowState)');

    db.transaction(() => {
      insertEnvironments.run({ name: 'N/A' });
      insertEnvironments.run({ name: 'Schlafzimmer' });
      insertEnvironments.run({ name: 'Wohnzimmer' });
      insertEnvironments.run({ name: 'Terrasse' });
      insertEnvironments.run({ name: 'Büro' });

      insertWindowStates.run({ name: 'N/A' });
      insertWindowStates.run({ name: 'offen' });
      insertWindowStates.run({ name: 'gekippt' });
      insertWindowStates.run({ name: 'geschlossen' });
      insertWindowStates.run({ name: 'draußen' });

      insertLastState.run({ id: 1, environment: 1, windowState: 1 });
    })();

    return db;
  }

  writeValues (entries: Array<MeasurementValuesEntry>): void {
    const insert = this.db.prepare(`
INSERT INTO measurement_values (
  min,
  max,
  mean,
  interval,
  timestamp,
  environment_id,
  window_state_id
) VALUES (
  @min,
  @max,
  @mean,
  @interval,
  @timestamp,
  @environment_id,
  @window_state_id
)
`);

    this.db.transaction(() => {
      entries.forEach(x => insert.run(x))
    })();
  }

  getValues (from: number = 0, to: number = Date.now()): Array<MeasurementValuesExport> {
    const stmt = this.db.prepare(`
SELECT 
  min,
  max,
  mean,
  datetime(timestamp,'unixepoch') as datetime,
  environments.name as environment,
  window_states.name as windowState
FROM
  measurement_values
INNER JOIN 
  environments 
ON
 measurement_values.environment_id = environments.id
INNER JOIN 
  window_states 
ON
 measurement_values.window_state_id = window_states.id    
WHERE
  timestamp >= @from
AND
  timestamp <= @to
 `);

    return stmt.all({ from, to });
  }

  getLastState (): PtMeterEnvironmentInfo {
    const stmt = this.db.prepare(`
SELECT 
  environment_id as environment,
  window_state_id as windowState
FROM
 last_state
WHERE
 id=1
 `);

    return stmt.get();
  }

  setLastState (info: PtMeterEnvironmentInfo): void {
    const update = this.db.prepare(`
UPDATE 
  last_state 
SET 
  environment_id=@environment,
  window_state_id=@windowState
WHERE
 id=1
`);

    this.db.transaction(() => {
      update.run(info)
    })();
  }

  getEnvironmentsAndWindowStates (): DbEnvironmentsAndWindowState {
    const environmentsSql = this.db.prepare(`
SELECT
  id,
  name
FROM
 environments
 `);

    const windowStatesSql = this.db.prepare(`
SELECT
  id,
  name
FROM
 window_states
 `);

    const valueCountSql = this.db.prepare(`
SELECT
  COUNT(*) as count
FROM
 measurement_values
 `);

    const environments = environmentsSql.all();
    const windowStates = windowStatesSql.all();
    const valuesCount = valueCountSql.get().count;


    return {
      valuesCount,
      environments,
      windowStates
    }
  }
}
