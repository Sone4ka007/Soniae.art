#!/usr/bin/env python3
"""Recheck each existing event URL; require event-scoped schedule evidence."""
import argparse, concurrent.futures, hashlib, json, re, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[2]
MONTHS={'января':1,'февраля':2,'марта':3,'апреля':4,'мая':5,'июня':6,'июля':7,'августа':8,'сентября':9,'октября':10,'ноября':11,'декабря':12}
CLOCK=r'(?<![\d.:])([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)'
MONTH='(?:'+'|'.join(MONTHS)+')'
DATE_CLOCK=re.compile(r'(?<![\d./])(\d{1,2})\s*(?:[./](\d{1,2})[./](20\d{2})|\s+('+MONTH+r')(?:\s+(20\d{2}))?)\s*(?:г\.)?\s*[,|·•—–-]?\s*(?:в\s+)?'+CLOCK,re.I)

def clean(s):return re.sub(r'\s+',' ',str(s or '')).strip()
def norm(s):return re.sub(r'\W+','',str(s or '').lower())
def pairs(text,year):
    out=[]
    month_map=dict(MONTHS)
    for name,num in MONTHS.items():month_map[name[:3]]=num
    mp='(?:'+'|'.join(sorted(month_map,key=len,reverse=True))+')'
    sep=r"\s*[,;|]?\s*(?:\(?(?:понедельник|вторник|среда|четверг|пятница|суббота|воскресенье|пн|вт|ср|чт|пт|сб|вс)\)?\s*[,;]?\s*)?[·•—–-]?\s*(?:в\s+)?"
    patterns=[
        (re.compile(r'(?<![\d./])(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}|\d{2}))?(?![\d./])'+sep+CLOCK,re.I),'numeric'),
        (re.compile(r'(?<!\d)(\d{1,2})\s+('+mp+r')\.?(?:\s+(20\d{2}))?'+sep+CLOCK,re.I),'named')]
    for pattern,kind in patterns:
        for m in pattern.finditer(text):
            day,month,yr,hour,minute=m.groups()
            try:
                y=int(yr or year);y=y+2000 if y<100 else y
                dt=datetime(y,int(month) if kind=='numeric' else month_map[month.lower()],int(day)).date().isoformat()
            except (ValueError,KeyError,TypeError):continue
            out.append((dt,f'{int(hour):02}:{minute}',clean(m.group(0))))
    return out

