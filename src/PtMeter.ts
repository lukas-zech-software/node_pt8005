import * as SerialPort from 'serialport';
import Stream from 'stream';
import { inRange, max, mean, min, round } from 'lodash';
import { DbService } from './db';
import {
	MeasurementValuesEntry,
	PtMeterEnvironmentInfo,
	PTMeterReadings,
	PTMeterSettings,
	PtMeterStatus,
	PTMeterValueAggregate
} from './common';
import Delimiter = SerialPort.parsers.Delimiter;

// No documentation is available for the serial protocol
// These values are what I could reverse engineer / guess from observing and experimenting

// Header that defines the type of the payload in the frame
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

	RANGE_30_80 = 0x30,

	RANGE_50_100 = 0x4B,

	RANGE_80_130 = 0x4C,
	RANGE_30_130 = 0x40,
	FREQUENZY_DBA = 0x1B,
	FREQUENZY_DBC = 0x1C,
	DATA = 0x0D,


	RECORDING = 0xA,
	_FULL = 0x23,
	HOLD = 0x11,

	// TODO: Unknown flags found in serial data
	XX1 = 0x19,
	XX2 = 0x1F,
	XX3 = 0x1A,
	XX4 = 0xC,
	XX5 = 0xB,
	XX7_IN_RANGE = 0xE,
	XX9 = 0x76,
	XX10 = 0x75,
	XX_RANGE_30_80 = 0x10,
	XX_RANGE_50_100 = 0x20,
}

// Send these to change the current configuration of the device
// TODO: Sending configuration does not seem to work reliably -> need to debug protocol
enum COMMANDS {
	Min_Max = 0x11,
	off = 0x33,
	rec = 0x55,
	speed = 0x77,
	range = 0x88,
	dBA_C = 0x99
}

// Noise ranges for calibration of the device
type Ranges = FLAGS.RANGE_30_80 | FLAGS.RANGE_50_100 | FLAGS.RANGE_80_130 | FLAGS.RANGE_30_130;


/**
 * Decode the custom time format sent by the device
 * @param buffer
 */
