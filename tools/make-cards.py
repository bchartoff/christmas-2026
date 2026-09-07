#!/usr/bin/env python3
"""Export one card per name: the choir with that name's singers lit, and no
letters, no star and no name shown. Whoever gets the card works out the name by
clicking the same carolers on the site.

    python3 tools/make-cards.py                 every name, SVG and PNG
    python3 tools/make-cards.py CARMEN SAM      only those
    python3 tools/make-cards.py --svg           skip the PNG pass

Everything -- the palette, the layout, the part boundaries, the letter-to-note
mapping -- is read out of js/ at run time, so cards cannot drift from the site
as it changes. Re-run after editing anything and the cards follow.
"""

import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "cards")

# --- geometry, mirroring js/app.js -------------------------------------------
FIGURE, COL_W, LABEL_H = 100, 122, 34
ROW_H, GAP, BAND = LABEL_H + FIGURE + 14, 0.55, 16
TOP_PAD, BOTTOM_PAD, PER_ROW = 70, 60, 9
IDLE = "#4d5666"
PART_TOPS = [55, 63, 71, 128]
PART_FILE = ["bass", "tenor", "alto", "soprano"]
# Which figures have a solid head. On those the mouth has to be punched out to
# open it; on the hooded ones the face is a cut-out and the mouth is added.
SOLID = [True, True, False, False]

ARGN = {"m": 2, "l": 2, "h": 1, "v": 1, "c": 6, "s": 4, "q": 4, "t": 2, "a": 7, "z": 0}
# Numbers first, and exponents allowed, so "1e-5" is not read as a command "e".
TOKEN = r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?|[a-zA-Z]"


def read(path):
    return open(os.path.join(ROOT, path)).read()


def load_site():
    app, data = read("js/app.js"), read("js/data.js")
    bulbs = [(m.group(1), m.group(2)) for m in
             re.finditer(r'lit: "(#\w+)", glow: "([\d, ]+)"', app)]
    letters = [(m.group(1), int(m.group(2))) for m in
               re.finditer(r'letter: "(\w)", note: "[^"]+", midi: (\d+)', data)]
    names = re.findall(r'"([A-Z]{2,})"', data.split("const NAMES")[1])
    if not (bulbs and letters and names):
        sys.exit("could not read palette, letters or names out of js/")
    return bulbs, letters, names


def part_of(midi):
    return next(i for i, top in enumerate(PART_TOPS) if midi <= top)


def subpaths(d):
    """Split a path into subpaths, each re-emitted with an absolute start. The
    data is entirely relative, so cutting at an "m" would leave the next
    subpath positioned from the origin instead of the previous endpoint."""
    tok = re.findall(TOKEN, d)
    i = 0
    x = y = sx = sy = 0.0
    cmd = None
    spans = []
    cur = None
    while i < len(tok):
        if re.match(r"[a-zA-Z]", tok[i]):
            cmd = tok[i]
            i += 1
        lo = cmd.lower()
        rel = cmd == lo
        n = ARGN[lo]
        a = [float(v) for v in tok[i:i + n]]
        if lo == "m":
            if cur:
                cur["end"] = i - 1
                spans.append(cur)
            x = x + a[0] if rel else a[0]
            y = y + a[1] if rel else a[1]
            sx, sy = x, y
            cur = {"start": i - 1, "sx": x, "sy": y}
            cmd = "l" if rel else "L"
        elif lo == "l":
            x = x + a[0] if rel else a[0]
            y = y + a[1] if rel else a[1]
        elif lo == "h":
            x = x + a[0] if rel else a[0]
        elif lo == "v":
            y = y + a[0] if rel else a[0]
        elif lo == "c":
            x = x + a[4] if rel else a[4]
            y = y + a[5] if rel else a[5]
        elif lo == "s":
            x = x + a[2] if rel else a[2]
            y = y + a[3] if rel else a[3]
        elif lo == "z":
            x, y = sx, sy
        i += n
    if cur:
        cur["end"] = len(tok)
        spans.append(cur)

    out = []
    for sp in spans:
        t = tok[sp["start"]:sp["end"]][:]
        t[0], t[1], t[2] = "M", f'{sp["sx"]:g}', f'{sp["sy"]:g}'
        out.append(" ".join(t))
    return out


