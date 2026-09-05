const BAR_W = 46;
const BAR_GAP = 10;
const VB_W = LETTER_NOTES.length * (BAR_W + BAR_GAP) + BAR_GAP;
const VB_H = 300;

const selected = new Set();

const barLength = d3
  .scaleLinear()
  .domain(d3.extent(LETTER_NOTES, (d) => d.midi))
  .range([230, 120]);

const svg = d3
  .select("#keyboard")
  .append("svg")
  .attr("viewBox", `0 0 ${VB_W} ${VB_H}`)
  .attr("role", "group");

const bars = svg
  .selectAll("g.bar")
  .data(LETTER_NOTES)
  .join("g")
  .attr("class", "bar")
  .attr("transform", (d, i) => `translate(${BAR_GAP + i * (BAR_W + BAR_GAP)},0)`)
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

bars
  .append("rect")
  .attr("class", "bar-body")
  .attr("x", 0)
  .attr("y", (d) => (VB_H - barLength(d.midi)) / 2)
  .attr("width", BAR_W)
  .attr("height", (d) => barLength(d.midi))
  .attr("rx", 8);

bars
  .append("text")
  .attr("class", "bar-letter")
  .attr("x", BAR_W / 2)
  .attr("y", VB_H / 2)
  .attr("text-anchor", "middle")
  .attr("dominant-baseline", "central")
  .text((d) => d.letter);

bars
  .append("text")
  .attr("class", "bar-note")
  .attr("x", BAR_W / 2)
  .attr("y", (d) => (VB_H + barLength(d.midi)) / 2 - 16)
  .attr("text-anchor", "middle")
  .text((d) => d.note);

function toggle(d) {
  if (selected.has(d.letter)) {
    selected.delete(d.letter);
    voiceOff(d.letter);
  } else {
    selected.add(d.letter);
    voiceOn(d.letter, d.midi);
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

const canonBtn = d3.select("#canon");
canonBtn.on("click", () => {
  if (bassIsPlaying()) {
    bassStop();
  } else {
    bassStart();
  }
  const on = bassIsPlaying();
  canonBtn
    .attr("aria-pressed", on)
    .classed("is-on", on)
    .select(".glyph")
    .html(on ? "&#9632;" : "&#9654;");
});

d3.select("#clear").on("click", () => {
  selected.clear();
  allVoicesOff();
  render();
});

render();
