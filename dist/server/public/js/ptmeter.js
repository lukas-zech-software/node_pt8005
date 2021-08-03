function post(url, data, message) {
	return fetch(url, {
		method: 'post',
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(data),
	})
			.then(response => response.json())
			.then((data) => {
				document.getElementById("dbmessage").innerText = message
				document.getElementById("dbmessage").className = "show"
				setTimeout(() => {
					document.getElementById("dbmessage").className = "hidden"
				}, 3000)
				return data;
			}).catch((err) => {
				document.getElementById("dbmessage").innerText = "Error: " + err
				document.getElementById("dbmessage").className = "show error"
				return err
			})
}

function setEnvironment(id) {
	post('/environment', {id}, "environment saved")
}

function setWindowState(id) {
	post('/windowstate', {id}, "windowstate saved")
}

function runQuery() {
	const query = document.getElementById("txt_query").value

	post('/db/query/run', {query}).then((data) => {
		document.getElementById("txt_result").value = JSON.stringify(data)
	})
}

function executeQuery() {
	const query = document.getElementById("txt_query").value

	post('/db/query/execute', {query}).then((data) => {
		document.getElementById("txt_result").value = JSON.stringify(data)
	})
}

function downloadCsv() {
	window.open('/export/csv/ptmeter_export.csv', "_blank")
}

function downloadDb() {
	window.open('/export/db/ptmeter.sqlite.db', "_blank")
}