def bbox(sub):
    """Walk the subpath tracking position. Numbers cannot be paired off as
    x,y: h and v take one argument, and every value after the leading M is a
    relative delta rather than a coordinate."""
    tok = re.findall(TOKEN, sub)
    i = 0
    x = y = sx = sy = 0.0
    cmd = None
    xs, ys = [], []
    while i < len(tok):
        if re.match(r"[a-zA-Z]", tok[i]):
            cmd = tok[i]
            i += 1
        lo = cmd.lower()
        rel = cmd == lo
        n = ARGN[lo]
        a = [float(v) for v in tok[i:i + n]]
        if lo == "m":
            x = x + a[0] if rel else a[0]
            y = y + a[1] if rel else a[1]
            sx, sy = x, y
            cmd = "l" if rel else "L"
        elif lo == "l":
            x = x + a[0] if rel else a[0]
            y = y + a[1] if rel else a[1]
        elif lo == "h":
            x = x + a[0] if rel else a[0]
        elif lo == "v":
            y = y + a[0] if rel else a[0]
        elif lo == "c":
            for k in (0, 2, 4):
                xs.append(x + a[k] if rel else a[k])
                ys.append(y + a[k + 1] if rel else a[k + 1])
            x = x + a[4] if rel else a[4]
            y = y + a[5] if rel else a[5]
        elif lo == "s":
            x = x + a[2] if rel else a[2]
            y = y + a[3] if rel else a[3]
        elif lo == "z":
            x, y = sx, sy
        xs.append(x)
        ys.append(y)
        i += n
    return min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)


def find_mouth(subs):
    """The mouth is the one small oval, taller than wide, near the middle of
    the face. Its index differs between the four files, so it is found by
    shape rather than hard-coded."""
    best = -1
    best_area = None
    for i, sp in enumerate(subs):
        x, y, w, h = bbox(sp)
        if h <= 0:
            continue
        cx, cy, ratio = x + w / 2, y + h / 2, w / h
        if 0.5 < ratio < 0.95 and w < 200 and h < 250 and abs(cx - 600) < 150 and cy < 600:
            if best == -1 or w * h < best_area:
                best, best_area = i, w * h
    return best


def load_figures():
    figs = {}
    for pi, name in enumerate(PART_FILE):
        src = read(f"img/caroler-{name}.svg")
        d = re.search(r'\sd="([^"]+)"', src).group(1)
        subs = subpaths(d)
        m = find_mouth(subs)
        if m == -1:
            sys.exit(f"no mouth found in caroler-{name}.svg")
        figs[pi] = {
            "all": " ".join(subs),
            "without": " ".join(s for j, s in enumerate(subs) if j != m),
            "mouth": subs[m],
        }
    return figs


def pack_rows(letters, cols=PER_ROW):
    """Group letters into sections, then into rows. A section starts a fresh
    row unless it fits whole in what is left."""
    sections = []
    for i, (_, midi) in enumerate(letters):
        p = part_of(midi)
        if not sections or sections[-1]["p"] != p:
            sections.append({"p": p, "idx": []})
        sections[-1]["idx"].append(i)

    rows, row, used = [], [], 0
    for sec in sections:
        if used and used + len(sec["idx"]) > cols:
            rows.append(row)
            row, used = [], 0
        row.append(sec)
        used += len(sec["idx"])
    if row:
        rows.append(row)
    return rows


