"""Build edge JS and optionally SQLite from the reviewed, versioned JSON source."""
import argparse,json,sqlite3
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--sqlite',type=Path);args=p.parse_args()
data=json.loads((root/'knowledge/faculty/database.json').read_text())
assert len({p['name'] for p in data['profiles']})==len(data['profiles'])
ids={p['id'] for p in data['publications']}
assert all(set(p['publication_ids'])<=ids for p in data['profiles'])
(root/'edge-functions/_shared/yuanbai-faculty-data.js').write_text('// Generated from knowledge/faculty/database.json. Do not edit directly.\nexport default '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
if args.sqlite:
 con=sqlite3.connect(args.sqlite)
 with con:
  con.execute('CREATE TABLE IF NOT EXISTS faculty (id TEXT PRIMARY KEY, name TEXT UNIQUE, data TEXT)')
  con.execute('CREATE TABLE IF NOT EXISTS publications (id TEXT PRIMARY KEY, faculty TEXT REFERENCES faculty(name), data TEXT)')
  con.execute('DELETE FROM publications');con.execute('DELETE FROM faculty')
  con.executemany('INSERT INTO faculty VALUES (?,?,?)',[(p['id'],p['name'],json.dumps(p,ensure_ascii=False)) for p in data['profiles']])
  con.executemany('INSERT INTO publications VALUES (?,?,?)',[(p['id'],p['faculty'],json.dumps(p,ensure_ascii=False)) for p in data['publications']])
 con.close()
print(f"Built {len(data['profiles'])} faculty and {len(data['publications'])} publication leads")
