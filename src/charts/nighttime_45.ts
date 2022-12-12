import { ChartConfiguration } from 'chart.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Interval } from 'luxon'
import { DbService } from '../db';
import { ChartParams, WindowStateEnum } from '../common';
import { getFromToTimestamp, QuarterHourResult } from './common';

type Night_DbResult = {
	data45: Array<Night_Result>,
}

export type Night_Result = QuarterHourResult & {
	value: number;
}

type QDataset = {
	count45: number[];
	labels: string[];
	from: string;
	to: string;
}

function mapData({data45}: Night_DbResult): QDataset {
	const {from, to, fromDate, toDate} = getFromToTimestamp(data45);
	const inter = Interval.fromDateTimes(fromDate, toDate);
	let days = inter.length("days");


	console.log('inter.length("day")', days);
	const count45 = data45.map(x => x.value / days)

	const labels = data45.map(x => `${x.hour} Uhr`)

	return {from, to, count45, labels}
}

async function getChartData(p: ChartParams): Promise<Night_DbResult> {
	const db = DbService.getInstance();

	const query45 = await readFile(join(__dirname, './gt45_night.sql'))

	const queryString45 = query45.toString('utf8')
			.replace("$window_state_id$", p.windowState.toString());

	const data45 = db.executeQuery(queryString45)

	return {data45}
}

export async function getChartConfig(p: ChartParams): Promise<ChartConfiguration> {
	const data = await getChartData(p)
	const mappedData = mapData(data);

	const configuration: ChartConfiguration = {
		type: 'bar',
		data: {
			labels: mappedData.labels,
			datasets: [
				{
					label: '45 db(A)',
					data: mappedData.count45,
					backgroundColor: 'rgb(255, 205, 86)',
				},
			]
		},
		options: {
			title: {
				display: true,
				text: [
					`Grenzwerte nachts überschritten pro Tag - Fenster "${WindowStateEnum[p.windowState]}"`,
					`Gemessen zwischen ${mappedData.from} und ${mappedData.to} - ${0} Messwerte (1/s)`
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

/*

new Chart(document.getElementById("chartjs-1"), {
	"type": "bar",
	"data": {
		"labels": ["January", "February", "March", "April", "May", "June", "July"],
		"datasets": [{
			"label": "My First Dataset",
			"data": [65, 59, 80, 81, 56, 55, 40],
			"fill": false,
			"backgroundColor": ["rgba(255, 99, 132, 0.2)", "rgba(255, 159, 64, 0.2)", "rgba(255, 205, 86, 0.2)", "rgba(75, 192, 192, 0.2)", "rgba(54, 162, 235, 0.2)", "rgba(153, 102, 255, 0.2)", "rgba(201, 203, 207, 0.2)"],
			"borderColor": ["rgb(255, 99, 132)", "rgb(255, 159, 64)", "rgb(255, 205, 86)", "rgb(75, 192, 192)", "rgb(54, 162, 235)", "rgb(153, 102, 255)", "rgb(201, 203, 207)"],
			"borderWidth": 1
		}]
	},
	"options": {"scales": {"yAxes": [{"ticks": {"beginAtZero": true}}]}}
});
*/
