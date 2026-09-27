#!/usr/bin/env python3
"""Read-only audit of published Sonyae.art event data against repository data and primary pages."""
import argparse, json, re, sys, urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[2]
DB=ROOT/"content/events.json"
SITE_DB="https://sonyae.art/content/events.json"
UA="Mozilla/5.0 SonyaeEventsAudit/1.0 (+https://sonyae.art/events/)"

CANCELLED=(r"мероприятие отменено",r"событие отменено",r"лекция отменена",r"встреча отменена",r"cancelled",r"canceled")
POSTPONED=(r"мероприятие перенесено",r"событие перенесено",r"перенос мероприятия",r"новая дата",r"postponed",r"rescheduled")
CHILD=(r"\bдет(?:и|ей|ям|ский|ская|ское|ские)\b",r"для семей с детьми",r"семейн(?:ый|ая|ое|ые)\s+(?:день|программ|мероприят)")
AGGREGATORS=("ewert.ru","curatorspace.com","artconnect.com","on-the-move.org")
TIME_RE=re.compile(r"(?<!\d)([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)")

def fetch(url, timeout=25):
    req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"text/html,application/json;q=0.9,*/*;q=0.8"})
    with urllib.request.urlopen(req,timeout=timeout) as r:
        status=getattr(r,"status",200)
        raw=r.read().decode("utf-8","replace")
        return status,raw,r.geturl()

def textify(html):
    s=re.sub(r"(?is)<script[^>]*>.*?</script>|<style[^>]*>.*?</style>"," ",html)
    s=re.sub(r"(?s)<[^>]+>"," ",s)
    return re.sub(r"\s+"," ",s).strip()

def norm(v): return re.sub(r"\s+"," ",str(v or "")).strip().lower()

def event_date(e):
    for k in ("date","start_date"):
        try:
            if e.get(k): return date.fromisoformat(str(e[k])[:10])
        except ValueError: pass
    return None

def relevant(e,today):
    if e.get("status")!="approved": return False
    d=event_date(e)
    if not d: return True
    end=e.get("end_date")
    try: end_d=date.fromisoformat(str(end)[:10]) if end else d
    except ValueError: end_d=d
    return end_d >= today-timedelta(days=1) and d <= today+timedelta(days=120)

def aggregator(url):
    h=urlparse(url).netloc.lower().removeprefix("www.")
    return any(h==x or h.endswith("."+x) for x in AGGREGATORS)

def issue(rid,title,kind,severity,detail,url=""):
    return {"id":rid,"title":title,"kind":kind,"severity":severity,"detail":detail,"url":url}

def audit_source(e):
    rid=e.get("id",""); title=e.get("title",""); url=str(e.get("url",""))
    out=[]
    if not url.startswith("http"):
        return [issue(rid,title,"missing_url","error","У APPROVED-записи нет рабочей http(s)-ссылки.",url)]
    if aggregator(url):
        out.append(issue(rid,title,"non_primary_source","warning","Ссылка ведёт на агрегатор, а не на первоисточник.",url))
    try:
        status,html,final=fetch(url)
    except Exception as exc:
        return out+[issue(rid,title,"source_unreachable","warning",f"Не удалось открыть источник: {type(exc).__name__}: {exc}",url)]
    if status>=400:
        out.append(issue(rid,title,"source_http","error",f"Источник вернул HTTP {status}.",url))
        return out
    txt=norm(textify(html))
    if any(re.search(p,txt,re.I) for p in CANCELLED):
        out.append(issue(rid,title,"cancelled","critical","В первоисточнике найдена явная пометка об отмене. Требуется обновить event_status, не меняя moderation status.",final))
    if any(re.search(p,txt,re.I) for p in POSTPONED):
        out.append(issue(rid,title,"postponed","critical","В первоисточнике найдена явная пометка о переносе. Нужно сверить старую и новую дату.",final))
    if e.get("kind")=="event" and any(re.search(p,txt,re.I) for p in CHILD):
        own=norm(" ".join([str(e.get("title","")),str(e.get("description",""))," ".join(e.get("categories",[]) or [])]))
        if any(re.search(p,own,re.I) for p in CHILD):
            out.append(issue(rid,title,"child_or_family","error","Опубликованное событие выглядит детским/семейным и нарушает редакционный фильтр.",final))
    stored=norm(e.get("time"))
    m=re.match(r"^(\d{1,2}):([0-5]\d)",stored)
    if m:
        wanted=f"{int(m.group(1)):02d}:{m.group(2)}"
        page_times={f"{int(h):02d}:{mm}" for h,mm in TIME_RE.findall(txt)}
        if page_times and wanted not in page_times:
            sample=", ".join(sorted(page_times)[:12])
            out.append(issue(rid,title,"time_not_found","warning",f"В базе {wanted}; это время не найдено на странице. Найдены: {sample}.",final))
    return out

