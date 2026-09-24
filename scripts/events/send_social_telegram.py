#!/usr/bin/env python3
import argparse
import json
import os
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "dist/events-weekly/social"
API = "https://api.telegram.org/bot{token}/{method}"

def tg(token, method, data=None, files=None):
    r = requests.post(API.format(token=token, method=method), data=data or {}, files=files, timeout=120)
    try:
        payload = r.json()
    except Exception:
        payload = {}
    if not r.ok or not payload.get("ok"):
        raise RuntimeError(payload.get("description") or f"Telegram {method} failed: {r.status_code}")
    return payload["result"]

def send_document(token, chat_id, path, caption=""):
    with path.open("rb") as f:
        tg(token, "sendDocument", {"chat_id": chat_id, "caption": caption[:1024]}, {"document": (path.name, f)})

def send_photo(token, chat_id, path, caption=""):
    with path.open("rb") as f:
        tg(token, "sendPhoto", {"chat_id": chat_id, "caption": caption[:1024]}, {"photo": (path.name, f)})

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--city",required=True)
    ap.add_argument("--week-start",required=True)
    args=ap.parse_args()

    token=os.environ["SOCIAL_TELEGRAM_BOT_TOKEN"]
    chat_id=os.environ["SOCIAL_TELEGRAM_CHAT_ID"]
    manifest=json.loads((OUT/"social-manifest.json").read_text("utf-8"))
    city={"moscow":"МОСКВА","spb":"ПЕТЕРБУРГ"}.get(args.city,args.city.upper())

    tg(token,"sendMessage",{
        "chat_id":chat_id,
        "text":f"#SOCIAL_PACKAGE\n{city} · неделя с {args.week_start}\nГотовая подборка для публикации."
    })

    pdf=OUT/"telegram-week.pdf"
    if pdf.exists():
        send_document(token,chat_id,pdf,f"#SOCIAL_PACKAGE · {city}\nPDF ДЛЯ TELEGRAM")

    for name,label in [
        ("telegram-week.txt","ГОТОВЫЙ ТЕКСТ TELEGRAM"),
        ("telegram-free.txt","БЕСПЛАТНАЯ ПОДБОРКА"),
        ("instagram-caption.txt","ПОДПИСЬ INSTAGRAM"),
    ]:
        p=OUT/name
        if p.exists():
            send_document(token,chat_id,p,f"#SOCIAL_PACKAGE · {city}\n{label}")

    insta=OUT/"instagram"
    pngs=sorted(insta.glob("*.png"))
    for i,p in enumerate(pngs,1):
        send_photo(token,chat_id,p,f"#SOCIAL_PACKAGE · {city}\nINSTAGRAM {i}/{len(pngs)}")

    tg(token,"sendMessage",{
        "chat_id":chat_id,
        "text":f"#SOCIAL_PACKAGE\n{city} · готово: {len(pngs)} Instagram-слайдов, событий: {manifest.get('events',0)}."
    })

if __name__=="__main__":
    main()
