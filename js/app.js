// One caroler per voice part, lowest first, matching the order of PARTS.
const CAROLERS = [
  "img/caroler-bass.svg",
  "img/caroler-tenor.svg",
  "img/caroler-alto.svg",
  "img/caroler-soprano.svg",
];

const FIGURE = 100;
const COL_W = 122;
const ROW_H = 152;

// Fewer carolers per row on a narrow screen. Squeezing all eighteen across
// shrinks each figure until neither it nor its note label can be read.
function perRow() {
  const w = window.innerWidth;
  if (w < 480) return 4;
  if (w < 760) return 6;
  return 9;
}

const selected = new Set();
let bars = d3.selectAll(null);

const svg = d3
  .select("#keyboard")
  .append("svg")
  .attr("role", "group");

function layout() {
  const cols = perRow();
  const rows = Math.ceil(LETTER_NOTES.length / cols);
  svg.attr("viewBox", `0 0 ${cols * COL_W} ${rows * ROW_H}`);
  bars.attr("transform", (d, i) => {
    const x = (i % cols) * COL_W + (COL_W - FIGURE) / 2;
    const y = Math.floor(i / cols) * ROW_H;
    return `translate(${x},${y})`;
  });
}

function partIndex(midi) {
  return PARTS.indexOf(partFor(midi));
}

// Path data in these files is entirely relative, so a subpath cannot simply be
// cut out at its "m" -- the next one would then be positioned from the origin
// instead of from where the previous ended. Walk the commands, track the point,
// and re-emit each subpath with an absolute start.
const ARG_COUNT = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

function splitSubpaths(d) {
  const tok = d.match(/[a-zA-Z]|-?\d*\.?\d+/g);
  let i = 0;
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let cmd = null;
  let open = null;
  const spans = [];

  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) {
      cmd = tok[i];
      i += 1;
    }
    const lo = cmd.toLowerCase();
    const rel = cmd === lo;
    const n = ARG_COUNT[lo];
    const a = tok.slice(i, i + n).map(Number);

    if (lo === "m") {
      if (open) {
        open.end = i - 1;
        spans.push(open);
      }
      x = rel ? x + a[0] : a[0];
      y = rel ? y + a[1] : a[1];
      sx = x;
      sy = y;
      open = { start: i - 1, sx, sy };
      cmd = rel ? "l" : "L";
    } else if (lo === "l") {
      x = rel ? x + a[0] : a[0];
      y = rel ? y + a[1] : a[1];
    } else if (lo === "h") {
      x = rel ? x + a[0] : a[0];
    } else if (lo === "v") {
      y = rel ? y + a[0] : a[0];
    } else if (lo === "c") {
      x = rel ? x + a[4] : a[4];
      y = rel ? y + a[5] : a[5];
    } else if (lo === "s") {
      x = rel ? x + a[2] : a[2];
      y = rel ? y + a[3] : a[3];
    } else if (lo === "z") {
      x = sx;
      y = sy;
    }
    i += n;
  }
  if (open) {
    open.end = tok.length;
    spans.push(open);
  }

  return spans.map((sp) => {
    const t = tok.slice(sp.start, sp.end);
    t[0] = "M";
    t[1] = sp.sx;
    t[2] = sp.sy;
    return t.join(" ");
  });
}

// The mouth is a small oval, taller than it is wide, sitting near the middle of
// the face. Every other subpath is either the head, the body, or a hand, all of
// which are far larger or well off centre.
function findMouth(boxes) {
  let best = -1;
  boxes.forEach((b, i) => {
    const ratio = b.width / b.height;
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const oval = ratio > 0.5 && ratio < 0.95;
    const small = b.width < 200 && b.height < 250;
    if (oval && small && Math.abs(cx - 600) < 150 && cy < 600) {
      if (best === -1 || b.width * b.height < boxes[best].width * boxes[best].height) {
        best = i;
      }
    }
  });
  return best;
}

