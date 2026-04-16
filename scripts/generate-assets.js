/**
 * Generate all Chrome Web Store assets:
 * - Extension icons: 16, 48, 128
 * - Store icon: 128x128 (no alpha beyond icon shape)
 * - Promotional tile small: 440x280
 * - Promotional tile large: 1400x560
 * - Screenshot mockups: 1280x800
 */
const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// ── Color Tokens ────────────────────────────────────────────────
const C = {
  bg:          '#0F172A',
  surface:     '#1E293B',
  surfaceHover:'#334155',
  fg:          '#F8FAFC',
  fgMuted:     '#94A3B8',
  border:      '#475569',
  green:       '#22C55E',
  greenDark:   '#16A34A',
  greenGlow:   '#22C55E40',
  yellow:      '#EAB308',
  red:         '#EF4444',
  blue:        '#3B82F6',
};

// ── Dirs ────────────────────────────────────────────────────────
const ICON_DIR = path.join(__dirname, '..', 'assets', 'icons');
const STORE_DIR = path.join(__dirname, '..', 'assets', 'store');
fs.mkdirSync(ICON_DIR, { recursive: true });
fs.mkdirSync(STORE_DIR, { recursive: true });

// ── Helpers ─────────────────────────────────────────────────────
function savePNG(canvas, filepath) {
  fs.writeFileSync(filepath, canvas.toBuffer('image/png'));
  console.log(`  -> ${path.relative(process.cwd(), filepath)} (${canvas.width}x${canvas.height})`);
}