def card_svg(name, bulbs, letters, figs):
    lit = set(name)
    rows = pack_rows(letters)
    width_of = lambda r: sum(len(g["idx"]) for g in r) + GAP * (len(r) - 1)
    widest = max(width_of(r) for r in rows)
    W = widest * COL_W
    H = TOP_PAD + len(rows) * (ROW_H + BAND) + BOTTOM_PAD

    defs, body = [], []
    for pi in range(4):
        f = figs[pi]
        if SOLID[pi]:
            defs.append(
                f'<mask id="m{pi}" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="1200">'
                f'<rect width="1200" height="1200" fill="#fff"/>'
                f'<path d="{f["mouth"]}" fill="#000"/></mask>')
            defs.append(f'<symbol id="c{pi}-on" viewBox="0 0 1200 1200">'
                        f'<g mask="url(#m{pi})"><path d="{f["all"]}"/></g></symbol>')
            defs.append(f'<symbol id="c{pi}-off" viewBox="0 0 1200 1200">'
                        f'<path d="{f["all"]}"/></symbol>')
        else:
            defs.append(f'<symbol id="c{pi}-on" viewBox="0 0 1200 1200">'
                        f'<path d="{f["all"]}"/></symbol>')
            defs.append(f'<symbol id="c{pi}-off" viewBox="0 0 1200 1200">'
                        f'<path d="{f["without"]}"/></symbol>')

    for r, row in enumerate(rows):
        col = (widest - width_of(row)) / 2
        top = TOP_PAD + r * (ROW_H + BAND) + LABEL_H
        for g in row:
            for k, li in enumerate(g["idx"]):
                letter, midi = letters[li]
                pi = part_of(midi)
                x = (col + k) * COL_W + (COL_W - FIGURE) / 2
                if letter in lit:
                    colour, glow = bulbs[li % len(bulbs)]
                    defs.append(
                        f'<filter id="g{li}" x="-70%" y="-70%" width="240%" height="240%">'
                        f'<feDropShadow dx="0" dy="0" stdDeviation="9" '
                        f'flood-color="rgb({glow})" flood-opacity="0.85"/></filter>')
                    body.append(
                        f'<use href="#c{pi}-on" x="{x:.1f}" y="{top}" '
                        f'width="{FIGURE}" height="{FIGURE}" fill="{colour}" '
                        f'filter="url(#g{li})"/>')
                else:
                    body.append(
                        f'<use href="#c{pi}-off" x="{x:.1f}" y="{top}" '
                        f'width="{FIGURE}" height="{FIGURE}" fill="{IDLE}"/>')
            col += len(g["idx"]) + GAP

    nl = "\n"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" width="{W:.0f}" height="{H:.0f}">
<defs>
{nl.join(defs)}
<radialGradient id="sky" cx="50%" cy="-6%" r="62%">
  <stop offset="0%" stop-color="#1a284a"/>
  <stop offset="100%" stop-color="#05070f" stop-opacity="0"/>
</radialGradient>
<radialGradient id="floor" cx="50%" cy="102%" r="58%">
  <stop offset="0%" stop-color="#c0392f" stop-opacity="0.10"/>
  <stop offset="100%" stop-color="#c0392f" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="{W:.0f}" height="{H:.0f}" fill="#05070f"/>
<rect width="{W:.0f}" height="{H:.0f}" fill="url(#sky)"/>
<rect width="{W:.0f}" height="{H:.0f}" fill="url(#floor)"/>
{nl.join(body)}
</svg>
''', int(W), int(H)


CHROMES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
]


def find_chrome():
    for p in CHROMES:
        if os.path.exists(p):
            return p
    return shutil.which("chromium") or shutil.which("google-chrome")


def to_png(chrome, svg_path, png_path, w, h, scale=2):
    """ImageMagick without librsvg renders these blank -- it falls back to its
    own SVG reader, which ignores <use>, <symbol> and filters. A browser is the
    only renderer here that draws them the way the site does."""
    profile = os.path.join("/tmp", f"cards-chrome-{os.getpid()}")
    cmd = [
        chrome, "--headless", "--disable-gpu", "--no-sandbox", "--no-first-run",
        "--no-default-browser-check", "--disable-extensions", "--hide-scrollbars",
        "--virtual-time-budget=4000", f"--user-data-dir={profile}",
        f"--force-device-scale-factor={scale}", f"--window-size={w},{h}",
        f"--screenshot={png_path}", f"file://{svg_path}",
    ]
    try:
        subprocess.run(cmd, capture_output=True, timeout=90)
    except subprocess.TimeoutExpired:
        return False
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    return os.path.exists(png_path) and os.path.getsize(png_path) > 2000


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    svg_only = "--svg" in sys.argv

    bulbs, letters, names = load_site()
    figs = load_figures()
    wanted = [a.upper() for a in args] or names
    unknown = [w for w in wanted if w not in names]
    if unknown:
        sys.exit(f"not in NAMES: {', '.join(unknown)}")

    os.makedirs(OUT, exist_ok=True)
    chrome = None if svg_only else find_chrome()
    if not svg_only and not chrome:
        print("no Chrome found; writing SVG only")

    for n in wanted:
        svg, w, h = card_svg(n, bulbs, letters, figs)
        svg_path = os.path.join(OUT, f"{n.lower()}.svg")
        open(svg_path, "w").write(svg)
        line = f"  {n.lower()}.svg"
        if chrome:
            png_path = os.path.join(OUT, f"{n.lower()}.png")
            ok = to_png(chrome, svg_path, png_path, w, h)
            line += f"  +  {n.lower()}.png" if ok else "  (png failed)"
        print(line)

    print(f"\n{len(wanted)} card(s) in {OUT}")


if __name__ == "__main__":
    main()
