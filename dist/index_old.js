"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SerialPort = require("serialport");
const lodash_1 = require("lodash");
const util_1 = require("util");
const readline_1 = require("readline");
var Delimiter = SerialPort.parsers.Delimiter;
let counter = 1;
function diff(a, b) {
    return lodash_1.reduce(Object.entries(a), (result, [key, value]) => {
        if (lodash_1.isEqual(value, b[key])) {
            return result;
        }
        else {
            return result.concat({ [key]: value });
        }
    }, []);
}
const COMMANDS = {
    "Min/Max": "\x11",
    "off": "\x33",
    "rec": "\x55",
    "speed": "\x77",
    "range": "\x88",
    "dBA/C": "\x99"
};
var FLAGS;
(function (FLAGS) {
    FLAGS[FLAGS["SPEED_FAST"] = 2] = "SPEED_FAST";
    FLAGS[FLAGS["SPEED_SLOW"] = 3] = "SPEED_SLOW";
    FLAGS[FLAGS["MODE_MAX"] = 4] = "MODE_MAX";
    FLAGS[FLAGS["MODE_MIN"] = 5] = "MODE_MIN";
    FLAGS[FLAGS["TIME"] = 6] = "TIME";
    FLAGS[FLAGS["LIMIT_OVER"] = 7] = "LIMIT_OVER";
    FLAGS[FLAGS["LIMIT_UNDER"] = 8] = "LIMIT_UNDER";
    FLAGS[FLAGS["RANGE_30_80"] = 16] = "RANGE_30_80";
    FLAGS[FLAGS["_RANGE_50_100"] = 32] = "_RANGE_50_100";
    FLAGS[FLAGS["RANGE_50_100"] = 117] = "RANGE_50_100";
    FLAGS[FLAGS["_RANGE_80_130"] = 48] = "_RANGE_80_130";
    FLAGS[FLAGS["RANGE_80_130"] = 118] = "RANGE_80_130";
    FLAGS[FLAGS["RANGE_30_130"] = 64] = "RANGE_30_130";
    FLAGS[FLAGS["FREQUENZY_DBA"] = 27] = "FREQUENZY_DBA";
    FLAGS[FLAGS["FREQUENZY_DBC"] = 28] = "FREQUENZY_DBC";
    FLAGS[FLAGS["DATA"] = 13] = "DATA";
    FLAGS[FLAGS["HOLD"] = 17] = "HOLD";
})(FLAGS || (FLAGS = {}));
function doWeirdStuffWithCharCode(charCode, factor) {
    let modulo = charCode % 16;
    let someNumber = charCode / 16;
    someNumber = Math.trunc(someNumber);
    someNumber = someNumber * 10;
    return (someNumber + modulo) * factor;
}
function calcData(buffer) {
    //<Buffer 04 52>
    const bufferString = buffer.toString();
    const charCode1 = bufferString.charCodeAt(3);
    const charCode2 = bufferString.charCodeAt(4);
    const value1 = doWeirdStuffWithCharCode(charCode1, 10);
    const value2 = doWeirdStuffWithCharCode(charCode2, 0.1);
    return value1 + value2;
}
function setFrameValue(frame, flag, data) {
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
        case FLAGS[FLAGS.LIMIT_OVER]:
            frame.values.limit = 'over';
            break;
        case FLAGS[FLAGS.LIMIT_UNDER]:
            frame.values.limit = 'under';
            break;
        case FLAGS[FLAGS.HOLD]:
            frame.values.hold = data.length > 1 ? data.length : false;
            break;
        case FLAGS[FLAGS.DATA]:
            frame.values.value = calcData(data);
            break;
        case FLAGS[FLAGS.TIME]:
            frame.values.time = data;
            break;
        case undefined:
        default: {
            //console.log('buffer', buffer);
            frame.unknown = frame.unknown || {};
            frame.unknown[flag] = data;
        }
    }
}
class PTMeter {
    port;
    shouldReadNext = true;
    drop = 0;
    parser;
    frames = [];
    currentSettings = null;
    index = 1;
    allBuff = [];
    all = [];
    last;
    constructor(port) {
        this.port = port;
        this.parser = new Delimiter({ delimiter: Buffer.from([0xa5]) });
        this.port.pipe(this.parser);
        const readLine = readline_1.createInterface({
            input: process.stdin,
        });
        readLine.on('line', () => {
            this.shouldReadNext = true;
        });
    }
    command(command) {
        return new Promise((resolve, reject) => {
            this.port.write(command, (err) => {
                if (err) {
                    console.log('Error on write: ', err.message);
                    reject(err);
                    return;
                }
                console.log('command written');
                resolve();
            });
        });
    }
    setRange() {
        return new Promise((resolve) => {
        });
    }
    startRead() {
        // this.port.addListener('data', buf => {
        //     this.parseReadResult(buf);
        // });
        this.parser.addListener('data', buf => {
            this.parseReadResult(buf);
        });
        /*setInterval(() => {
            console.log('this.incomplete', this.incomplete);
            console.log('diff(this.incomplete,this.lastIncomplete)', diff(this.incomplete, this.lastIncomplete));
            console.log('this.unknown', this.unknown);
            this.lastIncomplete = this.incomplete;
            console.log('diff(this.unkown,this.lastUnknown)', diff(this.unknown, this.lastUnknown));
            this.lastUnknown = this.unknown;
        }, 2000)*/
    }
    getCurrent() {
        if (this.all[this.index] === undefined) {
            this.all[this.index] = { all: [] };
        }
        return this.all[this.index];
    }
    setCurrent(buffer) {
        let current = this.getCurrent();
        let b0 = buffer[0];
        let s = FLAGS[b0] || b0.toString();
        if (current[s] !== undefined) {
            //console.log('Frame Change at', s, this.last);
            this.parseFrame(current);
            this.index++;
            current = this.getCurrent();
        }
        current.all.push(s /*{[s]: buffer}*/);
        current[s] = buffer;
        this.last = s;
    }
    parseFrame(frameObj) {
        // todo: always parse settings
        if (this.shouldReadNext) {
            this.shouldReadNext = false;
            const frame = {
                index: counter++,
                unknown: {},
                values: {},
                settings: this.currentSettings || {}
            };
            const parsedFrame = Array.from(Object.entries(frameObj)).reduce((previous, [key, value], index) => {
                setFrameValue(previous, key, value);
                return previous;
            }, frame);
            console.clear();
            console.log('parsedFrame', util_1.inspect(parsedFrame, { depth: null, compact: false, colors: true }));
            console.log(counter + '--------------------------------');
            this.currentSettings = parsedFrame.settings;
            this.frames.push(parsedFrame);
        }
    }
    parseReadResult(buffer) {
        /*if (this.drop++ % 20 !== 0) {
            return;
        }*/
        this.setCurrent(buffer);
    }
}
function openSerialPort() {
    const port = new SerialPort('/dev/tty.usbserial-0001', {
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        autoOpen: false
    });
    // Switches the port into "flowing mode"
    // port.on('data', function (data) {
    //     console.log('Data:', data)
    //})
    // Open errors will be emitted as an error event
    port.on('error', function (err) {
        console.error('SerialPort Error: ', err.message);
    });
    // The open event is always emitted
    port.on('open', function () {
        console.log('SerialPort open EVENT');
    });
    // ROBOT ONLINE
    // Creating the parser and piping can be shortened to
    port.open(function (err) {
        if (err) {
            console.log('Error opening port: ', err.message);
            process.exit(1);
            return;
        }
        console.log('SerialPort open CB');
    });
    return port;
}
async function start() {
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
    const port = openSerialPort();
    const meter = new PTMeter(port);
    meter.startRead();
}
start().then(() => console.log('done')).catch((e) => console.error('error', e));