// The two artwork styles are built oppositely. On the hooded figures the face
// is a cut-out and the mouth is a positive oval inside it, so the mouth appears
// by adding its subpath. On the round-headed ones the head is solid and the
// mouth subpath merges into it invisibly, so there the oval has to be punched
// out with a mask instead. Which case applies is decided by asking whether the
// mouth's own centre is already filled once its subpath is removed.
// Which parts had their mouth punched out with a mask rather than added as a
// subpath. Those two stack the other way round -- see layerOpacity.
const SOLID_HEAD = [];

function loadCarolers() {
  return Promise.all(
    CAROLERS.map((url) => fetch(url).then((r) => r.text()))
  ).then((docs) => {
    const defs = svg.append("defs");
    const probe = svg
      .append("svg")
      .attr("viewBox", "0 0 1200 1200")
      .style("visibility", "hidden");

    const measure = (d, fn) => {
      const node = probe.append("path").attr("d", d).node();
      const result = fn(node);
      node.remove();
      return result;
    };

    docs.forEach((text, i) => {
      const parsed = new DOMParser().parseFromString(text, "image/svg+xml");
      const subs = splitSubpaths(parsed.querySelector("path").getAttribute("d"));
      const boxes = subs.map((d) => measure(d, (n) => n.getBBox()));
      const mouth = findMouth(boxes);

      const full = subs.join(" ");
      if (mouth === -1) {
        SOLID_HEAD[i] = false;
        addSymbol(defs, `caroler-${i}-open`, full);
        addSymbol(defs, `caroler-${i}-closed`, full);
        return;
      }

      const without = subs.filter((_, k) => k !== mouth).join(" ");
      const box = boxes[mouth];
      const centre = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2);
      const solidHead = measure(without, (n) => n.isPointInFill(centre));

      SOLID_HEAD[i] = solidHead;
      if (solidHead) {
        const mask = defs
          .append("mask")
          .attr("id", `mouth-${i}`)
          .attr("maskUnits", "userSpaceOnUse")
          .attr("x", 0)
          .attr("y", 0)
          .attr("width", 1200)
          .attr("height", 1200);
        mask.append("rect").attr("width", 1200).attr("height", 1200).attr("fill", "#fff");
        mask.append("path").attr("d", subs[mouth]).attr("fill", "#000");

        defs
          .append("symbol")
          .attr("id", `caroler-${i}-open`)
          .attr("viewBox", "0 0 1200 1200")
          .append("g")
          .attr("mask", `url(#mouth-${i})`)
          .append("path")
          .attr("d", full);
        addSymbol(defs, `caroler-${i}-closed`, full);
      } else {
        addSymbol(defs, `caroler-${i}-open`, full);
        addSymbol(defs, `caroler-${i}-closed`, without);
      }
    });

    probe.remove();
  });
}

function addSymbol(defs, id, d) {
  defs
    .append("symbol")
    .attr("id", id)
    .attr("viewBox", "0 0 1200 1200")
    .append("path")
    .attr("d", d);
}

// Both states are stacked and the top one is faded per note, which is what
// lets the mouth animate rather than snap between two frames.
//
// Which state goes on top depends on the artwork. Cross-fading only reveals
// anything if the upper layer is opaque where the two differ: on a solid head
// the open state is a hole, so it can never cover the closed one beneath it
// and the mouth would stay shut at every opacity. There the closed state sits
// on top and is faded *out* to open the mouth; on the hooded figures, where
// the mouth is a positive oval, the open state sits on top and is faded in.
const MOUTH_ATTACK = 0.05;
const MOUTH_DECAY = 0.14;

const singing = new Map();
let openLayer = d3.selectAll(null);
let raf = null;

function layerOpacity(d, open) {
  return SOLID_HEAD[partIndex(d.midi)] ? 1 - open : open;
}

function openness(list, t) {
  let best = 0;
  list.forEach((n) => {
    if (t < n.start || t > n.end + MOUTH_DECAY) return;
    let v;
    if (t < n.start + MOUTH_ATTACK) v = (t - n.start) / MOUTH_ATTACK;
    else if (t <= n.end) v = 1;
    else v = 1 - (t - n.end) / MOUTH_DECAY;
    if (v > best) best = v;
  });
  return best;
}

