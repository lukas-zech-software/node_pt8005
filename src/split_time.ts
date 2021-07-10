import * as SerialPort from 'serialport';
import Stream from 'stream';
import { createInterface } from 'readline';
import { writeFileSync } from 'fs';
import Delimiter = SerialPort.parsers.Delimiter;
import { inspect } from 'util';


let counter = 1;

enum FLAGS {
  TERMINATOR = 0x00,
  DELIMITER = 0xA5,

  SPEED_FAST = 0x02,
  SPEED_SLOW = 0x03,
  MODE_MAX = 0x04,
  MODE_MIN = 0x05,
  TIME = 0x06,
  LIMIT_OVER = 0x07,
  LIMIT_UNDER = 0x08,

  RANGE_30_80 = 0x10,
  _RANGE_30_80 = 0x30,

  _RANGE_50_100 = 0x20,
  RANGE_50_100 = 0x75,

  RANGE_80_130 = 0x76,
  RANGE_30_130 = 0x40,
  FREQUENZY_DBA = 0x1B,
  FREQUENZY_DBC = 0x1C,
  DATA = 0x0D,


  _FULL = 0x23,
  HOLD = 0x11,
}

function doWeirdStuffWithCharCode (charCode: number, factor: number) {
  let modulo = charCode % 16;
  let someNumber = charCode / 16;
  someNumber = Math.trunc(someNumber);
  someNumber = someNumber * 10;

  return (someNumber + modulo) * factor;
}

function calcTime (buffer: Buffer) {
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
    hour += 12
  }

  return `${hour}:${minutes}:${seconds}`
}

function calcData (buffer: Buffer) {
  //<Buffer 04 52>
  const bufferString = buffer.toString('hex');
  let [v100 = '0', v10 = '0', v1 = '0', v01 = '0'] = bufferString;
  console.log("[v100='0',v10='0',v1='0',v01='0']", [v100, v10, v1, v01]);
  const parsed = parseInt(bufferString, 10)

  return parsed / 10;
}

function calcDataWeird (buffer: Buffer) {
  //<Buffer 0d 04 52>
  const bufferString = buffer.toString();
  const charCode1 = bufferString.charCodeAt(3);
  const charCode2 = bufferString.charCodeAt(4);

  const value1 = doWeirdStuffWithCharCode(charCode1, 10);
  const value2 = doWeirdStuffWithCharCode(charCode2, 0.1);

  return value1 + value2
}

function setFrameValue (frame: PTFrame, flag: string, data: Buffer) {
  let unkown = false

  switch (flag) {
    case FLAGS[FLAGS.RANGE_30_80]:
    case FLAGS[FLAGS.RANGE_30_130]:
    case FLAGS[FLAGS.RANGE_50_100]:
    case FLAGS[FLAGS.RANGE_80_130]:
    case FLAGS[FLAGS._RANGE_30_80]:
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
    case FLAGS[FLAGS._FULL]:
      frame.values.full = true
      break;
    case FLAGS[FLAGS.DATA]:
      frame.values.value = calcData(data);
      break;
    case FLAGS[FLAGS.TIME]:
      frame.values.time = calcTime(data)
      break;
    case undefined:
    default: {
      unkown = true
      //console.log('buffer', buffer);
      frame.unknown = frame.unknown || {}
      frame.unknown[flag] = data.toString('hex');
    }
  }
  if (!unkown) {
    frame.parsed = frame.parsed || {}
    frame.parsed[flag] = data.toString('hex');
  }
}


type PTFrame = {
  index: number;
  values: Partial<PTMeterValues>;
  settings: Partial<PTMeterSettings>;
  unknown: any
  parsed: any

}

type PTMeterValues = {
  value: number;
  hold: false | number;
  full: true | undefined;
  limit: "over" | "under" | undefined;
  time: any
}

type PTMeterSettings = {
  range: string;
  speed: "slow" | "fast";
  frequency: "dbA" | "dbC";
  mode: "min" | "max" | "default";
  unknown: any
}

class PTMeter {

  private shouldReadNext: boolean = true;

  private drop: number = 0;
  private parser: Stream.Transform;
  private frames: { frame: PTFrame, buffer: string }[] = [];
  private currentSettings: PTMeterSettings | null = null;


  private index = 1
  private allBuff: any = []
  private all: any = []
  private last: any;

  constructor (private port: SerialPort) {
    this.parser = new Delimiter({
      delimiter: Buffer.from([FLAGS.TERMINATOR, FLAGS.DELIMITER]),
      includeDelimiter: false
    });
    this.port.pipe(this.parser);


    const readLine = createInterface({
      input: process.stdin,
    });
    readLine.on('line', () => {
      this.shouldReadNext = true;
    });
  }


  startRead () {

    this.port.addListener('data', (buf: Buffer) => {
      this.allBuff.push(buf.toString('hex'))
    });

    this.parser.addListener('data', buf => {
      this.parseReadResult(buf);
    });

    setInterval(() => {
      this.writeLog()
    }, 1000)
  }

  private writeLog (): void {
    //console.clear()
    //console.log(this.frames[this.frames.length - 1]);

    writeFileSync('./buflog.txt', this.allBuff.join(''))
    writeFileSync('./framelog.json', JSON.stringify(this.frames))

  }

  private parseReadResult (buffer: Buffer): void {
    const bufStr = buffer.toString('hex')
    const parts = bufStr.split(FLAGS.DELIMITER.toString(16))

    //console.log('parts', parts);
    //console.log('parts', JSON.stringify(parts.map(x => FLAGS[parseInt(x.slice(0, 2), 16)])));
    //console.log('parts', JSON.stringify(parts.map(x => FLAGS[Buffer.from(x, 'hex')[0]])));

    const frame: PTFrame = {
      index: counter++,
      unknown: {},
      parsed: {},
      values: {},
      settings: { mode: 'default' }
    }

    parts.forEach((part) => {
      const b = Buffer.from(part, 'hex')
      /*first byte of buffer is the flag*/
      /*rest of buffer contains value - if any*/
      const [flag, ...rest] = b;
      setFrameValue(frame, FLAGS[flag], Buffer.from(rest))
      // console.log('byte', byte, FLAGS[byte]);
    })
    this.frames.push({ frame, buffer: buffer.toString('hex') });

    console.clear()
    console.log(inspect(frame.values,false,null,true));
    /* do {


         i = b.indexOf(FLAGS.DELIMITER);
     } while (i)
*/
    /*if (this.drop++ % 20 !== 0) {
        return;
    }*/
    // this.setCurrent(buffer);


  }
}

function openSerialPort (): SerialPort {
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

async function start () {
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