function decodeTimeBuffer(buffer: Buffer) {
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

function decodeDateBuffer(buffer: Buffer) {
	//<Buffer 04 52>
	const bufferString = buffer.toString('hex');
	// let [v100 = '0', v10 = '0', v1 = '0', v01 = '0'] = bufferString;
	// console.log("[v100='0',v10='0',v1='0',v01='0']", [v100, v10, v1, v01]);
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

let instance: PTMeter;

/**
 * Represents a PT_8005 device connected to USB serial port
 */
export class PTMeter {
	public static getInstance(): PTMeter {
		if (instance === undefined) {
			instance = new PTMeter()
		}

		return instance;
	}

	private readonly logInterval = 1000;
	private readonly writeInterval = 10000;
	private readonly verbose: boolean = !!process.env.PT_VERBOSE;
	private readonly parser: Stream.Transform;
	private readonly db: DbService;
	private readonly port: SerialPort
	private currentEnvironmentInfo: PtMeterEnvironmentInfo;
	private lastSettings: PTMeterSettings | undefined = undefined;
	private lastValues: PTMeterValueAggregate | undefined = undefined;
	private infoMessage: string = "Not initialised";
	private errorMessage: string | undefined = undefined;
	private totalFramesRead: number = 0;
	private framesBuffer: Array<PTFrame> = [];
	private measurementValuesEntriesBuffer: Array<MeasurementValuesEntry> = [];
	private targetRange: Ranges = FLAGS.RANGE_30_130;

	constructor() {
		this.port = this.openSerialPort();

		this.db = DbService.getInstance();
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
			this.infoMessage = "Data received once"
		});

		this.parser.addListener('error', err => {
			this.errorMessage = "Error: " + err;

			console.error('error on parser', err);
			throw err
		});


		setInterval(() => {
			this.aggregateFrames()
		}, this.logInterval)

		setInterval(() => {
			this.writeValuesToDb()
		}, this.writeInterval)

		/*this.init().then(() => {
			this.infoMessage = "Initialised"
		})*/
	}

	/*

	TODO: Set a specific configuration on device before logging
	  Check binary protocol - currently the device always reset the config immediatelly

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

	public getMeterStatus(): PtMeterStatus {
		return {
			info: this.infoMessage,
			error: this.errorMessage,
			values: this.lastValues,
			settings: this.lastSettings,
			environmentInfo: this.currentEnvironmentInfo,
		}
	}

	public setEnvironment(environment: Partial<PtMeterEnvironmentInfo>): void {
		this.currentEnvironmentInfo = {...this.currentEnvironmentInfo, ...environment}
		this.db.setLastState(this.currentEnvironmentInfo)
	}

	public async sendCommand(command: COMMANDS): Promise<void> {
		return new Promise((resolve, reject) => {
			this.port.write([command], (err) => {
				if (err) {
					console.log('Error on write: ', err.message)
					reject(err);
					return;
				}
				console.log(`command ${COMMANDS[command]} written`)
				resolve();
			})
		})
	}

	private writeValuesToDb(): void {
		const valuesToWrite = this.measurementValuesEntriesBuffer;
		this.measurementValuesEntriesBuffer = [];
		this.infoMessage = `${valuesToWrite.length} values written to DB at ${new Date().toISOString()}`

		this.db.writeValues(valuesToWrite)
	}

	private openSerialPort(): SerialPort {
		const device = process.env.PT_DEVICE || '/dev/tty.usbserial-0001';

		const port = new SerialPort(device, {
			baudRate: 9600,
			dataBits: 8,
			parity: 'none',
			stopBits: 1,
			autoOpen: false
		})

		port.on('error', (err) => {
			console.error('SerialPort Error: ', err.message)
			this.errorMessage = 'SerialPort Error: ' + err.toString()
		})

		port.open((err) => {
			if (err) {
				console.error('Error opening port: ', err.message)
				this.errorMessage = 'Error opening port: ' + err.toString()
				return;
			}

			let message = `SerialPort open for device "${device}"`;
			this.infoMessage = message;
			console.log(message)
		})

		return port
	}

	private aggregateFrames(): void {
		const lastFrames = this.framesBuffer;
		this.framesBuffer = [];

		if (lastFrames.length === 0) {
			console.warn('No frames received. Check Meter');
			this.infoMessage = "No data received. Check Meter";
			return;
		}

		lastFrames.forEach(x => this.lastSettings = Object.assign({}, this.lastSettings, x.settings))

		const validFrames = lastFrames
				.filter(x => x.readings.rangeLimitExceeded === undefined)
				.filter(x => x.readings.hold === undefined);

		const values = validFrames.map(x => x.readings.value);
		// TODO: Use current range from device?
		const validValues = values.filter(x => x !== undefined && inRange(x, 20, 120))

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

		const aggregate: PTMeterValueAggregate = {
			min: round(min(validValues) || 0, 1),
			max: round(max(validValues) || 0, 1),
			mean: round(mean(validValues) || 0, 1),
		}

		if (this.verbose) {
			console.log(`Aggregate`, aggregate);
		}

		this.lastValues = aggregate;
		this.bufferMeasurementValuesEntry(aggregate);
	}

	private bufferMeasurementValuesEntry(aggregate: PTMeterValueAggregate) {
		this.measurementValuesEntriesBuffer.push({
			...aggregate,
			interval: this.logInterval,
			timestamp: Math.floor(Date.now() / 1000),
			environment_id: this.currentEnvironmentInfo.environment,
			window_state_id: this.currentEnvironmentInfo.windowState,
		})
	}

	private parseReadResult(buffer: Buffer): void {
		const bufStr = buffer.toString('hex')
		const parts = bufStr.split(FLAGS.DELIMITER.toString(16))

		const frame: PTFrame = {
			index: this.verbose ? this.totalFramesRead++ : -1,
			timestamp: Date.now(),
			readings: {
				value: NaN,
				time: ""
			},
			settings: {mode: 'default', recording: false, full: false}
		}

		if (this.verbose) {
			frame.unknown = {}
			frame.parsed = {}
		}


		parts.forEach((part) => {
			const partBuffer = Buffer.from(part, 'hex')
			if (partBuffer.length === 0) return;
			/*first byte of buffer is the flag*/
			/*rest of buffer contains value - if any*/
			const [flag, ...rest] = partBuffer;
			this.setFrameValue(frame, FLAGS[flag] || flag.toString(16), Buffer.from(rest))
		})

		this.framesBuffer.push(frame);
	}

	private setFrameValue(frame: PTFrame, flag: string, data: Buffer) {
		let unknown = false

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
				frame.settings.full = true
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
				frame.readings.value = decodeDateBuffer(data);
				break;
			case FLAGS[FLAGS.TIME]:
				frame.readings.time = decodeTimeBuffer(data)
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

