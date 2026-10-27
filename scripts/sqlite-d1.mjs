// Local-only D1 contract adapter backed by Python's real SQLite. Not a hosting dependency.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const query = `import json,sqlite3,sys
conn=sqlite3.connect(sys.argv[1], timeout=10)
conn.row_factory=sqlite3.Row
sql,params=json.loads(sys.argv[2])
cur=conn.execute(sql,params)
rows=[dict(row) for row in cur.fetchall()] if cur.description else []
conn.commit()
print(json.dumps({'rows':rows,'meta':{'changes':max(0,cur.rowcount)}}))`;
export class SQLiteD1 {
  constructor(file) { this.file = file; }
  prepare(sql) {
    return { bind: (...params) => {
      const run = async () => JSON.parse((await execute('python3', ['-c',query,this.file,JSON.stringify([sql,params])])).stdout);
      return { run, first: async () => (await run()).rows[0] || null };
    } };
  }
}
