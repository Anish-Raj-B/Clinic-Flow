/**
 * Dependency-free SVG charts replacing Recharts.
 * Daily revenue line chart and busiest-hours bar chart, with hover tooltips and
 * the same colours used by the original app (brand #2278eb, accent #14b596).
 */

import { escapeHtml } from "./utils.js";

const WIDTH = 640;
const HEIGHT = 260;
const PADDING = { top: 16, right: 20, bottom: 34, left: 68 };

function scale(value, min, max, from, to) {
  if (max === min) return from;
  return from + ((value - min) / (max - min)) * (to - from);
}

function formatAxisNumber(value, formatter) {
  return formatter ? formatter(value) : String(value);
}

/**
 * Line chart. `data` is `[{ label, value, format }]`.
 * options: { formatY, formatTooltip, labelFormatter }
 */
export function lineChart(data, options = {}) {
  if (!data.length) return "";
  const values = data.map((row) => Number(row.value) || 0);
  const max = Math.max(...values, 0);
  const min = 0;
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const points = data.map((row, index) => {
    const x =
      data.length === 1
        ? PADDING.left + plotWidth / 2
        : scale(index, 0, data.length - 1, PADDING.left, PADDING.left + plotWidth);
    const y = scale(Number(row.value) || 0, min, max, PADDING.top + plotHeight, PADDING.top);
    return { x, y, row };
  });

  const ticks = 4;
  const gridLines = Array.from({ length: ticks + 1 }, (_, index) => {
    const value = (max / ticks) * index;
    const y = scale(value, min, max, PADDING.top + plotHeight, PADDING.top);
    return `<line class="chart-grid-line" x1="${PADDING.left}" y1="${y}" x2="${
      WIDTH - PADDING.right
    }" y2="${y}"></line>
      <text class="chart-axis-text" x="${PADDING.left - 10}" y="${y + 4}" text-anchor="end">${escapeHtml(
        formatAxisNumber(value, options.formatY),
      )}</text>`;
  }).join("");

  const labelStep = Math.max(1, Math.ceil(data.length / 7));
  const xLabels = data
    .map((row, index) =>
      index % labelStep === 0 || index === data.length - 1
        ? `<text class="chart-axis-text" x="${points[index].x}" y="${
            HEIGHT - 10
          }" text-anchor="middle">${escapeHtml(options.labelFormatter ? options.labelFormatter(row) : row.label)}</text>`
        : "",
    )
    .join("");

  const path = points.map((point) => `${point.x},${point.y}`).join(" ");

  const dots = points
    .map(
      (point) => `<circle cx="${point.x}" cy="${point.y}" r="9" fill="transparent"
        data-tip="${escapeHtml(
          options.tooltip
            ? options.tooltip(point.row)
            : `${point.row.label}: ${point.row.value}`,
        )}"></circle>
      <circle cx="${point.x}" cy="${point.y}" r="3" fill="#2278eb" pointer-events="none"></circle>`,
    )
    .join("");

  return `<div class="chart-wrap">
    <svg viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" role="img"
      aria-label="${escapeHtml(options.ariaLabel || "Line chart")}">
      ${gridLines}
      <polyline points="${path}" fill="none" stroke="#2278eb" stroke-width="2.5"
        stroke-linejoin="round" stroke-linecap="round"></polyline>
      ${dots}
      ${xLabels}
    </svg>
    <div class="chart-tooltip" data-chart-tooltip hidden></div>
  </div>`;
}

/** Bar chart. `data` is `[{ label, value }]`. */
export function barChart(data, options = {}) {
  if (!data.length) return "";
  const values = data.map((row) => Number(row.value) || 0);
  const max = Math.max(...values, 1);
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const slot = plotWidth / data.length;
  const barWidth = Math.min(38, slot * 0.6);

  const ticks = 4;
  const gridLines = Array.from({ length: ticks + 1 }, (_, index) => {
    const value = (max / ticks) * index;
    const y = scale(value, 0, max, PADDING.top + plotHeight, PADDING.top);
    return `<line class="chart-grid-line" x1="${PADDING.left}" y1="${y}" x2="${
      WIDTH - PADDING.right
    }" y2="${y}"></line>
      <text class="chart-axis-text" x="${PADDING.left - 10}" y="${y + 4}" text-anchor="end">${escapeHtml(
        String(Math.round(value)),
      )}</text>`;
  }).join("");

  const bars = data
    .map((row, index) => {
      const value = Number(row.value) || 0;
      const barHeight = (value / max) * plotHeight;
      const x = PADDING.left + slot * index + (slot - barWidth) / 2;
      const y = PADDING.top + plotHeight - barHeight;
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(
        barHeight,
        0,
      )}" rx="6" fill="#14b596" data-tip="${escapeHtml(
        options.tooltip ? options.tooltip(row) : `${row.label}: ${row.value}`,
      )}"></rect>`;
    })
    .join("");

  const labelStep = Math.max(1, Math.ceil(data.length / 8));
  const labels = data
    .map((row, index) =>
      index % labelStep === 0
        ? `<text class="chart-axis-text" x="${
            PADDING.left + slot * index + slot / 2
          }" y="${HEIGHT - 10}" text-anchor="middle">${escapeHtml(row.label)}</text>`
        : "",
    )
    .join("");

  return `<div class="chart-wrap">
    <svg viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" role="img"
      aria-label="${escapeHtml(options.ariaLabel || "Bar chart")}">
      ${gridLines}
      ${bars}
      ${labels}
    </svg>
    <div class="chart-tooltip" data-chart-tooltip hidden></div>
  </div>`;
}

/** Wires hover tooltips for every rendered chart inside `root`. */
export function mountCharts(root) {
  root.querySelectorAll(".chart-wrap").forEach((wrap) => {
    const tooltip = wrap.querySelector("[data-chart-tooltip]");
    if (!tooltip) return;
    wrap.querySelectorAll("[data-tip]").forEach((target) => {
      const show = (event) => {
        const rect = wrap.getBoundingClientRect();
        tooltip.textContent = target.dataset.tip;
        tooltip.hidden = false;
        tooltip.style.left = `${event.clientX - rect.left}px`;
        tooltip.style.top = `${event.clientY - rect.top}px`;
      };
      target.addEventListener("mousemove", show);
      target.addEventListener("mouseenter", show);
      target.addEventListener("mouseleave", () => {
        tooltip.hidden = true;
      });
    });
  });
}
