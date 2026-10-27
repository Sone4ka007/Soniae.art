"""Embedded poster face and cover drawing for the weekly slides."""
import base64
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ANTON = ROOT / "assets/fonts/anton-regular.ttf"
COVER = ROOT / "assets/social/cover-rain.jpg"


@lru_cache(maxsize=1)
def poster_font_face():
    encoded = base64.b64encode(ANTON.read_bytes()).decode("ascii")
    return (
        "@font-face{"
        'font-family:"Poster";'
        f'src:url(data:font/ttf;base64,{encoded}) format("truetype");'
        "font-weight:400;font-style:normal;font-display:block}"
    )


@lru_cache(maxsize=1)
def cover_image_uri():
    encoded = base64.b64encode(COVER.read_bytes()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"
