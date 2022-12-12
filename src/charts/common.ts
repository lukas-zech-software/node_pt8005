import * as _ from 'lodash';
import { DateTime } from 'luxon';

export type FromToTimestamp = {
	from: string;
	to: string;
	toTimestamp: number;
	fromTimestamp: number;
	toDate: DateTime;
	fromDate: DateTime;
}
export type BeginEndResult = {
	begin: number;
	end: number;
}

export type QuarterHourResult = BeginEndResult & {

	quarter: number;
	hour: string;
}

export function getFromToTimestamp(data: BeginEndResult[]): FromToTimestamp {
	const fromTimestamp: number = _.max(data.map(x => x.begin)) || 0;
	const toTimestamp: number = _.max(data.map(x => x.end)) || 0;

	const fromDate = DateTime.fromSeconds(fromTimestamp);
	const toDate = DateTime.fromSeconds(toTimestamp);

	const from = fromDate.toFormat("dd.MM.yyyy")
	const to = toDate.toFormat("dd.MM.yyyy")

	return {from, to, fromTimestamp, toTimestamp, fromDate, toDate}
}

export function filterDataMax<T extends { max: number }>(data: T[]): T[] {
	return data.filter(x => x.max < 100)
}
