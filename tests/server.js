// Kleiner statischer Dateiserver für die Tests.
//
// Ersetzt `python -m http.server`: dessen Verbindungs-Rückstau ist sehr klein,
// wodurch unter Parallel-Last einzelne Anfragen mit ERR_CONNECTION_REFUSED
// abgewiesen wurden. Folge: einzelne JS-Module luden nicht, `init()` lief nie
// und Tests scheiterten scheinbar zufällig. Node verkraftet die Last problemlos.
const http = require('http')
const fs = require('fs')
const path = require('path')

const WURZEL = path.resolve(__dirname, '..')
const PORT = Number(process.env.PORT || 5500)

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
}

const server = http.createServer((req, res) => {
  let pfad
  try {
    pfad = decodeURIComponent(req.url.split('?')[0])
  } catch {
    res.writeHead(400); return res.end('ungueltige Adresse')
  }
  if (pfad.endsWith('/')) pfad += 'index.html'

  // Pfad normalisieren und sicherstellen, dass er im Projektordner bleibt
  const datei = path.join(WURZEL, path.normalize(pfad).replace(/^[\/\\]+/, ''))
  if (!datei.startsWith(WURZEL)) {
    res.writeHead(403); return res.end('verboten')
  }

  fs.readFile(datei, (err, inhalt) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end('nicht gefunden')
    }
    res.writeHead(200, {
      'Content-Type': TYPEN[path.extname(datei).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    res.end(inhalt)
  })
})

server.listen(PORT, () => console.log(`Test-Server laeuft auf http://localhost:${PORT}`))
