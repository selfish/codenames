// Produce an independent single-file Worker ESM artifact; no hosting calls or credentials.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve(process.argv[2] || 'build');
const output = resolve(process.argv[3] || '/tmp/remzilo-worker');
const assets = {};
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon', '.txt':'text/plain' };
async function collect(dir, prefix = '') {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (prefix === '' && !['index.html', 'manifest.json', 'remzilo.svg', 'static'].includes(item.name)) continue;
    if (item.isDirectory()) await collect(resolve(dir,item.name), `${prefix}/${item.name}`);
    else if (item.isFile() && !item.name.endsWith('.map')) assets[`${prefix}/${item.name}`] = { type: types[extname(item.name)] || 'application/octet-stream', data: (await readFile(resolve(dir,item.name))).toString('base64') };
  }
}
await collect(root);
let game = await readFile('server/game.mjs', 'utf8');
game = game.replace("import words from './words.json' with { type: 'json' };", `const words = ${await readFile('server/words.json','utf8')};`).replaceAll('export class ', 'class ');
let worker = await readFile('server/worker.mjs', 'utf8');
worker = worker.replace("import { Games, Fault } from './game.mjs';", '').replace('export async function transact', 'async function transact');
await mkdir(output, { recursive: true });
await writeFile(resolve(output,'index.mjs'), `globalThis.REMZILO_ASSETS = ${JSON.stringify(assets)};\n${game}\n${worker}`);
await writeFile(resolve(output,'0001_rooms.sql'), await readFile('server/migrations/0001_rooms.sql'));
console.log(`Worker and schema exported to ${output}; no resources created or published.`);
