import * as SerialPort from 'serialport';
import Stream from 'stream';
import { isEqual, reduce } from 'lodash';
import { inspect } from 'util';
import { createInterface } from 'readline';
import Delimiter = SerialPort.parsers.Delimiter;


let counter = 1;

function diff<T>(a: any, b: any): any {
    return reduce(Object.entries(a), (result: any[], [key, value]) => {
        if (isEqual(value, b[key])) {
            return result;
        } else {
            return result.concat(
                {[key]: value}
            );
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
}

enum FLAGS {
    SPEED_FAST = 0x02,
    SPEED_SLOW = 0x03,
    MODE_MAX = 0x04,
    MODE_MIN = 0x05,
    TIME = 0x06,
    LIMIT_OVER = 0x07,
    LIMIT_UNDER = 0x08,
    RANGE_30_80 = 0x10,
    _RANGE_50_100 = 0x20,
    RANGE_50_100 = 0x75,
    _RANGE_80_130 = 0x30,
    RANGE_80_130 = 0x76,
    RANGE_30_130 = 0x40,
    FREQUENZY_DBA = 0x1B,
    FREQUENZY_DBC = 0x1C,
    DATA = 0x0D,


    HOLD = 0x11,
}

function doWeirdStuffWithCharCode(charCode: number, factor: number) {
    let modulo = charCode % 16;
    let someNumber = charCode / 16;
    someNumber = Math.trunc(someNumber);
    someNumber = someNumber * 10;

    return (someNumber + modulo) * factor;
}

function calcData(buffer: Buffer) {
    //<Buffer 04 52>
    const bufferString = buffer.toString();
    const charCode1 = bufferString.charCodeAt(3);
    const charCode2 = bufferString.charCodeAt(4);

    const value1 = doWeirdStuffWithCharCode(charCode1, 10);
    const value2 = doWeirdStuffWithCharCode(charCode2, 0.1);

    return value1 + value2
}

function setFrameValue(frame: PTFrame, flag: string, data: Buffer) {
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
            frame.unknown = frame.unknown || {}
            frame.unknown[flag] = data;
        }
    }
}


type PTFrame = {
    index: number;
    values: PTMeterValues;
    settings: PTMeterSettings;
    unknown: any

}

type PTMeterValues = {
    value: number;
    hold: false | number;
    limit: "over" | "under" | false;
    time: any
}

type PTMeterSettings = {
    range: string;
    speed: "slow" | "fast";
    frequency: "dbA" | "dbC";
    mode: "min" | "max";
    unknown: any
}

class PTMeter {
    private shouldReadNext: boolean = true;

    private drop: number = 0;
    private parser: Stream.Transform;
    private frames: PTFrame[] = [];
    private currentSettings: PTMeterSettings | null = null;


    private index = 1
    private allBuff: any = []
    private all: any = []
    private last: any;

    constructor(private port: SerialPort) {
        this.parser = new Delimiter({delimiter: Buffer.from([0xa5])});
        this.port.pipe(this.parser);


        const readLine = createInterface({
            input: process.stdin,
        });
        readLine.on('line', () => {
            this.shouldReadNext = true;
        });
    }

    command(command: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.port.write(command, (err) => {
                if (err) {
                    console.log('Error on write: ', err.message)
                    reject(err);
                    return;
                }
                console.log('command written')
                resolve();
            })
        })
    }

    setRange(): Promise<void> {
        return new Promise((resolve) => {

        })

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


    private getCurrent() {
        if (this.all[this.index] === undefined) {
            this.all[this.index] = {all: []}
        }
        return this.all[this.index];

    }

    private setCurrent(buffer: Buffer): void {
        let current = this.getCurrent();

        let b0 = buffer[0];
        let s = FLAGS[b0] || b0.toString();

        if (
            current[s] !== undefined
        ) {
            //console.log('Frame Change at', s, this.last);
            this.parseFrame(current)
            this.index++
            current = this.getCurrent();
        }

        current.all.push(s/*{[s]: buffer}*/);
        current[s] = buffer;
        this.last = s;
    }

    private parseFrame(frameObj: Object): void {
        // todo: always parse settings
        if (this.shouldReadNext) {
            this.shouldReadNext = false;

            const frame: PTFrame = {
                index: counter++,
                unknown: {},
                values: {} as any,
                settings: this.currentSettings || {} as any
            }

            const parsedFrame = Array.from(Object.entries(frameObj)).reduce((previous, [key, value], index) => {
                setFrameValue(previous, key, value);
                return previous;
            }, frame);


            console.clear()
            console.log('parsedFrame', inspect(parsedFrame, {depth: null, compact: false, colors: true}));
            console.log(counter + '--------------------------------');

            this.currentSettings = parsedFrame.settings
            this.frames.push(parsedFrame);
        }


    }

    private parseReadResult(buffer: Buffer): void {

        /*if (this.drop++ % 20 !== 0) {
            return;
        }*/
        this.setCurrent(buffer);


    }
}

function openSerialPort(): SerialPort {
    const port = new SerialPort('/dev/tty.usbserial-0001', {
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        autoOpen: false
    })

// Switches the port into "flowing mode"
    // port.on('data', function (data) {
    //     console.log('Data:', data)
    //})

    // Open errors will be emitted as an error event
    port.on('error', function (err) {
        console.error('SerialPort Error: ', err.message)
    })


// The open event is always emitted
    port.on('open', function () {
        console.log('SerialPort open EVENT')
    })


// ROBOT ONLINE

// Creating the parser and piping can be shortened to

    port.open(function (err) {
        if (err) {
            console.log('Error opening port: ', err.message)
            process.exit(1);
            return;
        }

        console.log('SerialPort open CB')
    })

    return port
}

async function start() {
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

    const port = openSerialPort();
    const meter = new PTMeter(port);
    meter.startRead();

}


start().then(() => console.log('done')).catch((e) => console.error('error', e))
