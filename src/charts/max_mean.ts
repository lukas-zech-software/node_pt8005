import { ChartConfiguration } from 'chart.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { DbService } from '../db';
import { ChartParams, WindowStateEnum } from '../common';
import { filterDataMax, getFromToTimestamp, QuarterHourResult } from './common';


export type MaxMeanResult = QuarterHourResult & {
	count: number;
	min: number;
	max: number;
	mean: number;
}


type QDataset = {
	count: number;
	max: number[];
	mean: number[];
	labels: string[];
	from: string;
	to: string;
}


function mapData(data: MaxMeanResult[]): QDataset {
	const {from, to} = getFromToTimestamp(data);

	const count = data.reduce((sum, x) => sum + x.count, 0)
	const max = data.map(x => x.max)
	const mean = data.map(x => x.mean)
	const labels = data.map(x => `${x.hour}:${x.quarter}`)
	return {from, to, count, max, mean, labels}
}

async function getChartData(p: ChartParams): Promise<any> {
	const query = await readFile(join(__dirname, './max_mean.sql'))
	const db = DbService.getInstance();
	const queryString = query.toString('utf8').replace("$window_state_id$", p.windowState.toString());
	const data = db.executeQuery(queryString)
	return filterDataMax(data)
}

export async function getChartConfig(p: ChartParams): Promise<ChartConfiguration> {
	const data = await getChartData(p)
	const mappedData = mapData(data);

	const configuration: ChartConfiguration = {
		type: 'line',
		data: {
			labels: mappedData.labels,
			datasets: [
				{
					label: 'Max',
					data: mappedData.max,
					fill: false,
					borderColor: 'red',
				},
				{
					label: 'Mittel',
					data: mappedData.mean,
					fill: false,
					borderColor: 'blue',
				},
			]
		},
		options: {
			title: {
				display: true,
				text: [
					`Maximaler und mittlerer Lärmpegel db(A) über den Tag - Fenster "${WindowStateEnum[p.windowState]}"`,
					`Gemessen zwischen ${mappedData.from} und ${mappedData.to} - ${mappedData.count} Messwerte (1/s)`
				],
				fontSize: 24,
				padding: 16
			},
			scales: {
				yAxes: [{
					ticks: {
						major: {
							fontSize: 16,
							fontColor: 'blue'
						},
						minor: {
							fontSize: 24,
							fontColor: 'black'
						}
					}
				}],
				xAxes: [{
					ticks: {
						major: {
							fontSize: 16,
							fontColor: 'black'
						},
						minor: {
							fontSize: 24,
							fontColor: 'black'
						}
					}
				}]
			}
		}
	};

	return configuration;
}
