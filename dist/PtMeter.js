"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PTMeter = void 0;
const SerialPort = require("serialport");
const lodash_1 = require("lodash");
const db_1 = require("./db");
var Delimiter = SerialPort.parsers.Delimiter;
var COMMANDS;
(function (COMMANDS) {
    COMMANDS[COMMANDS["Min_Max"] = 17] = "Min_Max";
    COMMANDS[COMMANDS["off"] = 51] = "off";
    COMMANDS[COMMANDS["rec"] = 85] = "rec";
    COMMANDS[COMMANDS["speed"] = 119] = "speed";
    COMMANDS[COMMANDS["range"] = 136] = "range";
    COMMANDS[COMMANDS["dBA_C"] = 153] = "dBA_C";
})(COMMANDS || (COMMANDS = {}));
var FLAGS;
(function (FLAGS) {
    FLAGS[FLAGS["TERMINATOR"] = 0] = "TERMINATOR";
    FLAGS[FLAGS["DELIMITER"] = 165] = "DELIMITER";
    FLAGS[FLAGS["SPEED_FAST"] = 2] = "SPEED_FAST";
    FLAGS[FLAGS["SPEED_SLOW"] = 3] = "SPEED_SLOW";
    FLAGS[FLAGS["MODE_MAX"] = 4] = "MODE_MAX";
    FLAGS[FLAGS["MODE_MIN"] = 5] = "MODE_MIN";
    FLAGS[FLAGS["TIME"] = 6] = "TIME";
    FLAGS[FLAGS["LIMIT_OVER"] = 7] = "LIMIT_OVER";
    FLAGS[FLAGS["LIMIT_UNDER"] = 8] = "LIMIT_UNDER";
    FLAGS[FLAGS["RANGE_30_80"] = 48] = "RANGE_30_80";
    FLAGS[FLAGS["XX_RANGE_50_100"] = 32] = "XX_RANGE_50_100";
    FLAGS[FLAGS["RANGE_50_100"] = 75] = "RANGE_50_100";
    FLAGS[FLAGS["RANGE_80_130"] = 76] = "RANGE_80_130";
    FLAGS[FLAGS["RANGE_30_130"] = 64] = "RANGE_30_130";
    FLAGS[FLAGS["FREQUENZY_DBA"] = 27] = "FREQUENZY_DBA";
    FLAGS[FLAGS["FREQUENZY_DBC"] = 28] = "FREQUENZY_DBC";
    FLAGS[FLAGS["DATA"] = 13] = "DATA";
    FLAGS[FLAGS["RECORDING"] = 10] = "RECORDING";
    FLAGS[FLAGS["_FULL"] = 35] = "_FULL";
    FLAGS[FLAGS["HOLD"] = 17] = "HOLD";
    FLAGS[FLAGS["XX1"] = 25] = "XX1";
    FLAGS[FLAGS["XX2"] = 31] = "XX2";
    FLAGS[FLAGS["XX3"] = 26] = "XX3";
    FLAGS[FLAGS["XX4"] = 12] = "XX4";
    FLAGS[FLAGS["XX5"] = 11] = "XX5";
    FLAGS[FLAGS["XX7_IN_RANGE"] = 14] = "XX7_IN_RANGE";
    FLAGS[FLAGS["XX9"] = 118] = "XX9";
    FLAGS[FLAGS["XX10"] = 117] = "XX10";
    FLAGS[FLAGS["XX_RANGE_30_80"] = 16] = "XX_RANGE_30_80";
})(FLAGS || (FLAGS = {}));
function calcTime(buffer) {
    //<Buffer 24 03 27 >
    const bufferString = buffer.toString('hex');
    let [pm, h, m1 = '0', m2 = '0', s1 = '0', s2 = '0'] = bufferString;
    /*
        console.log('buffer', buffer);
        console.log('bufferString', bufferString);
        console.log('[pm,h,m1,m2,s1,s2]', [pm,h,m1,m2,s1,s2]);
    */
    let hour = parseInt(h, 10);
    const minutes = parseInt(`${m1}${m2}`, 10);
    const seconds = parseInt(`${s1}${s2}`, 10);
    if (pm === "2") {
        hour += 12;
    }
    return `${hour}:${minutes}:${seconds}`;
}
function calcData(buffer) {
    //<Buffer 04 52>
    const bufferString = buffer.toString('hex');
    // let [v100 = '0', v10 = '0', v1 = '0', v01 = '0'] = bufferString;
    //console.log("[v100='0',v10='0',v1='0',v01='0']", [v100, v10, v1, v01]);
    const parsed = parseInt(bufferString, 10);
    return parsed / 10;
}
let instance;
class PTMeter {
    logInterval = 1000;
    writeInterval = 10000;
    verbose = !!process.env.PT_VERBOSE;
    parser;
    db;
    port;
    currentEnvironmentInfo;
    lastSettings = undefined;
    lastValues = undefined;
    infoMessage = "Not initialised";
    errorMessage = undefined;
    totalFramesRead = 0;
    framesBuffer = [];
    measurementValuesEntriesBuffer = [];
    targetRange = FLAGS.RANGE_30_130;
    constructor() {
        this.port = this.openSerialPort();
        this.db = db_1.DbService.getInstance();
        this.currentEnvironmentInfo = this.db.getLastState();
        this.parser = new Delimiter({
            delimiter: Buffer.from([FLAGS.TERMINATOR, FLAGS.DELIMITER]),
            includeDelimiter: false
        });
        this.port.pipe(this.parser);
        this.parser.addListener('data', buf => {
            this.parseReadResult(buf);
        });
        this.parser.once('data', buf => {
            this.parseReadResult(buf);
            this.infoMessage = "Data received once";
        });
        this.parser.addListener('error', err => {
            this.errorMessage = "Error: " + err;
            console.error('error on parser', err);
            throw err;
        });
        setInterval(() => {
            this.aggregateFrames();
        }, this.logInterval);
        setInterval(() => {
            this.writeValuesToDb();
        }, this.writeInterval);
        /*this.init().then(() => {
            this.infoMessage = "Initialised"
        })*/
    }
    static getInstance() {
        if (instance === undefined) {
            instance = new PTMeter();
        }
        return instance;
    }
    /*

        async init(): Promise<void> {
            let isCorrectRangeSet = await this.checkRange();
            if (!isCorrectRangeSet) {
                // trigger range command until meter returns target range
                console.log('Triggering range command');

                await this.sendCommand(COMMANDS.range);
                return this.init()
            }
        }

        async checkRange(): Promise<boolean> {
            // wait for some frames
            const now = Date.now()
            await new Promise(r => setTimeout(r, this.logInterval))
            console.log('wait',Date.now()-now);

            const lastFrames = this.framesBuffer;
            this.framesBuffer = [];

            const allReceivedRanges = new Set<string | undefined>()
            lastFrames.forEach(x => allReceivedRanges.add(x.settings.range))

            const result = allReceivedRanges.has(FLAGS[this.targetRange])

            if (!result) {
                let rangesString = Array.from(allReceivedRanges.values()).map(x => x || 'N/A').join(',');
                console.log(`Received ranges ${rangesString} from ${lastFrames.length} frames did not include target range ${FLAGS[this.targetRange]}`);
            }

            return result;
        }
    */
    getMeterStatus() {
        return {
            info: this.infoMessage,
            error: this.errorMessage,
            values: this.lastValues,
            settings: this.lastSettings,
            environmentInfo: this.currentEnvironmentInfo,
        };
    }
    setEnvironment(environment) {
        this.currentEnvironmentInfo = { ...this.currentEnvironmentInfo, ...environment };
        this.db.setLastState(this.currentEnvironmentInfo);
    }
    async sendCommand(command) {
        return new Promise((resolve, reject) => {
            this.port.write([command], (err) => {
                if (err) {
                    console.log('Error on write: ', err.message);
                    reject(err);
                    return;
                }
                console.log(`command ${COMMANDS[command]} written`);
                resolve();
            });
        });
    }
    writeValuesToDb() {
        const valuesToWrite = this.measurementValuesEntriesBuffer;
        this.measurementValuesEntriesBuffer = [];
        this.infoMessage = `${valuesToWrite.length} values written to DB at ${new Date().toISOString()}`;
        this.db.writeValues(valuesToWrite);
    }
    openSerialPort() {
        const device = process.env.PT_DEVICE || '/dev/tty.usbserial-0001';
        const port = new SerialPort(device, {
            baudRate: 9600,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            autoOpen: false
        });
        port.on('error', (err) => {
            console.error('SerialPort Error: ', err.message);
            this.errorMessage = 'SerialPort Error: ' + err.toString();
        });
        port.open((err) => {
            if (err) {
                console.error('Error opening port: ', err.message);
                this.errorMessage = 'Error opening port: ' + err.toString();
                return;
            }
            let message = `SerialPort open for device "${device}"`;
            this.infoMessage = message;
            console.log(message);
        });
        return port;
    }
    aggregateFrames() {
        const lastFrames = this.framesBuffer;
        this.framesBuffer = [];
        if (lastFrames.length === 0) {
            console.warn('No frames received. Check Meter');
            this.infoMessage = "No data received. Check Meter";
            return;
        }
        lastFrames.forEach(x => this.lastSettings = Object.assign({}, this.lastSettings, x.settings));
        const validFrames = lastFrames
            .filter(x => x.readings.rangeLimitExceeded === undefined)
            .filter(x => x.readings.hold === undefined);
        const values = validFrames.map(x => x.readings.value);
        // TODO: Use current range from device?
        const validValues = values.filter(x => x !== undefined && lodash_1.inRange(x, 20, 120));
        if (this.verbose) {
            const diff = lastFrames.length - validFrames.length;
            if (diff !== 0) {
                console.log(`Dropped ${diff} invalid frames`);
            }
            const diffVal = values.length - validValues.length;
            if (diffVal !== 0) {
                console.log(`Dropped ${diffVal} invalid values`);
            }
            console.log(`${validValues.length} valid values found`);
        }
        if (validValues.length === 0) {
            this.lastValues = undefined;
            let message = `No valid values found. Check Range on meter`;
            console.log(message);
            this.infoMessage = message;
            return;
        }
        const aggregate = {
            min: lodash_1.round(lodash_1.min(validValues) || 0, 1),
            max: lodash_1.round(lodash_1.max(validValues) || 0, 1),
            mean: lodash_1.round(lodash_1.mean(validValues) || 0, 1),
        };
        if (this.verbose) {
            console.log(`Aggregate`, aggregate);
        }
        this.lastValues = aggregate;
        this.bufferMeasurementValuesEntry(aggregate);
    }
    bufferMeasurementValuesEntry(aggregate) {
        this.measurementValuesEntriesBuffer.push({
            ...aggregate,
            interval: this.logInterval,
            timestamp: Date.now() / 1000,
            environment_id: this.currentEnvironmentInfo.environment,
            window_state_id: this.currentEnvironmentInfo.windowState,
        });
    }
    parseReadResult(buffer) {
        const bufStr = buffer.toString('hex');
        const parts = bufStr.split(FLAGS.DELIMITER.toString(16));
        const frame = {
            index: this.verbose ? this.totalFramesRead++ : -1,
            timestamp: Date.now(),
            readings: {
                value: NaN,
                time: ""
            },
            settings: { mode: 'default', recording: false, full: false }
        };
        if (this.verbose) {
            frame.unknown = {};
            frame.parsed = {};
        }
        parts.forEach((part) => {
            const partBuffer = Buffer.from(part, 'hex');
            if (partBuffer.length === 0)
                return;
            /*first byte of buffer is the flag*/
            /*rest of buffer contains value - if any*/
            const [flag, ...rest] = partBuffer;
            this.setFrameValue(frame, FLAGS[flag] || flag.toString(16), Buffer.from(rest));
        });
        this.framesBuffer.push(frame);
    }
    setFrameValue(frame, flag, data) {
        let unknown = false;
        switch (flag) {
            case FLAGS[FLAGS.RANGE_30_80]:
            case FLAGS[FLAGS.RANGE_30_130]:
            case FLAGS[FLAGS.RANGE_50_100]:
            case FLAGS[FLAGS.RANGE_80_130]:
                frame.settings.range = flag;
                break;
            case FLAGS[FLAGS.FREQUENZY_DBA]:
                frame.settings.frequency = 'dbA';
                break;
            case FLAGS[FLAGS.FREQUENZY_DBC]:
                frame.settings.frequency = 'dbC';
                break;
            case FLAGS[FLAGS.SPEED_FAST]:
                frame.settings.speed = 'fast';
                break;
            case FLAGS[FLAGS.SPEED_SLOW]:
                frame.settings.speed = 'slow';
                break;
            case FLAGS[FLAGS.MODE_MAX]:
                frame.settings.mode = 'max';
                break;
            case FLAGS[FLAGS.MODE_MIN]:
                frame.settings.mode = 'min';
                break;
            case FLAGS[FLAGS.RECORDING]:
                frame.settings.recording = true;
                break;
            case FLAGS[FLAGS._FULL]:
                frame.settings.full = true;
                break;
            case FLAGS[FLAGS.LIMIT_OVER]:
                frame.readings.rangeLimitExceeded = 'over';
                break;
            case FLAGS[FLAGS.LIMIT_UNDER]:
                frame.readings.rangeLimitExceeded = 'under';
                break;
            case FLAGS[FLAGS.HOLD]:
                frame.readings.hold = data.length > 1 ? data.length : undefined;
                break;
            case FLAGS[FLAGS.DATA]:
                frame.readings.value = calcData(data);
                break;
            case FLAGS[FLAGS.TIME]:
                frame.readings.time = calcTime(data);
                break;
            case undefined:
            default: {
                if (!this.verbose)
                    return;
                unknown = true;
                //console.log('buffer', buffer);
                frame.unknown = frame.unknown || {};
                frame.unknown[flag] = data.toString('hex');
            }
        }
        if (!this.verbose)
            return;
        if (!unknown) {
            frame.parsed = frame.parsed || {};
            frame.parsed[flag] = data.toString('hex');
        }
    }
}
exports.PTMeter = PTMeter;
