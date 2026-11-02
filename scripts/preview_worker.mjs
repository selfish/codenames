// Exercise the exported Worker locally, including its real SQL persistence boundary.
import http from 'node:http';
import { readFile, readdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { SQLiteD1 } from './sqlite-d1.mjs';
const artifact = resolve(process.argv[2] || '/tmp/remzilo-worker/index.mjs');
const database = resolve(process.argv[3] || '/tmp/remzilo-worker/preview.sqlite');
try { await access(database); } catch {
  execFileSync('python3', ['-c', 'import sqlite3,sys; sqlite3.connect(sys.argv[1]).executescript(sys.argv[2])', database, (await Promise.all((await readdir('server/migrations')).filter(n => n.endsWith('.sql')).sort().map(n => readFile(`server/migrations/${n}`, 'utf8')))).join('\n')]);
}
const worker = (await import(pathToFileURL(artifact))).default;
const DB = new SQLiteD1(database);
const port = Number(process.env.PORT || 3002);
http.createServer(async (req,res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const response = await worker.fetch(new Request(`http://127.0.0.1:${port}${req.url}`, {method:req.method, headers:req.headers, ...(body.length ? {body} : {})}), {DB});
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end('Local adapter error'); }
}).listen(port,'127.0.0.1',() => console.log(`Worker preview listening on ${port}`));
