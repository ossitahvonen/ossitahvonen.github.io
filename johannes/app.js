const svg = document.querySelector("#weight-chart");
const tooltip = document.querySelector("#chart-tooltip");
const sourceControls = document.querySelector("#source-controls");
const unitControls = document.querySelector("#unit-controls");

const statLatest = document.querySelector("#stat-latest");
const statLatestFoot = document.querySelector("#stat-latest-foot");
const statFirst = document.querySelector("#stat-first");
const statFirstFoot = document.querySelector("#stat-first-foot");
const statLowest = document.querySelector("#stat-lowest");
const statLowestFoot = document.querySelector("#stat-lowest-foot");
const statCount = document.querySelector("#stat-count");
const statCountFoot = document.querySelector("#stat-count-foot");
const chartKicker = document.querySelector("#chart-kicker");
const chartTitle = document.querySelector("#chart-title");

const state = {
  source: "All",
  unit: "kg"
};

const chartBox = {
  width: 960,
  height: 560,
  margin: { top: 32, right: 32, bottom: 88, left: 112 }
};

const tickFormatter = {
  kg: (value) => `${value.toFixed(2)} kg`,
  g: (value) => `${Math.round(value)} g`
};

const shortValue = {
  kg: (value) => `${value.toFixed(2)} kg`,
  g: (value) => `${Math.round(value)} g`
};

const sourceLabel = {
  All: "All measurements",
  Home: "Home weigh-ins",
  Clinic: "Clinic weigh-ins"
};

let allWeights = [];

fetch("./weights.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Could not load weights.json (${response.status})`);
    }

    return response.json();
  })
  .then((data) => {
    allWeights = data
      .map((row) => ({
        ...row,
        ageHours: Number(row.age_hours),
        ageDays: Number(row.age_days),
        measureG: Number(row.measure_g),
        weightKg: Number(row.weight_kg)
      }))
      .sort((a, b) => a.ageHours - b.ageHours);

    bindControls();
    render();
  })
  .catch((error) => {
    console.error(error);
    svg.innerHTML = "";
    const empty = createSvgNode("text", {
      x: chartBox.width / 2,
      y: chartBox.height / 2,
      "text-anchor": "middle",
      class: "empty-state"
    });
    empty.textContent = "Could not load the measurement data.";
    svg.append(empty);
  });

function bindControls() {
  sourceControls.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.source = button.dataset.source;
      updateActiveButtons(sourceControls, "source", state.source);
      render();
    });
  });

  unitControls.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.unit = button.dataset.unit;
      updateActiveButtons(unitControls, "unit", state.unit);
      render();
    });
  });
}

function updateActiveButtons(container, key, value) {
  container.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset[key] === value);
  });
}

function render() {
  const filtered = allWeights.filter((row) => {
    return state.source === "All" ? true : row.source === state.source;
  });

  renderStats(filtered);
  renderChart(filtered);
}

function renderStats(data) {
  if (data.length === 0) {
    statLatest.textContent = "--";
    statLatestFoot.textContent = "No data";
    statFirst.textContent = "--";
    statFirstFoot.textContent = "No data";
    statLowest.textContent = "--";
    statLowestFoot.textContent = "No data";
    statCount.textContent = "0";
    statCountFoot.textContent = "Measurements shown";
    return;
  }

  const latest = data[data.length - 1];
  const first = data[0];
  const lowest = data.reduce((winner, row) => {
    return row.measureG < winner.measureG ? row : winner;
  }, data[0]);

  const latestValue = getUnitValue(latest);
  const firstDelta = getUnitValue(latest) - getUnitValue(first);
  const lowestDelta = getUnitValue(latest) - getUnitValue(lowest);

  statLatest.textContent = shortValue[state.unit](latestValue);
  statLatestFoot.textContent = `Age ${formatAgeCompact(latest.ageHours)}`;
  statFirst.textContent = formatDelta(firstDelta, state.unit);
  statFirstFoot.textContent = "Since birth";
  statLowest.textContent = formatDelta(lowestDelta, state.unit);
  statLowestFoot.textContent = `Lowest at age ${formatAgeCompact(lowest.ageHours)}`;
  statCount.textContent = String(data.length);
  statCountFoot.textContent = sourceLabel[state.source];
}

