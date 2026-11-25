#!/usr/bin/env python3
"""Export an existing, reviewed website comic into Instagram JPEG slides."""
import argparse
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public/history-comics/generated"
TARGET = ROOT / "public/instagram"
SITE = "https://panjabiaagayeoye.com"
INK = "#12305a"
SAFFRON = "#ffb020"


def font(size, bold=False):
    path = "/usr/share/fonts/truetype/dejavu/" + ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf")
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def wrap(draw, message, face, max_width, max_lines=2):
    lines, current = [], ""
    for word in message.split():
        candidate = (current + " " + word).strip()
        if draw.textbbox((0, 0), candidate, font=face)[2] <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        while lines[-1] and draw.textbbox((0, 0), lines[-1] + "…", font=face)[2] > max_width:
            lines[-1] = lines[-1][:-1]
        lines[-1] += "…"
    return lines


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("slug")
    args = parser.parse_args()
    slug = args.slug
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{3,150}", slug):
        parser.error("Invalid slug")
    source = SOURCE / slug
    data = json.loads((source / "comic.json").read_text(encoding="utf-8"))
    pages = data["pages"]
    if not 2 <= len(pages) <= 10:
        raise ValueError("Carousel requires 2 to 10 pages")
    if data.get("articleSlug") != slug:
        raise ValueError("Article slug mismatch")
    target = TARGET / slug
    target.mkdir(parents=True, exist_ok=True)
    images = []
    for n, page in enumerate(pages, 1):
        image_path = source / ("page-" + str(n) + ".webp")
        canvas = Image.new("RGB", (1080, 1350), "#ffffff")
        with Image.open(image_path) as original:
            art = ImageOps.contain(original.convert("RGB"), (1080, 1080), Image.Resampling.LANCZOS)
        canvas.paste(art, ((1080 - art.width) // 2, (1080 - art.height) // 2))
        draw = ImageDraw.Draw(canvas)
        draw.rectangle((0, 1080, 1080, 1350), fill=INK)
        draw.rectangle((0, 1080, 1080, 1090), fill=SAFFRON)
        draw.text((46, 1113), "PANJABI AA GAYE OYE", fill=SAFFRON, font=font(26, True))
        draw.text((940, 1113), str(n) + "/" + str(len(pages)), fill="#ffffff", font=font(27, True))
        face = font(42, True)
        for line_number, line in enumerate(wrap(draw, page["title"], face, 985)):
            draw.text((46, 1166 + line_number * 57), line, fill="#ffffff", font=face)
        filename = "slide-" + str(n) + ".jpg"
        canvas.save(target / filename, "JPEG", quality=90, optimize=True, subsampling=0)
        images.append({"file": filename, "url": SITE + "/instagram/" + slug + "/" + filename,
                       "alt_text": page["title"] + ". " + page["caption"]})
    caption = (data["articleTitle"] + "\n\n" + data.get("intro", "") +
               "\n\nSwipe to explore this illustrated history. The full verified story is on our website (link in bio)." +
               "\n\nStory #" + str(data["issueNumber"]) +
               " · AI-assisted illustrations, reviewed by people." +
               "\n#PunjabiHistory #PunjabiDiaspora #PanjabiAaGayeOye #HistoryComics")
    manifest = {"version": 1, "slug": slug, "issue_number": data["issueNumber"],
                "title": data["articleTitle"], "caption": caption,
                "images": images, "source_url": SITE + "/history/" + slug,
                "instagram_account": "5abiaagayeoye"}
    (target / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Prepared " + str(len(images)) + " JPEG slides for review. Nothing posted to Instagram.")


if __name__ == "__main__":
    main()
