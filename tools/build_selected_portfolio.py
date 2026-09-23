from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable

from PIL import Image as PILImage
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets" / "site_optimized_for_github (1)"
OUT = ROOT / "dist" / "sonya_enokaeva_selected_portfolio_2026.pdf"
TMP = ROOT / ".portfolio_tmp"

W, H = A4
PAPER = HexColor("#f4efe3")
INK = HexColor("#11110f")
MUTED = HexColor("#6f665b")
ORANGE = HexColor("#e55d2f")
PALE = HexColor("#d9d0c2")

FONT_SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_SANS_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
FONT_SERIF_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

pdfmetrics.registerFont(TTFont("SiteSans", FONT_SANS))
pdfmetrics.registerFont(TTFont("SiteSansBold", FONT_SANS_BOLD))
pdfmetrics.registerFont(TTFont("SiteSerif", FONT_SERIF))
pdfmetrics.registerFont(TTFont("SiteSerifBold", FONT_SERIF_BOLD))


def resolve_image(name: str) -> Path:
    source = ASSETS / name
    if not source.exists():
        raise FileNotFoundError(f"Missing artwork image: {source}")
    if source.suffix.lower() != ".svg":
        return source

    TMP.mkdir(parents=True, exist_ok=True)
    target = TMP / f"{source.stem}.png"
    if not target.exists() or target.stat().st_mtime < source.stat().st_mtime:
        import cairosvg
        cairosvg.svg2png(url=str(source), write_to=str(target), output_width=2400)
    return target


def image_size(path: Path) -> tuple[int, int]:
    with PILImage.open(path) as im:
        return im.size


