"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chartjs_node_canvas_1 = require("chartjs-node-canvas");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const width = 400;
const height = 400;
const chartJSNodeCanvas = new chartjs_node_canvas_1.ChartJSNodeCanvas({
    width, height, chartCallback: (ChartJS) => {
    }
});
(async () => {
    const configuration = {
        type: 'bar',
        data: {
            labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
            datasets: [{
                    label: '# of Votes',
                    data: [12, 19, 3, 5, 2, 3],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.2)',
                        'rgba(54, 162, 235, 0.2)',
                        'rgba(255, 206, 86, 0.2)',
                        'rgba(75, 192, 192, 0.2)',
                        'rgba(153, 102, 255, 0.2)',
                        'rgba(255, 159, 64, 0.2)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    };
    try {
        const image = await chartJSNodeCanvas.renderToBuffer(configuration);
        const outDir = path_1.join(__dirname, '../generated_charts');
        await promises_1.mkdir(outDir);
        const outFile = path_1.join(outDir, 'database.db');
        await promises_1.writeFile(outFile, image);
        console.log('outFile', outFile);
    }
    catch (error) {
        console.error('error', error);
    }
})();