function saveJPEG(canvas, filepath, quality = 0.92) {
  fs.writeFileSync(filepath, canvas.toBuffer('image/jpeg', { quality }));
  console.log(`  -> ${path.relative(process.cwd(), filepath)} (${canvas.width}x${canvas.height})`);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Draw the heartbeat/pulse line ───────────────────────────────
function drawPulse(ctx, cx, cy, width, amplitude, lineWidth, color) {
  const hw = width / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  // flat left
  ctx.moveTo(cx - hw, cy);
  ctx.lineTo(cx - hw * 0.55, cy);
  // small dip
  ctx.lineTo(cx - hw * 0.40, cy + amplitude * 0.3);
  ctx.lineTo(cx - hw * 0.30, cy);
  // big spike up
  ctx.lineTo(cx - hw * 0.15, cy - amplitude);
  // big spike down
  ctx.lineTo(cx + hw * 0.05, cy + amplitude * 0.65);
  // return
  ctx.lineTo(cx + hw * 0.20, cy);
  // small bump
  ctx.lineTo(cx + hw * 0.35, cy - amplitude * 0.25);
  ctx.lineTo(cx + hw * 0.45, cy);
  // flat right
  ctx.lineTo(cx + hw, cy);

  ctx.stroke();
}

// ── 1. Extension Icons (16, 48, 128) ────────────────────────────
function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = size * 0.18; // corner radius

  // Background with rounded corners
  roundRect(ctx, 0, 0, size, size, r);
  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#0F172A');
  grad.addColorStop(1, '#1E293B');
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle border
  roundRect(ctx, 0.5, 0.5, size - 1, size - 1, r);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = size >= 48 ? 1.5 : 0.5;
  ctx.stroke();

  // Glow behind pulse
  if (size >= 48) {
    ctx.shadowColor = C.green;
    ctx.shadowBlur = size * 0.15;
  }

  // Pulse line
  const pulseWidth = size * 0.72;
  const amplitude = size * 0.22;
  const lineW = size <= 16 ? 1.5 : size <= 48 ? 2.5 : 4;
  drawPulse(ctx, size / 2, size / 2, pulseWidth, amplitude, lineW, C.green);

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Small dot at the end of the pulse (like a cursor)
  if (size >= 48) {
    const dotX = size / 2 + pulseWidth / 2;
    const dotR = size >= 128 ? 4 : 2.5;
    ctx.fillStyle = C.green;
    ctx.beginPath();
    ctx.arc(dotX, size / 2, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

console.log('\n=== Extension Icons ===');
for (const size of [16, 48, 128]) {
  const canvas = generateIcon(size);
  savePNG(canvas, path.join(ICON_DIR, `icon${size}.png`));
}

// ── 2. Store Icon (128x128, opaque background) ──────────────────
console.log('\n=== Store Icon ===');
{
  const canvas = generateIcon(128);
  savePNG(canvas, path.join(STORE_DIR, 'icon-store-128.png'));
}

// ── 3. Promotional Tile Small (440x280) ─────────────────────────
console.log('\n=== Small Promotional Tile (440x280) ===');
{
  const W = 440, H = 280;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0F172A');
  grad.addColorStop(0.6, '#1E293B');
  grad.addColorStop(1, '#0F172A');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid pattern
  ctx.strokeStyle = '#1E293B80';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Large pulse line across the background
  ctx.globalAlpha = 0.15;
  drawPulse(ctx, W / 2, H / 2 + 20, W * 0.9, 80, 6, C.green);
  ctx.globalAlpha = 1;

  // Icon in the top area
  const iconCanvas = generateIcon(56);
  ctx.drawImage(iconCanvas, W / 2 - 28, 40);

  // Title
  ctx.fillStyle = C.fg;
  ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Extension Perf Monitor', W / 2, 128);

  // Subtitle
  ctx.fillStyle = C.green;
  ctx.font = '500 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Monitor  ·  Analyze  ·  Optimize', W / 2, 155);

  // Feature pills
  const pills = ['Network Tracking', 'Impact Scores', 'Real-time Dashboard'];
  const pillY = 195;
  const pillW = 120, pillH = 30, pillGap = 12;
  const totalPillW = pills.length * pillW + (pills.length - 1) * pillGap;
  let pillX = (W - totalPillW) / 2;

  for (const label of pills) {
    roundRect(ctx, pillX, pillY, pillW, pillH, 6);
    ctx.fillStyle = '#22C55E15';
    ctx.fill();
    ctx.strokeStyle = '#22C55E40';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = C.green;
    ctx.font = '500 11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, pillX + pillW / 2, pillY + 19);
    pillX += pillW + pillGap;
  }

  // Bottom tagline
  ctx.fillStyle = C.fgMuted;
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Know which extensions deserve to stay', W / 2, 256);

  saveJPEG(canvas, path.join(STORE_DIR, 'promo-small-440x280.jpg'));
}

// ── 4. Promotional Tile Large (1400x560) ────────────────────────
console.log('\n=== Large Promotional Tile (1400x560) ===');
{
  const W = 1400, H = 560;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0B1120');
  grad.addColorStop(0.3, '#0F172A');
  grad.addColorStop(0.7, '#1E293B');
  grad.addColorStop(1, '#0F172A');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Grid pattern
  ctx.strokeStyle = '#1E293B60';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Background pulse waves
  ctx.globalAlpha = 0.08;
  drawPulse(ctx, W / 2, H * 0.35, W * 0.85, 120, 8, C.green);
  drawPulse(ctx, W / 2, H * 0.65, W * 0.75, 80, 5, C.blue);
  ctx.globalAlpha = 1;

  // Left side: Icon + Text
  const iconCanvas = generateIcon(80);
  ctx.drawImage(iconCanvas, 120, H / 2 - 130);

  ctx.fillStyle = C.fg;
  ctx.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Extension Perf Monitor', 220, H / 2 - 95);

  ctx.fillStyle = C.fgMuted;
  ctx.font = '22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Know exactly which Chrome extensions are draining your resources', 120, H / 2 - 40);

  // Feature items with icons
  const features = [
    { icon: 'NET', label: 'Track network requests per extension' },
    { icon: 'SCR', label: 'Weighted impact scoring (0-100)' },
    { icon: 'VIZ', label: 'Real-time dashboard with charts' },
    { icon: 'PRV', label: '100% local — zero data leaves your browser' },
  ];

  let fy = H / 2 + 20;
  for (const feat of features) {
    // Dot
    ctx.fillStyle = C.green;
    ctx.beginPath();
    ctx.arc(140, fy + 6, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = C.fg;
    ctx.font = '18px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(feat.label, 160, fy + 12);
    fy += 38;
  }

  // Right side: Mock dashboard card
  const cardX = 780, cardY = 60, cardW = 520, cardH = 440;
  roundRect(ctx, cardX, cardY, cardW, cardH, 16);
  ctx.fillStyle = '#1E293BF0';
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Card header
  ctx.fillStyle = C.fg;
  ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Overview', cardX + 24, cardY + 36);

  // Mini KPI cards
  const kpis = [
    { value: '12', label: 'Active' },
    { value: '847', label: 'Requests' },
    { value: '4.2M', label: 'Traffic' },
    { value: '3', label: 'Warnings' },
  ];
  const kpiY = cardY + 56;
  const kpiW = (cardW - 24 * 2 - 8 * 3) / 4;
  let kpiX = cardX + 24;
  for (const kpi of kpis) {
    roundRect(ctx, kpiX, kpiY, kpiW, 56, 8);
    ctx.fillStyle = '#0F172A';
    ctx.fill();
    ctx.strokeStyle = '#33415580';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.fillStyle = C.fg;
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(kpi.value, kpiX + kpiW / 2, kpiY + 28);

    ctx.fillStyle = C.fgMuted;
    ctx.font = '9px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(kpi.label.toUpperCase(), kpiX + kpiW / 2, kpiY + 46);

    kpiX += kpiW + 8;
  }

  // Mock area chart
  const chartX = cardX + 24, chartY = kpiY + 72, chartW = cardW - 48, chartH = 100;
  roundRect(ctx, chartX, chartY, chartW, chartH, 8);
  ctx.fillStyle = '#0F172A';
  ctx.fill();

  // Chart line
  ctx.strokeStyle = C.blue;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const chartPoints = [0.5, 0.3, 0.6, 0.4, 0.8, 0.5, 0.7, 0.3, 0.6, 0.4, 0.5, 0.7, 0.4, 0.6, 0.5];
  for (let i = 0; i < chartPoints.length; i++) {
    const px = chartX + 8 + (i / (chartPoints.length - 1)) * (chartW - 16);
    const py = chartY + chartH - 12 - chartPoints[i] * (chartH - 24);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Fill under line
  ctx.lineTo(chartX + chartW - 8, chartY + chartH - 4);
  ctx.lineTo(chartX + 8, chartY + chartH - 4);
  ctx.closePath();
  ctx.fillStyle = '#3B82F615';
  ctx.fill();

  // Mock extension bars
  const bars = [
    { name: 'uBlock Origin', pct: 0.85, score: 72, color: C.red },
    { name: 'React DevTools', pct: 0.62, score: 58, color: C.yellow },
    { name: 'Grammarly', pct: 0.45, score: 44, color: C.green },
    { name: 'LastPass', pct: 0.30, score: 31, color: C.green },
    { name: 'Dark Reader', pct: 0.18, score: 19, color: C.green },
  ];
  let barY = chartY + chartH + 20;
  ctx.fillStyle = C.fgMuted;
  ctx.font = '10px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CONSUMPTION BY EXTENSION', chartX, barY);
  barY += 16;

  for (const bar of bars) {
    // Label
    ctx.fillStyle = C.fg;
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(bar.name, chartX, barY + 12);

    // Bar track
    const barTrackX = chartX + 120;
    const barTrackW = chartW - 120 - 40;
    roundRect(ctx, barTrackX, barY + 4, barTrackW, 8, 4);
    ctx.fillStyle = '#334155';
    ctx.fill();

    // Bar fill
    roundRect(ctx, barTrackX, barY + 4, barTrackW * bar.pct, 8, 4);
    ctx.fillStyle = bar.color;
    ctx.fill();

    // Score
    ctx.fillStyle = bar.color;
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(bar.score.toString(), chartX + chartW, barY + 13);

    barY += 26;
  }

  saveJPEG(canvas, path.join(STORE_DIR, 'promo-large-1400x560.jpg'));
}

// ── 5. Screenshot Mockups (1280x800) ────────────────────────────
function drawScreenshot(filename, title, drawContent) {
  const W = 1280, H = 800;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Browser chrome background
  ctx.fillStyle = '#202124';
  ctx.fillRect(0, 0, W, H);

  // Tab bar
  ctx.fillStyle = '#292B2E';
  ctx.fillRect(0, 0, W, 40);
  // Active tab
  roundRect(ctx, 8, 6, 200, 34, 8);
  ctx.fillStyle = '#202124';
  ctx.fill();
  ctx.fillStyle = '#E8EAED';
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Extension Perf Monitor', 24, 28);

  // Window control dots
  ctx.fillStyle = '#EF4444'; ctx.beginPath(); ctx.arc(W - 60, 20, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#EAB308'; ctx.beginPath(); ctx.arc(W - 40, 20, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#22C55E'; ctx.beginPath(); ctx.arc(W - 20, 20, 6, 0, Math.PI * 2); ctx.fill();

  // Address bar
  ctx.fillStyle = '#292B2E';
  roundRect(ctx, 220, 8, W - 300, 24, 12);
  ctx.fill();
  ctx.fillStyle = '#9AA0A6';
  ctx.font = '11px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('chrome-extension://perf-monitor/...', 236, 25);

  // Content area
  const contentY = 40;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, contentY, W, H - contentY);

  drawContent(ctx, 0, contentY, W, H - contentY);

  saveJPEG(canvas, path.join(STORE_DIR, filename));
}

// Screenshot 1: Side Panel Overview
console.log('\n=== Screenshot 1: Overview ===');
drawScreenshot('screenshot-1-overview.jpg', 'Overview', (ctx, ox, oy, w, h) => {
  // Simulate a webpage on the left
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(ox, oy, w * 0.65, h);
  ctx.fillStyle = '#E5E7EB';
  roundRect(ctx, ox + 40, oy + 40, w * 0.65 - 80, 60, 8);
  ctx.fill();
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '14px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('example.com — Your normal browsing continues...', ox + 60, oy + 76);
  // Fake content blocks
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = '#F3F4F6';
    roundRect(ctx, ox + 40, oy + 120 + i * 80, w * 0.65 - 80, 60, 8);
    ctx.fill();
  }

  // Side panel on the right
  const px = w * 0.65, pw = w * 0.35;
  ctx.fillStyle = C.bg;
  ctx.fillRect(px, oy, pw, h);
  // Panel border
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px, oy); ctx.lineTo(px, oy + h); ctx.stroke();

  // Panel header
  ctx.fillStyle = C.green;
  drawPulse(ctx, px + 22, oy + 24, 20, 6, 2, C.green);
  ctx.fillStyle = C.fg;
  ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Perf Monitor', px + 38, oy + 28);

  // Tabs
  const tabs = ['Overview', 'Details', 'Settings'];
  const tabW = (pw - 32) / 3;
  for (let i = 0; i < tabs.length; i++) {
    const tx = px + 16 + i * tabW;
    ctx.fillStyle = i === 0 ? C.green : C.fgMuted;
    ctx.font = `${i === 0 ? 'bold' : 'normal'} 12px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(tabs[i], tx + tabW / 2, oy + 60);
    if (i === 0) {
      ctx.fillStyle = C.green;
      ctx.fillRect(tx, oy + 66, tabW, 2);
    }
  }
  ctx.strokeStyle = C.border; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(px, oy + 68); ctx.lineTo(px + pw, oy + 68); ctx.stroke();

  // KPI cards
  const kpis = [{ v: '12', l: 'ACTIVE' }, { v: '847', l: 'REQUESTS' }, { v: '4.2M', l: 'TRAFFIC' }, { v: '3', l: 'WARNS' }];
  const kpiW2 = (pw - 32 - 24) / 4;
  let kx = px + 16;
  const ky = oy + 84;
  for (const kpi of kpis) {
    roundRect(ctx, kx, ky, kpiW2, 52, 6);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.fillStyle = C.fg;
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(kpi.v, kx + kpiW2 / 2, ky + 24);
    ctx.fillStyle = C.fgMuted;
    ctx.font = '8px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(kpi.l, kx + kpiW2 / 2, ky + 42);
    kx += kpiW2 + 8;
  }

  // Section title
  ctx.fillStyle = C.fgMuted;
  ctx.font = '10px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NETWORK ACTIVITY (LAST 30 MIN)', px + 16, ky + 74);

  // Mini chart
  const chX = px + 16, chY = ky + 82, chW = pw - 32, chH = 80;
  roundRect(ctx, chX, chY, chW, chH, 6);
  ctx.fillStyle = C.surface;
  ctx.fill();

  ctx.strokeStyle = C.blue;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const pts = [0.3, 0.4, 0.35, 0.6, 0.5, 0.8, 0.6, 0.7, 0.5, 0.4, 0.6, 0.55, 0.7, 0.5, 0.45];
  for (let i = 0; i < pts.length; i++) {
    const ppx = chX + 8 + (i / (pts.length - 1)) * (chW - 16);
    const ppy = chY + chH - 8 - pts[i] * (chH - 16);
    if (i === 0) ctx.moveTo(ppx, ppy); else ctx.lineTo(ppx, ppy);
  }
  ctx.stroke();

  // Section title
  ctx.fillStyle = C.fgMuted;
  ctx.font = '10px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('CONSUMPTION BY EXTENSION', px + 16, chY + chH + 20);

  // Bars
  const barsData = [
    { n: 'uBlock Origin', p: 0.82, c: C.red },
    { n: 'React DevTools', p: 0.58, c: C.yellow },
    { n: 'Grammarly', p: 0.40, c: C.green },
    { n: 'LastPass', p: 0.25, c: C.green },
    { n: 'Dark Reader', p: 0.15, c: C.green },
  ];
  let by = chY + chH + 30;
  for (const b of barsData) {
    ctx.fillStyle = C.fg;
    ctx.font = '10px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(b.n, px + 16, by + 10);
    const bx = px + 110, bw = pw - 110 - 50;
    roundRect(ctx, bx, by + 2, bw, 6, 3);
    ctx.fillStyle = C.surfaceHover;
    ctx.fill();
    roundRect(ctx, bx, by + 2, bw * b.p, 6, 3);
    ctx.fillStyle = b.c;
    ctx.fill();
    ctx.fillStyle = C.fgMuted;
    ctx.font = '10px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(b.p * 100)}%`, px + pw - 16, by + 10);
    by += 22;
  }
});

