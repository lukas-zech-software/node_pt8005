import { ChartConfiguration } from 'chart.js';

import { CanvasRenderService } from 'chartjs-node-canvas';
import { ChartParams } from './common';
import * as ChartDaytime45_55 from './charts/daytime_45_55';
import * as ChartNighttime45db from './charts/nighttime_45';
import * as ChartMaxMean from './charts/max_mean';

export type ChartNames = 'daytime_45_55' | 'nighttime_45' | 'max_mean'

export function getCanvasRenderService(width: number = 1920, height: number = 1080) {
	return new CanvasRenderService(width, height, (ChartJS) => {
		ChartJS.plugins.register({
			beforeDraw: (chart: any, options: any) => {
				const ctx = chart.ctx;
				ctx.save();
				ctx.fillStyle = 'white';
				ctx.fillRect(0, 0, width, height);
				ctx.restore();
			}
		});
	});
}


export async function loadChartConfig(chartName: ChartNames, chartParams: ChartParams): Promise<ChartConfiguration> {
	switch (chartName) {
		case 'daytime_45_55':
			return ChartDaytime45_55.getChartConfig(chartParams)
		case 'nighttime_45':
			return ChartNighttime45db.getChartConfig(chartParams)
		case 'max_mean':
			return ChartMaxMean.getChartConfig(chartParams)
		default:
			throw new Error(`Unknown chart ${chartName}`)
	}
}

export async function renderChartToBuffer(configuration: ChartConfiguration): Promise<Buffer> {
	const canvasRenderService = getCanvasRenderService();
	const buffer = await canvasRenderService.renderToBuffer(configuration);
	console.debug(`Render Chart to buffer with ${buffer.length} bytes`,);
	return buffer

}