def compare_live(repo_db):
    problems=[]
    try:
        _,raw,_=fetch(SITE_DB)
        live=json.loads(raw)
    except Exception as exc:
        return [issue("site","Опубликованная база","site_db_unreachable","critical",f"Не удалось прочитать {SITE_DB}: {type(exc).__name__}: {exc}",SITE_DB)]
    rb={e.get("id"):e for e in repo_db.get("events",[]) if e.get("status")=="approved" and e.get("id")}
    lb={e.get("id"):e for e in live.get("events",[]) if e.get("status")=="approved" and e.get("id")}
    fields=("title","date","start_date","end_date","time","url","price_type","registration","availability")
    for rid,e in rb.items():
        if rid not in lb:
            problems.append(issue(rid,e.get("title",""),"missing_on_site","critical","APPROVED-запись есть в репозитории, но отсутствует в опубликованной базе.",e.get("url","")))
            continue
        diffs=[f for f in fields if e.get(f)!=lb[rid].get(f)]
        if diffs:
            problems.append(issue(rid,e.get("title",""),"site_repo_mismatch","error","Сайт расходится с репозиторием по полям: "+", ".join(diffs)+".",e.get("url","")))
    for rid,e in lb.items():
        if rid not in rb:
            problems.append(issue(rid,e.get("title",""),"unexpected_on_site","error","На сайте есть APPROVED-запись, которой нет среди APPROVED в текущем репозитории.",e.get("url","")))
    return problems

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--output",default="dist/events-audit/report.json")
    ap.add_argument("--markdown",default="dist/events-audit/report.md")
    args=ap.parse_args()
    db=json.loads(DB.read_text("utf-8"))
    today=date.today()
    events=[e for e in db.get("events",[]) if relevant(e,today)]
    problems=compare_live(db)
    for e in events:
        problems.extend(audit_source(e))
    order={"critical":0,"error":1,"warning":2}
    problems.sort(key=lambda x:(order.get(x["severity"],9),x["title"],x["kind"]))
    report={"checked_at":datetime.now(timezone.utc).isoformat(),"approved_checked":len(events),"issues":problems}
    op=ROOT/args.output; mp=ROOT/args.markdown
    op.parent.mkdir(parents=True,exist_ok=True)
    op.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n","utf-8")
    lines=["# Events data audit","",f"Проверено APPROVED-записей: **{len(events)}**",f"Найдено замечаний: **{len(problems)}**",""]
    if not problems: lines.append("Расхождений не найдено.")
    for p in problems:
        lines += [f"## [{p['severity'].upper()}] {p['title']}",f"- Тип: `{p['kind']}`",f"- ID: `{p['id']}`",f"- {p['detail']}"]
        if p.get("url"): lines.append(f"- Источник: {p['url']}")
        lines.append("")
    mp.write_text("\n".join(lines)+"\n","utf-8")
    print(f"audit: checked={len(events)} issues={len(problems)} critical={sum(p['severity']=='critical' for p in problems)}")
    if any(p["severity"]=="critical" for p in problems): sys.exit(2)

if __name__=="__main__": main()