def draw_contain(c: canvas.Canvas, path: Path, x: float, y: float, width: float, height: float, *, pad: float = 0, background=None) -> None:
    if background is not None:
        c.setFillColor(background)
        c.rect(x, y, width, height, fill=1, stroke=0)
    iw, ih = image_size(path)
    avail_w = max(1, width - 2 * pad)
    avail_h = max(1, height - 2 * pad)
    scale = min(avail_w / iw, avail_h / ih)
    dw, dh = iw * scale, ih * scale
    dx = x + (width - dw) / 2
    dy = y + (height - dh) / 2
    c.drawImage(str(path), dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")


def draw_header(c: canvas.Canvas, page_no: int, *, dark: bool = False) -> None:
    color = PAPER if dark else INK
    c.setFillColor(color)
    c.setFont("SiteSansBold", 11)
    c.drawString(34, H - 27, "СОНЯ ЕНОКАЕВА")
    c.setFont("SiteSans", 8.5)
    c.drawRightString(W - 34, H - 26, f"{page_no:02d}")
    c.setStrokeColor(color)
    c.setLineWidth(0.55)
    c.line(34, H - 36, W - 34, H - 36)


def draw_footer(c: canvas.Canvas, left: str, right: str, *, dark: bool = False) -> None:
    c.setFillColor(PALE if dark else MUTED)
    c.setFont("SiteSans", 7.5)
    c.drawString(34, 20, left.upper())
    c.drawRightString(W - 34, 20, right.upper())


def wrap_lines(text: str, font_name: str, font_size: float, max_width: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        test = word if not current else current + " " + word
        if pdfmetrics.stringWidth(test, font_name, font_size) <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_multiline(c: canvas.Canvas, text: str, x: float, top_y: float, max_width: float, font_name: str, font_size: float, leading: float, color) -> float:
    c.setFont(font_name, font_size)
    c.setFillColor(color)
    y = top_y
    for line in wrap_lines(text, font_name, font_size, max_width):
        c.drawString(x, y, line)
        y -= leading
    return y


def cover_page(c: canvas.Canvas, page_no: int) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    draw_header(c, page_no)
    c.setFillColor(INK)
    c.setFont("SiteSerifBold", 56)
    c.drawString(34, H - 132, "ГРАФИКА")
    c.drawString(34, H - 188, "2026")
    draw_multiline(c, "Утиные истории · Чёрным по белому · Белым по чёрному", 36, H - 242, 255, "SiteSans", 12, 17, INK)
    image = resolve_image("duck-04.jpg")
    draw_contain(c, image, 125, 42, W - 125, 500, pad=0)
    c.setFillColor(ORANGE)
    c.setFont("SiteSansBold", 8.5)
    c.drawString(36, 56, "PORTFOLIO / SELECTED WORKS")
    draw_footer(c, "Москва", "sonyae.art")
    c.showPage()


def section_page(c: canvas.Canvas, page_no: int, number: str, title_lines: Iterable[str], material: str, image_name: str, *, dark: bool = False) -> None:
    bg = INK if dark else PAPER
    fg = PAPER if dark else INK
    c.setFillColor(bg)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    draw_header(c, page_no, dark=dark)
    c.setFillColor(PALE if dark else MUTED)
    c.setFont("SiteSans", 8)
    c.drawString(34, H - 70, f"{number} / СЕРИЯ / 2026")
    c.setFillColor(ORANGE)
    c.setFont("SiteSerifBold", 47)
    c.drawRightString(W - 34, H - 88, number)
    c.setFillColor(fg)
    c.setFont("SiteSerifBold", 48)
    y = H - 143
    for line in title_lines:
        c.drawString(34, y, line.upper())
        y -= 49
    draw_multiline(c, material, 36, H - 270, 265, "SiteSans", 11.5, 16, PALE if dark else MUTED)
    image = resolve_image(image_name)
    draw_contain(c, image, 132, 36, W - 132, 445, pad=4)
    draw_footer(c, f"Серия {number}", " / ".join(title_lines), dark=dark)
    c.showPage()


def work_page(c: canvas.Canvas, page_no: int, title: str, meta: str, image_name: str, index: str, *, dark: bool = False) -> None:
    bg = INK if dark else PAPER
    fg = PAPER if dark else INK
    c.setFillColor(bg)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    draw_header(c, page_no, dark=dark)
    image = resolve_image(image_name)
    panel_bg = INK if dark else HexColor("#ffffff")
    draw_contain(c, image, 34, 92, W - 68, H - 155, pad=10 if dark else 5, background=panel_bg)
    c.setFillColor(fg)
    c.setFont("SiteSansBold", 11.5)
    c.drawString(34, 62, title)
    c.setFillColor(PALE if dark else MUTED)
    c.setFont("SiteSans", 8.2)
    c.drawString(34, 44, meta)
    c.drawRightString(W - 34, 44, index)
    c.showPage()


def contact_page(c: canvas.Canvas, page_no: int) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    draw_header(c, page_no)
    c.setFillColor(INK)
    c.setFont("SiteSerifBold", 55)
    c.drawString(34, H - 130, "СОНЯ")
    c.drawString(34, H - 186, "ЕНОКАЕВА")
    entries = [("САЙТ", "sonyae.art"), ("TELEGRAM", "t.me/sonnya_ee"), ("EMAIL", "enokaeva.sofia@gmail.com")]
    y = H - 330
    for label, value in entries:
        c.setFillColor(ORANGE)
        c.setFont("SiteSansBold", 8)
        c.drawString(36, y, label)
        c.setFillColor(INK)
        c.setFont("SiteSans", 15)
        c.drawString(36, y - 23, value)
        y -= 74
    draw_footer(c, "Portfolio / 2026", "Москва")
    c.showPage()


def build() -> Path:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
    c.setTitle("Соня Енокаева — выбранные работы, 2026")
    c.setAuthor("Соня Енокаева")
    page = 1
    cover_page(c, page); page += 1
    section_page(c, page, "00", ["Утиные", "истории"], "Тушь, линер, чернила, карандаш", "duck-04.jpg"); page += 1
    duck_works = [("Без названия", "2026 · тушь, линер", "duck-04.jpg"), ("Без названия", "2026 · тушь, линер", "duck-05.jpg"), ("Без названия", "2026 · тушь, линер", "duck-03.jpg"), ("Без названия", "2026 · чернила, карандаш", "duck-01.jpg")]
    for i, (title, meta, image) in enumerate(duck_works, 1):
        work_page(c, page, title, meta, image, f"{i:02d} / {len(duck_works):02d}"); page += 1
    section_page(c, page, "01", ["Чёрным", "по белому"], "Тушь, линер", "blackwhite-01.jpg"); page += 1
    black_works = [("Храм в Таракановке", "2026 · тушь, линер", "blackwhite-01.jpg"), ("Без названия", "2026 · тушь, линер", "blackwhite-02.jpg"), ("Парк Дружба", "2026 · тушь, линер", "blackwhite-03.jpg"), ("Без названия", "2026 · тушь, линер", "blackwhite-04.jpg"), ("Без названия", "2026 · тушь, линер", "blackwhite-05.jpg"), ("Шахматово", "2026 · тушь, линер", "blackwhite-06.jpg"), ("Без названия", "2026 · тушь, линер", "blackwhite-07.jpg")]
    for i, (title, meta, image) in enumerate(black_works, 1):
        work_page(c, page, title, meta, image, f"{i:02d} / {len(black_works):02d}"); page += 1
    section_page(c, page, "02", ["Белым", "по чёрному"], "Тонированная бумага, белый карандаш, мел", "whiteblack-01.jpg", dark=True); page += 1
    white_works = [("Биологический музей Тимирязева", "2026 · тонированная бумага, белый карандаш, мел · А3", "whiteblack-02-cropped.svg"), ("Наблюдение за растениями", "2026 · тонированная бумага, белый карандаш, мел · А3", "whiteblack-03-cropped.svg"), ("Парк Дружба", "2026 · тонированная бумага, белый карандаш, мел", "whiteblack-04.jpg"), ("Биологический музей Тимирязева. Склад", "2026 · тонированная бумага, белый карандаш, мел · А3", "whiteblack-01.jpg")]
    for i, (title, meta, image) in enumerate(white_works, 1):
        work_page(c, page, title, meta, image, f"{i:02d} / {len(white_works):02d}", dark=True); page += 1
    contact_page(c, page)
    c.save()
    return OUT


if __name__ == "__main__":
    result = build()
    print(result)
