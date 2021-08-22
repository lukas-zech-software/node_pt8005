import { ChartConfiguration } from 'chart.js';

import { CanvasRenderService } from 'chartjs-node-canvas';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { DbService } from './db';
import { getChartConfig as getChartConfig55_45 } from './charts/gt55_45';
import { getChartConfig as getChartConfigGt45_Night } from './charts/gt45_night';
import { WindowStateEnum } from './common';


const height = 1080;
const width = 1920;
const canvasRenderService = new CanvasRenderService(width, height, (ChartJS) => {
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

async function renderChartToFile(name: string, configuration: ChartConfiguration): Promise<void> {
	try {
		const image = await canvasRenderService.renderToBuffer(configuration);
		const outDir = join(__dirname, '../generated_charts');
		if (!existsSync(outDir)) {
			mkdirSync(outDir)
		}
		const outFile = join(outDir, name);

		await writeFile(outFile, image)

		console.log('outFile', outFile);

	} catch (error) {
		console.error('error', error);
	}
}

(async () => {
	try {
		DbService.getInstance()
		//const maxMean = await getChartConfigMaxMean({windowState:WindowStateEnum.offen})
		//await renderChartToFile("maxMean.png",maxMean)

		//const gt55_45 = await getChartConfig55_45({windowState:WindowStateEnum.offen})
		//await renderChartToFile("gt55_45.png",gt55_45)

		const gt_45_Night = await getChartConfigGt45_Night({windowState: WindowStateEnum.offen})
		await renderChartToFile("gt_45_Night.png", gt_45_Night)
	} catch (error) {
		console.error('error on start', error);
		process.exit(1);
	}
})()

