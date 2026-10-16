// Tiny static file server for the browser tests: serves the repo root, and /data/ from CHALKLINE_DATA if set.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain', '.mp4': 'video/mp4', '.csv': 'text/csv' };
function serve(root, dataDir) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let u = decodeURIComponent(req.url.split('?')[0]);
      const base = dataDir && u.startsWith('/data/') ? dataDir : root;
      if (base === dataDir) u = u.slice(5);
      const f = path.join(base, path.normalize(u).replace(/^(\.\.[/\\])+/, ''));
      if (!f.startsWith(base)) { res.writeHead(403); return res.end(); }
      fs.readFile(f, (err, buf) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() }));
  });
}
module.exports = { serve };