function renderChart(data) {
  chartKicker.textContent = sourceLabel[state.source];
  chartTitle.textContent = state.unit === "kg" ? "Weight over time" : "Weight over time in grams";
  hideTooltip();
  svg.innerHTML = "";

  if (data.length === 0) {
    const empty = createSvgNode("text", {
      x: chartBox.width / 2,
      y: chartBox.height / 2,
      "text-anchor": "middle",
      class: "empty-state"
    });
    empty.textContent = "No measurements match this filter.";
    svg.append(empty);
    return;
  }

  const innerWidth = chartBox.width - chartBox.margin.left - chartBox.margin.right;
  const innerHeight = chartBox.height - chartBox.margin.top - chartBox.margin.bottom;

  const xValues = data.map((row) => row.ageHours);
  const yValues = data.map((row) => getUnitValue(row));
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMinRaw = Math.min(...yValues);
  const yMaxRaw = Math.max(...yValues);
  const yPad = Math.max((yMaxRaw - yMinRaw) * 0.18, state.unit === "kg" ? 0.05 : 60);
  const yMin = yMinRaw - yPad;
  const yMax = yMaxRaw + yPad;

  const scaleX = (value) => {
    if (xMax === xMin) {
      return chartBox.margin.left + innerWidth / 2;
    }

    return chartBox.margin.left + ((value - xMin) / (xMax - xMin)) * innerWidth;
  };

  const scaleY = (value) => {
    if (yMax === yMin) {
      return chartBox.margin.top + innerHeight / 2;
    }

    return chartBox.margin.top + innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight;
  };

  drawYGrid(scaleY, yMin, yMax);
  drawAxes(scaleX, scaleY, data, innerHeight);
  drawSeries(scaleX, scaleY, data);
  drawLatestPill(scaleX, scaleY, data[data.length - 1]);
}

function drawYGrid(scaleY, yMin, yMax) {
  const group = createSvgNode("g");
  const ticks = buildNumberTicks(yMin, yMax, 4);

  ticks.forEach((tick) => {
    const y = scaleY(tick);
    group.append(
      createSvgNode("line", {
        x1: chartBox.margin.left,
        y1: y,
        x2: chartBox.width - chartBox.margin.right,
        y2: y,
        class: "grid-line"
      })
    );

    const label = createSvgNode("text", {
      x: chartBox.margin.left - 16,
      y: y + 5,
      "text-anchor": "end",
      class: "tick-label"
    });
    label.textContent = tickFormatter[state.unit](tick);
    group.append(label);
  });

  svg.append(group);
}

function drawAxes(scaleX, scaleY, data, innerHeight) {
  const group = createSvgNode("g");
  const axisBottomY = chartBox.height - chartBox.margin.bottom;
  const axisLeftX = chartBox.margin.left;

  group.append(
    createSvgNode("line", {
      x1: axisLeftX,
      y1: axisBottomY,
      x2: chartBox.width - chartBox.margin.right,
      y2: axisBottomY,
      class: "axis-line"
    })
  );

  group.append(
    createSvgNode("line", {
      x1: axisLeftX,
      y1: chartBox.margin.top,
      x2: axisLeftX,
      y2: axisBottomY,
      class: "axis-line"
    })
  );

  const tickData = pickAgeTicks(data, window.innerWidth < 640 ? 4 : 6);

  tickData.forEach((row) => {
    const x = scaleX(row.ageHours);
    group.append(
      createSvgNode("line", {
        x1: x,
        y1: axisBottomY,
        x2: x,
        y2: axisBottomY + 8,
        class: "axis-line"
      })
    );

    const text = createSvgNode("text", {
      x,
      y: axisBottomY + 28,
      "text-anchor": "middle",
      class: "tick-label"
    });

    const [lineOne, lineTwo] = formatAgeMultiline(row.ageHours);
    const firstLine = createSvgNode("tspan", { x, dy: 0 });
    firstLine.textContent = lineOne;
    const secondLine = createSvgNode("tspan", { x, dy: 20 });
    secondLine.textContent = lineTwo;
    text.append(firstLine, secondLine);
    group.append(text);
  });

  const yAxisLabel = createSvgNode("text", {
    x: 28,
    y: chartBox.margin.top + innerHeight / 2,
    "text-anchor": "middle",
    class: "axis-label",
    transform: `rotate(-90 28 ${chartBox.margin.top + innerHeight / 2})`
  });
  yAxisLabel.textContent = state.unit === "kg" ? "Weight (kg)" : "Weight (g)";
  group.append(yAxisLabel);

  const xAxisLabel = createSvgNode("text", {
    x: chartBox.width - chartBox.margin.right,
    y: chartBox.height - 18,
    "text-anchor": "end",
    class: "axis-label"
  });
  xAxisLabel.textContent = "Age from birth";
  group.append(xAxisLabel);

  svg.append(group);
}

