import * as SerialPort from 'serialport';
import Stream from 'stream';
import { createInterface } from 'readline';
import { inRange, max, mean, min, round } from 'lodash';
import Delimiter = SerialPort.parsers.Delimiter;

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
  //console.log("[v100='0',v10='0',v1='0',v01='0']", [v100, v10, v1, v01]);
  const parsed = parseInt(bufferString, 10)

  return parsed / 10;
}

type PTFrame = {
  index: number;
  timestamp: number;
  readings: PTMeterReadings;
  settings: Partial<PTMeterSettings>;
  unknown?: any
  parsed?: any
}

type PTMeterReadings = {
  value: number;
  time: string;
  hold?: number | undefined;
  full?: true | undefined;
  rangeLimitExceeded?: "over" | "under" | undefined;
}

type PTMeterSettings = {
  range: string;
  speed: "slow" | "fast";
  frequency: "dbA" | "dbC";
  mode: "min" | "max" | "default";
}

type PTMeterValueAggregate = {
  min: number;
  max: number;
  mean: number;
  //start: number;
  //end: number;
  //interval: number;
}

class PTMeter {
  private readonly interval = 1000;
  private readonly verbose = true;

  private shouldReadNext: boolean = true;
  private totalFramesRead: number = 0;
  private parser: Stream.Transform;
  //private frames: { frame: PTFrame, buffer?: string }[] = [];
  private frames: Array<PTFrame> = [];

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
    this.parser.addListener('data', buf => {
      this.parseReadResult(buf);
    });

    setInterval(() => {
      this.writeLog()
    }, this.interval)
  }

  private writeLog (): void {
    const lastFrames = this.frames;
    this.frames = [];

    const validFrames = lastFrames
      .filter(x => x.readings.rangeLimitExceeded === undefined)
      .filter(x => x.readings.hold === undefined);
    const diff = lastFrames.length - validFrames.length;

    if (diff !== 0) {
      console.log(`Dropped ${diff} invalid frames`);
    }

    const values = validFrames
      .map(x => x.readings.value);
    const validValues = values.filter(x => x !== undefined && inRange(x, 30, 120))

    const diffVal = values.length - validValues.length;
    if (diffVal !== 0) {
      console.log(`Dropped ${diff} invalid values`);
    }

    const agg: PTMeterValueAggregate = {
      min: round(min(validValues) || 0, 1),
      max: round(max(validValues) || 0, 1),
      mean: round(mean(validValues) || 0, 1),
    }

    console.log('agg', agg);
    //writeFileSync('./framelog.json', JSON.stringify(this.frames))
  }

  private parseReadResult (buffer: Buffer): void {
    const bufStr = buffer.toString('hex')
    const parts = bufStr.split(FLAGS.DELIMITER.toString(16))

    const frame: PTFrame = {
      index: this.totalFramesRead++,
      timestamp: Date.now(),
      readings: {
        value: NaN,
        time: ""
      },
      settings: { mode: 'default' }
    }

    if (this.verbose) {
      frame.unknown = {}
      frame.parsed = {}
    }


    parts.forEach((part) => {
      const partBuffer = Buffer.from(part, 'hex')
      /*first byte of buffer is the flag*/
      /*rest of buffer contains value - if any*/
      const [flag, ...rest] = partBuffer;
      this.setFrameValue(frame, FLAGS[flag], Buffer.from(rest))
    })

    this.frames.push(frame);
  }

  private setFrameValue (frame: PTFrame, flag: string, data: Buffer) {
    let unknown = false

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
        frame.readings.rangeLimitExceeded = 'over';
        break;
      case FLAGS[FLAGS.LIMIT_UNDER]:
        frame.readings.rangeLimitExceeded = 'under';
        break;
      case FLAGS[FLAGS.HOLD]:
        frame.readings.hold = data.length > 1 ? data.length : undefined;
        break;
      case FLAGS[FLAGS._FULL]:
        frame.readings.full = true
        break;
      case FLAGS[FLAGS.DATA]:
        frame.readings.value = calcData(data);
        break;
      case FLAGS[FLAGS.TIME]:
        frame.readings.time = calcTime(data)
        break;
      case undefined:
      default: {
        if (!this.verbose) return;
        unknown = true
        //console.log('buffer', buffer);
        frame.unknown = frame.unknown || {}
        frame.unknown[flag] = data.toString('hex');
      }
    }

    if (!this.verbose) return;
    if (!unknown) {
      frame.parsed = frame.parsed || {}
      frame.parsed[flag] = data.toString('hex');
    }
  }
}

function openSerialPort (): SerialPort {
  const device = '/dev/tty.usbserial-0001';

  const port = new SerialPort(device, {
    baudRate: 9600,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    autoOpen: false
  })

  port.on('error', function (err) {
    console.error('SerialPort Error: ', err.message)
    process.exit(1);
  })

  port.open(function (err) {
    if (err) {
      console.log('Error opening port: ', err.message)
      process.exit(1);
      return;
    }

    console.log(`SerialPort open for device "${device}"`)
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