function animateMouths() {
  const t = audioTime();
  openLayer.attr("opacity", (d) => {
    const list = singing.get(d.letter);
    if (!list) return layerOpacity(d, 0);
    while (list.length && list[0].end + MOUTH_DECAY < t) list.shift();
    return layerOpacity(d, openness(list, t));
  });
  raf = requestAnimationFrame(animateMouths);
}

function startMouths() {
  if (raf === null) raf = requestAnimationFrame(animateMouths);
}

function stopMouths() {
  if (raf !== null) cancelAnimationFrame(raf);
  raf = null;
  singing.clear();
  openLayer.attr("opacity", (d) => layerOpacity(d, 0));
}

function buildChoir() {
  bars = svg
    .selectAll("g.bar")
    .data(LETTER_NOTES)
    .join("g")
    .attr("class", "bar")
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (d) => `${d.letter}, ${d.note}`)
    .on("click", (event, d) => toggle(d))
    .on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle(d);
      }
    });

  // A transparent box so the whole cell is clickable, not just inked pixels.
  bars
    .append("rect")
    .attr("class", "bar-hit")
    .attr("x", -(COL_W - FIGURE) / 2)
    .attr("y", 0)
    .attr("width", COL_W)
    .attr("height", ROW_H);

  const figure = bars.append("g").attr("class", "figure");
  figure
    .append("use")
    .attr("href", (d) => {
      const p = partIndex(d.midi);
      return `#caroler-${p}-${SOLID_HEAD[p] ? "open" : "closed"}`;
    })
    .attr("width", FIGURE)
    .attr("height", FIGURE);
  openLayer = figure
    .append("use")
    .attr("class", "mouth-layer")
    .attr("href", (d) => {
      const p = partIndex(d.midi);
      return `#caroler-${p}-${SOLID_HEAD[p] ? "closed" : "open"}`;
    })
    .attr("width", FIGURE)
    .attr("height", FIGURE)
    .attr("opacity", (d) => layerOpacity(d, 0));

  bars
    .append("text")
    .attr("class", "bar-letter")
    .attr("x", FIGURE / 2)
    .attr("y", FIGURE + 26)
    .attr("text-anchor", "middle")
    .text((d) => d.letter);

  bars
    .append("text")
    .attr("class", "bar-note")
    .attr("x", FIGURE / 2)
    .attr("y", FIGURE + 44)
    .attr("text-anchor", "middle")
    .text((d) => d.note);
}

function toggle(d) {
  if (selected.has(d.letter)) {
    selected.delete(d.letter);
    releaseLetter(d.letter);
    singing.delete(d.letter);
    if (selected.size === 0) stopMouths();
  } else {
    selected.add(d.letter);
    holdLetter(d.letter, d.midi);
    startMouths();
  }
  render();
}

function matchedNames() {
  return NAMES.filter((name) =>
    [...name].every((letter) => selected.has(letter))
  );
}

function render() {
  bars.classed("is-on", (d) => selected.has(d.letter));

  const found = matchedNames();

  d3.select("#count").text(
    found.length ? `${found.length} of ${NAMES.length}` : ""
  );

  d3.select("#names")
    .selectAll("span.name")
    .data(found, (d) => d)
    .join(
      (enter) =>
        enter
          .append("span")
          .attr("class", "name")
          .text((d) => d)
          .style("opacity", 0)
          .call((s) => s.transition().duration(400).style("opacity", 1)),
      (update) => update,
      (exit) => exit.transition().duration(200).style("opacity", 0).remove()
    );
}

d3.select("#clear").on("click", () => {
  selected.clear();
  releaseAllLetters();
  stopMouths();
  render();
});

// The mouth shuts partway through each note rather than staying open for its
// full length. The voices sing almost continuously, so holding it open for the
// whole note reads as one gaping mouth instead of a figure articulating.
setNoteListener((letter, at, dur) => {
  let list = singing.get(letter);
  if (!list) {
    list = [];
    singing.set(letter, list);
  }
  list.push({ start: at, end: at + Math.max(0.12, dur * 0.55) });
});

loadCarolers().then(() => {
  buildChoir();
  layout();
  render();
});

let relayout;
window.addEventListener("resize", () => {
  clearTimeout(relayout);
  relayout = setTimeout(layout, 120);
});
