export type MeasurementValuesEntry = {
	min: number;
	max: number;
	mean: number;
	interval: number;
	timestamp: number;
	environment_id: number;
	window_state_id: number;
}
export type MeasurementValuesExport = {
	min: number;
	max: number;
	mean: number;
	datetime: string;
	environment: string;
	windowState: string;
}


export type PTMeterValueAggregate = {
	min: number;
	max: number;
	mean: number;
	//start: number;
	//end: number;
	//interval: number;
}

export type PTMeterReadings = {
	value: number;
	time: string;
	hold?: number | undefined;
	rangeLimitExceeded?: "over" | "under" | undefined;
}

export type PTMeterSettings = {
	range: string;
	full: boolean;
	recording: boolean;
	speed: "slow" | "fast";
	frequency: "dbA" | "dbC";
	mode: "min" | "max" | "default";
}

export type PtMeterStatus = {
	info: string;
	error: string | undefined,
	values: PTMeterValueAggregate | undefined,
	settings: Partial<PTMeterSettings> | undefined,
	environmentInfo: PtMeterEnvironmentInfo
}

export type PtMeterEnvironmentInfo = {
	environment: number,
	windowState: number,
}

export type WindowState = { id: number; name: string }
export type EnvironmentState = WindowState

export type DbEnvironmentsAndWindowState = {
	valuesCount: number;
	environments: Array<EnvironmentState>,
	windowStates: Array<WindowState>,
}

export enum WindowStateEnum {
	"N/A" = 1,
	"offen" = 2,
	"gekippt" = 3,
	"geschlossen" = 4,
	"draußen" = 5,
}

export type ChartParams = {
	windowState: WindowStateEnum
}
