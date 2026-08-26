// Minimal inline-SVG charting. Deliberately dependency-free: the app's only
// external script is Dexie, and because every colour here is a CSS variable
// the output follows the light/dark theme with no JavaScript involved.

// ===== SHARED SCALE HELPERS =====

// Data bounds for a set of { x, y } points. A flat series, or several
// sessions on the same day, has a zero range that would divide by zero when
// projected, so those are padded out here.
function chartDomain(points) {
  let xMin = Math.min(...points.map(p => p.x));
  let xMax = Math.max(...points.map(p => p.x));
  let yMin = Math.min(...points.map(p => p.y));
  let yMax = Math.max(...points.map(p => p.y));

  if (xMax === xMin) { xMin -= 1; xMax += 1; }
  if (yMax === yMin) { yMin -= 1; yMax += 1; }

  return { xMin, xMax, yMin, yMax };
}

// Project domain values into SVG coordinates. box gives the drawing area's
// outer size and the space reserved on each side for axis labels.
function chartScales(domain, box) {
  const innerW = box.width - box.left - box.right;
  const innerH = box.height - box.top - box.bottom;
  return {
    sx: x => box.left + ((x - domain.xMin) / (domain.xMax - domain.xMin)) * innerW,
    sy: y => box.top + innerH - ((y - domain.yMin) / (domain.yMax - domain.yMin)) * innerH
  };
}

// ===== SPARKLINE =====

// Trend shape only - no axes, no labels. Returns '' when there is nothing
// meaningful to draw, since one point is not a trend.
function renderSparkline(points, { width = 96, height = 28, padding = 3 } = {}) {
  if (!points || points.length < 2) return '';

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const box = { width, height, left: padding, right: padding, top: padding, bottom: padding };
  const { sx, sy } = chartScales(chartDomain(sorted), box);

  const coords = sorted.map(p => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`);
  const latest = sorted[sorted.length - 1];

  return `
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"
         role="img" aria-label="Estimated 1RM trend over ${sorted.length} sessions">
      <polyline points="${coords.join(' ')}" />
      <circle class="sparkline-latest" cx="${sx(latest.x).toFixed(1)}" cy="${sy(latest.y).toFixed(1)}" r="2.5" />
    </svg>
  `;
}

// ===== LINE CHART =====

// Full chart with a labelled y axis, first/last dates on the x axis, and one
// tap target per point. Points may carry isPR to be drawn as a filled marker.
// The SVG scales to its container, so the modal decides the real size.
function renderLineChart(points, { width = 320, height = 190, emptyMessage = 'No sets in this rep range.' } = {}) {
  if (!points || points.length === 0) {
    return `<p class="chart-empty">${emptyMessage}</p>`;
  }

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const box = { width, height, left: 34, right: 10, top: 10, bottom: 24 };
  const domain = chartDomain(sorted);

  // Round the y bounds outwards to whole steps so the tick labels sit exactly
  // on their gridlines instead of near them.
  const STEP = 5;
  domain.yMin = Math.floor(domain.yMin / STEP) * STEP;
  domain.yMax = Math.ceil(domain.yMax / STEP) * STEP;
  if (domain.yMax === domain.yMin) domain.yMax = domain.yMin + STEP;

  const { sx, sy } = chartScales(domain, box);

  const ticks = [domain.yMin, (domain.yMin + domain.yMax) / 2, domain.yMax];
  const grid = ticks.map(t => {
    const y = sy(t).toFixed(1);
    return `<line class="chart-grid" x1="${box.left}" y1="${y}" x2="${width - box.right}" y2="${y}" />`
      + `<text class="chart-label" x="${box.left - 5}" y="${y}" dy="3.5" text-anchor="end">${Math.round(t)}</text>`;
  }).join('');

  // Only two date labels: one per session would be unreadable after a year.
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const spanDays = (last.x - first.x) / 86400000;
  const dateOpts = spanDays > 300
    ? { month: 'short', year: '2-digit' }
    : { month: 'short', day: 'numeric' };
  const fmtAxisDate = ms => new Date(ms).toLocaleDateString(undefined, dateOpts);

  const axisX = sorted.length > 1
    ? `<text class="chart-label" x="${box.left}" y="${height - 7}" text-anchor="start">${fmtAxisDate(first.x)}</text>`
      + `<text class="chart-label" x="${width - box.right}" y="${height - 7}" text-anchor="end">${fmtAxisDate(last.x)}</text>`
    : `<text class="chart-label" x="${width / 2}" y="${height - 7}" text-anchor="middle">${fmtAxisDate(first.x)}</text>`;

  const coords = sorted.map(p => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`);
  const line = sorted.length > 1
    ? `<polyline class="chart-line" points="${coords.join(' ')}" />`
    : '';

  // Visible markers only for PRs and the latest session - a dot per point is
  // noise once there are dozens. Every point still gets an invisible circle
  // wide enough to tap.
  const dots = sorted.map((p, i) => {
    const cx = sx(p.x).toFixed(1);
    const cy = sy(p.y).toFixed(1);
    const marker = (p.isPR || i === sorted.length - 1)
      ? `<circle class="chart-dot${p.isPR ? ' chart-dot-pr' : ''}" cx="${cx}" cy="${cy}" r="3" />`
      : '';
    return marker + `<circle class="chart-hit" cx="${cx}" cy="${cy}" r="10" data-index="${i}" />`;
  }).join('');

  return `
    <svg class="chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet"
         role="img" aria-label="Estimated 1RM over ${sorted.length} sessions">
      ${grid}
      ${axisX}
      ${line}
      ${dots}
    </svg>
  `;
}
