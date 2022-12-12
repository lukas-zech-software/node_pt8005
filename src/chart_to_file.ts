import { ChartConfiguration } from 'chart.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { DbService } from './db';
import { WindowStateEnum } from './common';
import { ChartNames, loadChartConfig, renderChartToBuffer } from './chart';

async function renderChartToFile(name: string, configuration: ChartConfiguration): Promise<void> {
	try {
		const image = await renderChartToBuffer(configuration);

		const outDir = join(__dirname, '../generated_charts');
		if (!existsSync(outDir)) {
			mkdirSync(outDir)
		}
		const outFile = join(outDir, name);

		await writeFile(outFile, image)

		console.log('Rendered chart to file:', outFile);
	} catch (error) {
		console.error('Error while rendering chart', error);
	}
}

/**
 * This script can be invoked via CLI to render a chart to a png file
 */
(async () => {
	try {
		DbService.getInstance()

		// TODO: use yargs to get provided parameters and validate them
		// TODO: add parameters for chart height and width
		const chartName = process.argv[2] as ChartNames
		const windowState: WindowStateEnum = parseInt(process.argv[3] ?? '1', 10)
		const outputFileName = process.argv[4] ?? `${chartName}_${new Date().toISOString()}.png`

		const chartConfiguration = await loadChartConfig(chartName, {windowState})
		await renderChartToFile(outputFileName, chartConfiguration)
	} catch (error) {
		console.error('An Error occurred: ', error);
		process.exit(1);
	}
})()

