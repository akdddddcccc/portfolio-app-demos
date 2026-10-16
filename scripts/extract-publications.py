"""Build a review queue of factual bibliographic records from cached profiles."""
import json,re,hashlib
from pathlib import Path
root=Path('faculty-research-tmp');profiles=json.loads((root/'profiles-raw.json').read_text())
records=[]
def add(row,citation,kind='paper'):
 citation=re.sub(r'^\s*(?:\[\d+\]|\d+[.、])\s*','',citation).strip()
 if len(citation)<12:return
 doi=re.search(r'10\.\d{4,9}/[^\s，。；）)]+',citation)
 doi=doi.group(0).rstrip('.,;') if doi else None
 # Title is a bibliographic field, never an inferred abstract.
 title=None
 cn=re.search(r'《([^》]+)》',citation)
 if cn:title=cn.group(1)
 else:
  en=re.search(r'\(20\d{2}(?:,[^)]*)?\)\s*[.,]?\s*(.+?)(?:\.\s+(?:In\b|[A-Z])|\[J\]|\[C\])',citation)
  quote=re.search(r'"(.+?)"',citation)
  if quote:title=quote.group(1).rstrip('.')
  elif en:title=en.group(1)
  elif re.search('[\u4e00-\u9fff]',citation[:25]) and '.' in citation:
   title=citation.split('.')[1].split('[J]')[0].split('[C]')[0]
 if not title:title=citation
 title=re.sub(r'\s+',' ',title).strip()
 rec=dict(id='paper-'+hashlib.sha256((row['name']+citation).encode()).hexdigest()[:12],faculty=row['name'],title=title,citation=citation,doi=doi,kind=kind,profile_url=row['url'],status='profile_only',checked_at='2026-10-16',research_summary=None,full_text_status='not_checked')
 if '同行评审中' in citation:rec['publication_status']='under_review_in_profile'
 if '预计出版' in citation or '待出版' in citation:rec['publication_status']='forthcoming_in_profile'
 records.append(rec)
for row in profiles:
 text=row.get('text','');name=row['name']
 if name=='高鹏':
  seg=text.split('2016年以后代表论文：')[-1].split('\n')[0]
  for item in seg.split('；'):
   if '，《' in item:
    title=item.split('，《')[0];add(row,f'{name}《{title}》'+item[len(title):])
  continue
 section=False
 for line in text.splitlines():
  line=line.strip()
  if line.startswith('-->'):continue
  if re.search(r'^(?:[一二三四五六七八九十]+、)?(?:代表性论文|核心期刊论文|国际会议论文|科研论文|学术发表|学术著作|近5年科研成果)',line): section=True;continue
  if section and re.search(r'^(?:[一二三四五六七八九十]+、)?(?:科研|教学|研究项目|展览|社会服务|学术兼职|专业资质|参与科研|近5年学术交流|学术服务|曾获|获得|指导|重要项目)',line):section=False
  if section and not line.startswith(('（','学术论文发表于','研究开发','研究针对','研究运用','研究构建','研究系统')):
   if re.search(r'20\d{2}|19\d{2}',line):add(row,line)
 # Isolated named papers in short bios.
 if name=='孙颖东':add(row,'孙颖东（第二作者）《大学生电子媒介使用行为对人格的影响及对策研究》，教育观察，2019.05')
 if name=='周燕':
  for title in ['重塑企业与媒体的关系','虚拟环境带来的虚假成熟','以四维空间模式推进独立学院宣传工作']:add(row,f'周燕《{title}》（官网未列年份和刊物）')
records=list({(r['faculty'],r['citation']):r for r in records}.values())
(root/'publication-queue.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
from collections import Counter
print(len(records),Counter(r['faculty'] for r in records))
for r in records:print(r['id'],r['faculty'],r['title'])