function drawSeries(scaleX, scaleY, data) {
  const group = createSvgNode("g");
  const path = createSvgNode("path", {
    d: buildPath(data, scaleX, scaleY),
    class: "series-line"
  });

  group.append(path);

  data.forEach((row) => {
    const circle = createSvgNode("circle", {
      cx: scaleX(row.ageHours),
      cy: scaleY(getUnitValue(row)),
      r: 9,
      class: `series-point source-${row.source.toLowerCase()}`
    });

    circle.addEventListener("mouseenter", (event) => {
      circle.classList.add("is-hovered");
      showTooltip(row, event);
    });

    circle.addEventListener("mousemove", (event) => {
      showTooltip(row, event);
    });

    circle.addEventListener("mouseleave", () => {
      circle.classList.remove("is-hovered");
      hideTooltip();
    });

    group.append(circle);
  });

  svg.append(group);
}

function drawLatestPill(scaleX, scaleY, row) {
  const group = createSvgNode("g", { class: "latest-pill" });
  const x = Math.min(scaleX(row.ageHours) + 14, chartBox.width - chartBox.margin.right - 188);
  const y = Math.max(scaleY(getUnitValue(row)) - 46, chartBox.margin.top + 12);
  const label = `Latest: ${shortValue[state.unit](getUnitValue(row))}`;

  group.append(
    createSvgNode("rect", {
      x,
      y,
      rx: 12,
      ry: 12,
      width: 188,
      height: 38
    })
  );

  const text = createSvgNode("text", {
    x: x + 14,
    y: y + 25
  });
  text.textContent = label;
  group.append(text);
  svg.append(group);
}

function buildPath(data, scaleX, scaleY) {
  return data
    .map((row, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${scaleX(row.ageHours).toFixed(2)},${scaleY(getUnitValue(row)).toFixed(2)}`;
    })
    .join(" ");
}

function showTooltip(row, event) {
  tooltip.hidden = false;
  tooltip.innerHTML = `
    <strong>${shortValue[state.unit](getUnitValue(row))}</strong>
    <span>Age ${formatAgeCompact(row.ageHours)}</span>
    <span>${row.source} measurement</span>
  `;

  const stageBounds = svg.getBoundingClientRect();
  const x = event.clientX - stageBounds.left;
  const y = event.clientY - stageBounds.top;

  tooltip.style.left = `${Math.min(Math.max(x, 110), stageBounds.width - 110)}px`;
  tooltip.style.top = `${Math.max(y, 70)}px`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

function getUnitValue(row) {
  return state.unit === "kg" ? row.weightKg : row.measureG;
}

function formatDelta(value, unit) {
  const rounded = unit === "kg" ? Number(value.toFixed(2)) : Math.round(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  const absolute = Math.abs(rounded);
  return `${sign}${unit === "kg" ? absolute.toFixed(2) : absolute} ${unit}`;
}

function buildNumberTicks(min, max, targetCount) {
  if (min === max) {
    return [min];
  }

  const step = (max - min) / targetCount;
  return Array.from({ length: targetCount + 1 }, (_, index) => min + step * index);
}

function pickAgeTicks(data, maxTicks) {
  if (data.length <= maxTicks) {
    return data;
  }

  const step = (data.length - 1) / (maxTicks - 1);
  const chosen = [];
  const seen = new Set();

  for (let index = 0; index < maxTicks; index += 1) {
    const row = data[Math.round(index * step)];

    if (!seen.has(row.ageHours)) {
      chosen.push(row);
      seen.add(row.ageHours);
    }
  }

  return chosen;
}

function formatAgeCompact(ageHours) {
  const totalMinutes = Math.round(ageHours * 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const minutesLeft = totalMinutes % (24 * 60);
  const hours = Math.floor(minutesLeft / 60);
  const minutes = minutesLeft % 60;
  return `Day ${days} + ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatAgeMultiline(ageHours) {
  const totalMinutes = Math.round(ageHours * 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const minutesLeft = totalMinutes % (24 * 60);
  const hours = Math.floor(minutesLeft / 60);
  const minutes = minutesLeft % 60;
  return [
    `Day ${days}`,
    `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
  ];
}

function createSvgNode(tagName, attributes = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tagName);

  Object.entries(attributes).forEach(([key, value]) => {
    node.setAttribute(key, value);
  });

  return node;
}
