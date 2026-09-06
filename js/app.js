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

// Inline each file as a <symbol> so the artwork stays a single source of truth
// on disk while still inheriting fill from the page. The paths carry no fill
// attribute of their own, so CSS colours them without the files being touched.
function loadCarolers() {
  return Promise.all(
    CAROLERS.map((url) => fetch(url).then((r) => r.text()))
  ).then((docs) => {
    const defs = svg.append("defs");
    docs.forEach((text, i) => {
      const parsed = new DOMParser().parseFromString(text, "image/svg+xml");
      const path = parsed.querySelector("path");
      const symbol = defs
        .append("symbol")
        .attr("id", `caroler-${i}`)
        .attr("viewBox", "0 0 1200 1200");
      symbol.node().appendChild(document.importNode(path, true));
    });
  });
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

  bars
    .append("use")
    .attr("class", "caroler")
    .attr("href", (d) => `#caroler-${partIndex(d.midi)}`)
    .attr("width", FIGURE)
    .attr("height", FIGURE);

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
  } else {
    selected.add(d.letter);
    holdLetter(d.letter, d.midi);
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
  render();
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
