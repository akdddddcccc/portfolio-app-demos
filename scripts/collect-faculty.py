"""Collect public faculty pages into a local processing cache (not committed source text)."""
import re,json,html,urllib.request,urllib.parse,concurrent.futures,sys
from pathlib import Path
cache=Path(sys.argv[1] if len(sys.argv)>1 else 'faculty-research-tmp');cache.mkdir(exist_ok=True)
base='https://design.bnu.edu.cn/faculty/teachers/'
def clean(s):
 s=re.sub(r'<(?:script|style)\b[^>]*>.*?</(?:script|style)>','',s,flags=re.S|re.I)
 s=re.sub(r'<(?:br\b[^>]*|/p|/div|/h[1-6]|/li|/tr)>','\n',s,flags=re.I)
 return '\n'.join(x.strip() for x in html.unescape(re.sub('<[^>]+>','',s)).splitlines() if x.strip())
index=cache/'index.html'
if not index.exists():
 with urllib.request.urlopen(base+'index.htm',timeout=25) as response:
  index.write_text(response.read().decode('utf-8',errors='replace'))
raw=index.read_text()
items=[]
for url,body in re.findall(r'<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)</a>',raw,re.S):
 if 'class="name"' not in body:continue
 name=re.search(r'<h3[^>]*>(.*?)</h3>',body,re.S)
 if not name:continue
 items.append(dict(name=clean(name.group(1)),label=clean(body),url=urllib.parse.urljoin(base,url)))
# Dedupe repeat desktop/mobile lists.
items=list({x['url']:x for x in items}.values())
(cache/'roster.json').write_text(json.dumps(items,ensure_ascii=False,indent=2))
def get(row):
 filename=cache/(row['url'].split('/')[-1]+'.html')
 try:
  if filename.exists():raw=filename.read_text()
  else:
   with urllib.request.urlopen(row['url'],timeout=25) as r:raw=r.read().decode('utf-8',errors='replace')
   filename.write_text(raw)
  text=clean(raw)
  # Content begins after the final site-wide navigation and before the school footer.
  pos=text.rfind('师资介绍',0,text.find('广东省珠海市') if '广东省珠海市' in text else len(text))
  body=text[pos+len('师资介绍'):] if pos>=0 else text
  body=body.split('北京师范大学未来设计学院\n广东省')[0].strip()
  row.update(text=body,status='fetched')
 except Exception as e:row.update(status='error',error=str(e))
 return row
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 results=[]
 for r in pool.map(get,items):
  results.append(r);print(r['name'],r['status'],len(r.get('text','')),flush=True)
  (cache/'profiles-raw.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('TOTAL',len(results),flush=True)