// Screenshot 2: Details Tab
console.log('\n=== Screenshot 2: Details Tab ===');
drawScreenshot('screenshot-2-details.jpg', 'Details', (ctx, ox, oy, w, h) => {
  // Same left side webpage
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(ox, oy, w * 0.65, h);
  ctx.fillStyle = '#E5E7EB';
  roundRect(ctx, ox + 40, oy + 40, w * 0.65 - 80, 60, 8);
  ctx.fill();
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '14px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('example.com', ox + 60, oy + 76);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = '#F3F4F6';
    roundRect(ctx, ox + 40, oy + 120 + i * 80, w * 0.65 - 80, 60, 8);
    ctx.fill();
  }

  // Side panel
  const px = w * 0.65, pw = w * 0.35;
  ctx.fillStyle = C.bg;
  ctx.fillRect(px, oy, pw, h);
  ctx.strokeStyle = C.border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px, oy); ctx.lineTo(px, oy + h); ctx.stroke();

  // Header
  drawPulse(ctx, px + 22, oy + 24, 20, 6, 2, C.green);
  ctx.fillStyle = C.fg;
  ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Perf Monitor', px + 38, oy + 28);

  // Tabs (Details active)
  const tabs = ['Overview', 'Details', 'Settings'];
  const tabW = (pw - 32) / 3;
  for (let i = 0; i < tabs.length; i++) {
    const tx = px + 16 + i * tabW;
    ctx.fillStyle = i === 1 ? C.green : C.fgMuted;
    ctx.font = `${i === 1 ? 'bold' : 'normal'} 12px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(tabs[i], tx + tabW / 2, oy + 60);
    if (i === 1) { ctx.fillStyle = C.green; ctx.fillRect(tx, oy + 66, tabW, 2); }
  }
  ctx.strokeStyle = C.border; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(px, oy + 68); ctx.lineTo(px + pw, oy + 68); ctx.stroke();

  // Search bar
  roundRect(ctx, px + 16, oy + 82, pw - 32, 28, 6);
  ctx.fillStyle = C.surface;
  ctx.fill();
  ctx.strokeStyle = C.border; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.fillStyle = C.fgMuted;
  ctx.font = '11px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Search extensions...', px + 28, oy + 100);

  // Sort buttons
  const sortBtns = ['Score', 'Traffic', 'Requests'];
  let sx = px + 16;
  const sy = oy + 120;
  for (let i = 0; i < sortBtns.length; i++) {
    const sw = 60;
    roundRect(ctx, sx, sy, sw, 22, 4);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.strokeStyle = i === 0 ? C.green : C.border;
    ctx.lineWidth = 0.5; ctx.stroke();
    ctx.fillStyle = i === 0 ? C.green : C.fgMuted;
    ctx.font = '10px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sortBtns[i], sx + sw / 2, sy + 15);
    sx += sw + 6;
  }

  // Extension cards
  const exts = [
    { name: 'uBlock Origin', ver: 'v1.56.0', score: 72, color: C.red, expanded: true,
      perms: ['<all_urls>', 'webRequest', 'storage'], requests: '1,240', traffic: '2.1 MB' },
    { name: 'React DevTools', ver: 'v5.0.0', score: 58, color: C.yellow, expanded: false },
    { name: 'Grammarly', ver: 'v14.1', score: 44, color: C.green, expanded: false },
    { name: 'LastPass', ver: 'v4.12', score: 31, color: C.green, expanded: false },
  ];

  let cy = sy + 36;
  for (const ext of exts) {
    const cardH = ext.expanded ? 200 : 40;
    roundRect(ctx, px + 16, cy, pw - 32, cardH, 6);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.strokeStyle = C.border; ctx.lineWidth = 0.5; ctx.stroke();

    // Icon placeholder
    roundRect(ctx, px + 26, cy + 9, 22, 22, 4);
    ctx.fillStyle = C.surfaceHover;
    ctx.fill();

    // Name + version
    ctx.fillStyle = C.fg;
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(ext.name, px + 56, cy + 24);
    ctx.fillStyle = C.fgMuted;
    ctx.font = '10px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(ext.ver, px + 56 + ctx.measureText(ext.name).width + 8, cy + 24);

    // Score badge
    const badgeX = px + pw - 56;
    roundRect(ctx, badgeX, cy + 11, 32, 18, 9);
    ctx.fillStyle = ext.color + '20';
    ctx.fill();
    ctx.fillStyle = ext.color;
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ext.score.toString(), badgeX + 16, cy + 24);

    if (ext.expanded) {
      // Detail rows
      const detailY = cy + 50;
      ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(px + 26, detailY - 4); ctx.lineTo(px + pw - 26, detailY - 4); ctx.stroke();

      const rows = [
        { l: 'Requests', v: ext.requests },
        { l: 'Traffic', v: ext.traffic },
        { l: 'Content Scripts', v: 'All sites' },
      ];
      let ry = detailY;
      for (const row of rows) {
        ctx.fillStyle = C.fgMuted; ctx.font = '11px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(row.l, px + 26, ry + 14);
        ctx.fillStyle = C.fg; ctx.font = '11px "Courier New", monospace'; ctx.textAlign = 'right';
        ctx.fillText(row.v, px + pw - 26, ry + 14);
        ry += 22;
      }

      // Permissions section
      ry += 4;
      ctx.fillStyle = C.fgMuted; ctx.font = '9px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('PERMISSIONS', px + 26, ry + 10);
      ry += 18;
      let permX = px + 26;
      for (const perm of ext.perms) {
        const isSensitive = ['<all_urls>', 'webRequest'].includes(perm);
        const tw = ctx.measureText(perm).width + 12;
        roundRect(ctx, permX, ry, tw, 18, 3);
        ctx.fillStyle = isSensitive ? '#EF444420' : C.surfaceHover;
        ctx.fill();
        ctx.fillStyle = isSensitive ? C.red : C.fgMuted;
        ctx.font = '9px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(perm, permX + 6, ry + 13);
        permX += tw + 4;
      }

      // Disable button
      ry += 32;
      roundRect(ctx, px + 26, ry, pw - 52, 26, 6);
      ctx.fillStyle = '#EF444420';
      ctx.fill();
      ctx.strokeStyle = '#EF444440'; ctx.lineWidth = 0.5; ctx.stroke();
      ctx.fillStyle = C.red;
      ctx.font = '11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Disable Extension', px + pw / 2, ry + 17);
    }

    cy += cardH + 8;
  }
});

// Screenshot 3: Popup
console.log('\n=== Screenshot 3: Popup ===');
{
  const W = 1280, H = 800;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Browser background
  ctx.fillStyle = '#202124';
  ctx.fillRect(0, 0, W, H);

  // Tab bar
  ctx.fillStyle = '#292B2E';
  ctx.fillRect(0, 0, W, 40);
  roundRect(ctx, 8, 6, 200, 34, 8);
  ctx.fillStyle = '#202124';
  ctx.fill();
  ctx.fillStyle = '#E8EAED';
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('New Tab', 24, 28);

  // Window controls
  ctx.fillStyle = '#EF4444'; ctx.beginPath(); ctx.arc(W - 60, 20, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#EAB308'; ctx.beginPath(); ctx.arc(W - 40, 20, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#22C55E'; ctx.beginPath(); ctx.arc(W - 20, 20, 6, 0, Math.PI * 2); ctx.fill();

  // Address bar
  roundRect(ctx, 220, 8, W - 300, 24, 12);
  ctx.fillStyle = '#292B2E';
  ctx.fill();

  // Webpage content (Google-ish)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 40, W, H - 40);
  ctx.fillStyle = '#4285F4';
  ctx.font = 'bold 80px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('G', W / 2 - 90, 340);
  ctx.fillStyle = '#EA4335';
  ctx.fillText('o', W / 2 - 30, 340);
  ctx.fillStyle = '#FBBC05';
  ctx.fillText('o', W / 2 + 25, 340);
  ctx.fillStyle = '#4285F4';
  ctx.fillText('g', W / 2 + 80, 340);
  ctx.fillStyle = '#34A853';
  ctx.fillText('l', W / 2 + 125, 340);
  ctx.fillStyle = '#EA4335';
  ctx.fillText('e', W / 2 + 155, 340);

  // Search bar
  roundRect(ctx, W / 2 - 280, 380, 560, 44, 22);
  ctx.strokeStyle = '#DFE1E5';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Popup overlay (positioned at top-right like a real Chrome popup)
  const popW = 380, popH = 420;
  const popX = W - popW - 20, popY = 50;

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, popX, popY, popW, popH, 12);
  ctx.fillStyle = C.bg;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Popup content
  const pad = 16;

  // Header
  drawPulse(ctx, popX + pad + 12, popY + pad + 10, 20, 6, 2, C.green);
  ctx.fillStyle = C.fg;
  ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Perf Monitor', popX + pad + 28, popY + pad + 14);

  // Status dot
  ctx.fillStyle = C.yellow;
  ctx.beginPath();
  ctx.arc(popX + popW - pad - 4, popY + pad + 10, 4, 0, Math.PI * 2);
  ctx.fill();

  // KPI cards
  const kpis = [{ v: '12', l: 'ACTIVE' }, { v: '4.2M', l: 'TRAFFIC' }, { v: '3', l: 'WARNINGS' }];
  const kpiW2 = (popW - pad * 2 - 16) / 3;
  let kx = popX + pad;
  const ky = popY + pad + 32;
  for (const kpi of kpis) {
    roundRect(ctx, kx, ky, kpiW2, 52, 6);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.strokeStyle = C.surfaceHover; ctx.lineWidth = 0.5; ctx.stroke();

    ctx.fillStyle = C.fg;
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(kpi.v, kx + kpiW2 / 2, ky + 24);
    ctx.fillStyle = C.fgMuted;
    ctx.font = '8px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(kpi.l, kx + kpiW2 / 2, ky + 42);
    kx += kpiW2 + 8;
  }

  // Section title
  ctx.fillStyle = C.fgMuted;
  ctx.font = '10px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('TOP IMPACT', popX + pad, ky + 72);

  // Top 5 bars
  const topExts = [
    { name: 'uBlock Origin', score: 72, pct: 1.0, color: C.red },
    { name: 'React DevTools', score: 58, pct: 0.81, color: C.yellow },
    { name: 'Grammarly', score: 44, pct: 0.61, color: C.green },
    { name: 'LastPass', score: 31, pct: 0.43, color: C.green },
    { name: 'Dark Reader', score: 19, pct: 0.26, color: C.green },
  ];
  let ty = ky + 84;
  for (const ext of topExts) {
    roundRect(ctx, popX + pad, ty, popW - pad * 2, 30, 5);
    ctx.fillStyle = C.surface;
    ctx.fill();

    // Icon placeholder
    roundRect(ctx, popX + pad + 6, ty + 5, 20, 20, 3);
    ctx.fillStyle = C.surfaceHover;
    ctx.fill();

    // Name
    ctx.fillStyle = C.fg;
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(ext.name, popX + pad + 32, ty + 19);

    // Mini bar
    const barX = popX + popW - pad - 110;
    roundRect(ctx, barX, ty + 12, 70, 5, 2.5);
    ctx.fillStyle = C.surfaceHover;
    ctx.fill();
    roundRect(ctx, barX, ty + 12, 70 * ext.pct, 5, 2.5);
    ctx.fillStyle = ext.color;
    ctx.fill();

    // Score
    ctx.fillStyle = ext.color;
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(ext.score.toString(), popX + popW - pad - 6, ty + 19);

    ty += 36;
  }

  // Open Full Panel button
  ty += 4;
  roundRect(ctx, popX + pad, ty, popW - pad * 2, 34, 6);
  ctx.fillStyle = C.surface;
  ctx.fill();
  ctx.strokeStyle = C.surfaceHover; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.fillStyle = C.green;
  ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Open Full Panel  >', popX + popW / 2, ty + 22);

  saveJPEG(canvas, path.join(STORE_DIR, 'screenshot-3-popup.jpg'));
}

console.log('\n=== All assets generated! ===\n');
