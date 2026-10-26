#!/usr/bin/env python3
"""Embed a font face that can draw the ruble sign.

Arial, Arial Narrow and Impact on the GitHub runner do not include U+20BD,
so price badges render a missing-glyph box. The file next to this module is a
Roboto subset (Apache-2.0) containing that one character. It is injected with
unicode-range, so the rest of the layout keeps the condensed display fonts.
"""
import base64
from functools import lru_cache
from pathlib import Path

FONT = Path(__file__).resolve().parents[2] / "assets/fonts/ruble-fallback.ttf"


@lru_cache(maxsize=1)
def ruble_font_face():
    raw = FONT.read_bytes()
    encoded = base64.b64encode(raw).decode("ascii")
    return (
        "@font-face{"
        'font-family:"Ruble Fallback";'
        f'src:url(data:font/ttf;base64,{encoded}) format("truetype");'
        "font-weight:500;font-style:normal;font-display:block;"
        "unicode-range:U+20BD}"
    )
