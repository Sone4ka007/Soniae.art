"""Collapse dated copies of one exhibition, retaining its approved identity."""
import re
from urllib.parse import urlsplit,urlunsplit

def collapse_exhibitions(events):
    groups={}
    result=[]
    for e in events:
        if e.get('kind')!='exhibition':
            result.append(e);continue
        p=urlsplit(str(e.get('url','')))
        # Keep query parameters: some museums identify details by query id.
        url=urlunsplit((p.scheme,p.netloc,p.path.rstrip('/'),p.query,''))
        key=(e.get('city'),url,re.sub(r'\W+','',str(e.get('title','')).lower()))
        groups.setdefault(key,[]).append(e)
    for items in groups.values():
        items.sort(key=lambda e:(e.get('status')!='approved',e.get('status')!='rejected',e.get('date','')))
        keep=items[0]
        for field in ('start_date','end_date'):
            values=[e[field] for e in items if e.get(field)]
            if values: keep[field]=(min if field=='start_date' else max)(values)
        if keep.get('start_date'): keep['date']=keep['start_date']
        keep['time']=''
        result.append(keep)
    return result
