"""Apply source-backed schedule corrections without changing moderation."""
import json
from pathlib import Path
from functools import lru_cache
ROOT=Path(__file__).resolve().parents[2]
@lru_cache(maxsize=1)
def corrections():
    p=ROOT/'content/events_time_verified.json'
    return json.loads(p.read_text('utf-8')).get('corrections',{}) if p.exists() else {}

def apply_verified_schedule(event):
    facts=corrections().get(event.get('id'))
    if not facts:return event
    if str(event.get('time_verified_at','')) > str(facts.get('time_verified_at','')):return event
    for field in ('date','time'):
        if field not in facts:continue
        previous=facts.get('previous_'+field)
        value=event.get(field,'')
        if value in (previous,facts[field]) or (field=='time' and not value and facts.get('time_verification')=='verified'):
            event[field]=facts[field]
            if field=='date':
                for boundary in ('start_date','end_date'):
                    if event.get(boundary)==previous:event[boundary]=facts[field]
            if field in (event.get('editor_overrides') or {}):
                event['editor_overrides'][field]=facts[field]
    if event.get('time','') != facts.get('time',''):
        return event
    for field in ('time_verification','time_evidence','time_verified_at'):
        if field in facts:event[field]=facts[field]
    return event
