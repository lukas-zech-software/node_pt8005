function post (url, id) {
  fetch(url, {
    method: 'post',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id }),
  })
    .then(() => {
      document.getElementById("dbmessage").innerText = url + " saved"
      document.getElementById("dbmessage").className = "show"
      setTimeout(() => {
        document.getElementById("dbmessage").className = "hidden"
        window.reload()
      }, 2000)
    }).catch((err) => {
    document.getElementById("dbmessage").innerText = "Error: " + err
    document.getElementById("dbmessage").className = "show error"
  })
}

function setEnvironment (id) {
  post('/environment', id)
}

function setWindowState (id) {
  post('/windowstate', id)
}

function downloadCsv () {
  window.open('/export/csv/ptmeter_export.csv',"_blank")
}

function downloadDb () {
  window.open('/export/db/ptmeter.sqlite.db',"_blank")
}