def extract(html,event):
    soup=BeautifulSoup(html,'html.parser')
    title=event.get('title','');expected=event.get('date','');year=expected[:4] or '2026'
    host=urlparse(event.get('url','')).netloc.lower()
    if re.search(r'видеокурс|запись лекции',title,re.I):return None
    if 'centrezotov.ru' in host:
        node=soup.select_one('.event-header__spec-date')
        if node:
            ps=pairs(clean(node.get_text(' ',strip=True)),year)
            matches=[p for p in ps if p[0]==expected]
            if len(matches)==1 or len(ps)==1:
                dt,tm,proof=(matches or ps)[0];return {'date':dt,'time':tm,'evidence':proof,'method':'event_header'}
    if 'brodsky.online' in host:
        node=soup.select_one('.detail-meta')
        if node:
            ps=pairs(clean(node.get_text(' ',strip=True)),year)
            if len(ps)==1:return {'date':ps[0][0],'time':ps[0][1],'evidence':ps[0][2],'method':'event_header'}
    # This node belongs to the current event, unlike the recommendations below.
    if 'tretyakov' in host:
        node=soup.select_one('.event-detail__info-date')
        if node:
            text=clean(node.get_text(' ',strip=True));ps=pairs(text,year)
            if len(ps)==1:return {'date':ps[0][0],'time':ps[0][1],'evidence':text,'method':'event_header'}
    visible=clean(soup.get_text(' ',strip=True))
    labelled=[]
    for part in re.findall(r'(?:Когда|Дата мероприятия)\s*:.{0,100}',visible,re.I):
        labelled.extend(pairs(part,year))
    matching=[p for p in labelled if p[0]==expected]
    chosen=matching if matching else labelled
    if len({(p[0],p[1]) for p in chosen})==1:
        dt,tm,proof=chosen[0]
        return {'date':dt,'time':tm,'evidence':proof,'method':'labelled_schedule'}
    def nodes(v):
        if isinstance(v,list):
            for x in v:yield from nodes(x)
        elif isinstance(v,dict):
            yield v
            for x in v.values():
                if isinstance(x,(dict,list)):yield from nodes(x)
    for script in soup.select('script[type="application/ld+json"]'):
        try:data=json.loads(script.string or script.get_text())
        except (ValueError,TypeError):continue
        for v in nodes(data):
            typ=v.get('@type','');name=norm(v.get('name',''));nt=norm(title)
            if 'Event' not in str(typ) or not name or not nt or not (name==nt or name in nt or nt in name):continue
            start=str(v.get('startDate',''));m=re.match(r'(20\d{2}-\d{2}-\d{2})T(\d{2}:[0-5]\d)',start)
            if m and m[1]==expected:return {'date':m[1],'time':m[2],'evidence':start,'method':'event_jsonld'}
    for el in soup(['script','style','nav','footer','aside','head']):el.decompose()
    heading=soup.find('h1') or soup.select_one('.list__news-h1, .articleheader')
    scopes=[]
    if heading:
        # Read only the initial event section, never sidebar recommendations.
        parent=heading.parent
        for _ in range(3):
            if not parent:break
            t=clean(parent.get_text(' ',strip=True))
            if len(t)<=3500:scopes.append(t)
            parent=parent.parent
        after=[]
        for sib in heading.next_siblings:
            after.append(sib.get_text(' ',strip=True) if hasattr(sib,'get_text') else str(sib))
            if len(' '.join(after))>1800:break
        scopes.append(clean(' '.join(after))[:1800])
    # A unique date/time attached to the record's date is usable even when
    # the page has several sessions. Never move dates from an arbitrary page.
    if 'nlr.ru' in host:
        node=soup.select_one('#afisha_merop_page')
        if node:scopes.insert(0,clean(node.get_text(' ',strip=True)))
    if 'mispxx-xxi.ru' in host:
        node=soup.select_one('.list__news-event')
        if node:scopes.insert(0,clean(node.get_text(' ',strip=True)))
    if 'manege.spb.ru' in host:
        text=clean(soup.get_text(' ',strip=True));needle=clean(title)
        pos=text.find(needle)
        if pos>=0:scopes.insert(0,text[max(0,pos-80):pos+200])
    if 'ges-2.org' in host:
        text=clean(soup.get_text(' ',strip=True))
        scopes.append(' '.join(re.findall(r'Когда:.{0,90}',text)))
    if not heading:
        text=clean(soup.get_text(' ',strip=True));needle=clean(title)
        pos=text.lower().find(needle.lower())
        if pos>=0:scopes.append(text[max(0,pos-100):pos+2500])
    text=clean(soup.get_text(' ',strip=True))
    candidate=clean(title)
    pos=text.lower().find(candidate.lower())
    if pos>=0:scopes.append(text[max(0,pos-100):pos+2000])
    elif heading:
        candidate=clean(heading.get_text(' ',strip=True));pos=text.find(candidate)
        if pos>=0:scopes.append(text[pos:pos+1800])
    for text in scopes:
        ps=[p for p in pairs(text,year) if p[0]==expected]
        unique={(p[0],p[1]) for p in ps}
        if len(unique)==1:
            dt,tm=next(iter(unique));return {'date':dt,'time':tm,'evidence':ps[0][2],'method':'dated_event_section'}
        label=re.search(r'(?:Начало(?:\s+мероприятия)?|Время\s+начала)\s*[:—–-]?\s*'+CLOCK,text,re.I)
        if label:return {'date':expected,'time':f'{int(label[1]):02}:{label[2]}','evidence':label[0],'method':'labelled_event_section'}
    return None

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--workers',type=int,default=24);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    db=json.loads((ROOT/'content/events.json').read_text());events=[e for e in db['events'] if e.get('kind','event')=='event']
    cache=ROOT/'.time-audit-cache';cache.mkdir(exist_ok=True)
    urls=sorted({e.get('url','') for e in events if e.get('url','').startswith('http')})
    htmls={};errors={}
    def fetch(url):
        path=cache/(hashlib.sha256(url.encode()).hexdigest()+'.html')
        if path.exists():return url,path.read_text(),''
        try:
            r=requests.get(url,timeout=(5,12),headers={'User-Agent':'Mozilla/5.0 SonyaeEventsBot/1.5 (+https://sonyae.art/events/)'})
            r.raise_for_status()
            if len(r.content)>4000000:return url,'','page_too_large'
            r.encoding=r.apparent_encoding or r.encoding
            path.write_text(r.text);return url,r.text,''
        except Exception as exc:return url,'',type(exc).__name__
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for i,(url,html,err) in enumerate(pool.map(fetch,urls),1):
            if html:htmls[url]=html
            else:errors[url]=err
            if i%50==0:print(f'Fetched {i}/{len(urls)} pages; errors={len(errors)}',flush=True)
    now=datetime.now(timezone.utc).isoformat();records=[];corrections={}
    # Group parsing by page to avoid parsing unrelated historical data twice.
    for i,e in enumerate(events,1):
        url=e.get('url','');proof=extract(htmls[url],e) if url in htmls else None
        item={'id':e['id'],'title':e.get('title'),'status':e.get('status'),'date':e.get('date'),'old_time':e.get('time',''),'url':url}
        if proof:
            item.update(proof);item['result']='verified'
            facts={k:proof[k] for k in ['date','time']}
            facts.update({'previous_date':e.get('date',''),'previous_time':e.get('time',''),'time_verified_at':now,'time_evidence':proof['evidence'],'time_source_url':url,'time_verification':'verified'})
            corrections[e['id']]=facts
        else:
            item['result']='unverified';item['reason']=errors.get(url,'no_event_scoped_schedule')
            # Retain original value in the audit, not as a public start time.
            facts={'time':'','previous_time':e.get('time',''),'previous_date':e.get('date',''),'time_verified_at':now,'time_verification':'unverified','time_source_url':url}
            corrections[e['id']]=facts
        records.append(item)
        if i%100==0:print(f'Parsed {i}/{len(events)} events',flush=True)
    report={'checked_at':now,'total':len(events),'unique_urls':len(urls),'fetched_urls':len(htmls),'failed_urls':len(errors),'verified':sum(e['result']=='verified' for e in records),'records':records}
    (ROOT/'content/events_time_audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'content/events_time_verified.json').write_text(json.dumps({'checked_at':now,'corrections':corrections},ensure_ascii=False,indent=2)+'\n')
    if args.apply:
        for e in db['events']:
            if e.get('id') in corrections:e.update(corrections[e['id']])
        (ROOT/'content/events.json').write_text(json.dumps(db,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='records'},ensure_ascii=False),flush=True)
if __name__=='__main__':main()
