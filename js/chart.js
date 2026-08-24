// Minimal inline-SVG charting. Deliberately dependency-free: the app's only
// external script is Dexie, and because every colour here is a CSS variable
// the output follows the light/dark theme with no JavaScript involved.

// Draw a sparkline for a series of { x, y } points. x is any number (a
// timestamp for a time series), y the value. Points may be in any order.
// Returns an SVG string, or '' when there is nothing meaningful to draw.
function renderSparkline(points, { width = 96, height = 28, padding = 3 } = {}) {
  // One point is not a trend, so there is nothing to show yet.
  if (!points || points.length < 2) return '';

  const sorted = [...points].sort((a, b) => a.x - b.x);

  let xMin = Math.min(...sorted.map(p => p.x));
  let xMax = Math.max(...sorted.map(p => p.x));
  let yMin = Math.min(...sorted.map(p => p.y));
  let yMax = Math.max(...sorted.map(p => p.y));

  // A flat series, or several sessions on the same day, has a zero range and
  // would divide by zero below. Pad it so the line renders down the middle.
  if (xMax === xMin) { xMin -= 1; xMax += 1; }
  if (yMax === yMin) { yMin -= 1; yMax += 1; }

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const sx = x => padding + ((x - xMin) / (xMax - xMin)) * innerW;
  const sy = y => padding + innerH - ((y - yMin) / (yMax - yMin)) * innerH;

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
