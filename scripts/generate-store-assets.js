/**
 * Generate Chrome Web Store assets for Extension Audit v2.
 * All images use JPEG (no alpha) or 24-bit PNG per store requirements.
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'assets', 'store');
fs.mkdirSync(DIR, { recursive: true });

// ── Palette ────────────────────────────────────────
const C = {
  bg: '#0F172A',
  surface: '#151e2e',
  fg: '#E2E8F0',
  dim: '#64748B',
  border: '#1e293b',
  accent: '#34D399',
  yellow: '#FBBF24',
  red: '#F87171',
  blue: '#60A5FA',
  white: '#FFFFFF',
};

function save(canvas, name) {
  const p = path.join(DIR, name);
  if (name.endsWith('.jpg')) {
    fs.writeFileSync(p, canvas.toBuffer('image/jpeg', { quality: 0.95 }));
  } else {
    fs.writeFileSync(p, canvas.toBuffer('image/png'));
  }
  console.log(`  ${name} (${canvas.width}x${canvas.height})`);
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

function drawShield(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = size / 24;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -10 * s);
  ctx.lineTo(8 * s, -6 * s);
  ctx.lineTo(8 * s, 2 * s);
  ctx.quadraticCurveTo(8 * s, 8 * s, 0, 11 * s);
  ctx.quadraticCurveTo(-8 * s, 8 * s, -8 * s, 2 * s);
  ctx.lineTo(-8 * s, -6 * s);
  ctx.closePath();
  ctx.fill();
  // Checkmark inside
  ctx.strokeStyle = C.bg;
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-3 * s, 0);
  ctx.lineTo(-0.5 * s, 3 * s);
  ctx.lineTo(4 * s, -3 * s);
  ctx.stroke();
  ctx.restore();
}

function drawBrowserChrome(ctx, W, H) {
  // Tab bar
  ctx.fillStyle = '#292B2E';
  ctx.fillRect(0, 0, W, 40);
  roundRect(ctx, 8, 6, 180, 34, 8);
  ctx.fillStyle = '#202124';
  ctx.fill();
  ctx.fillStyle = '#E8EAED';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Extension Audit', 22, 28);
  // Dots
  ctx.fillStyle = '#EF4444'; ctx.beginPath(); ctx.arc(W - 56, 20, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#EAB308'; ctx.beginPath(); ctx.arc(W - 38, 20, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#22C55E'; ctx.beginPath(); ctx.arc(W - 20, 20, 5, 0, Math.PI * 2); ctx.fill();
  // Address bar
  roundRect(ctx, 200, 8, W - 260, 24, 12);
  ctx.fillStyle = '#292B2E';
  ctx.fill();
}

function drawMockExtCard(ctx, x, y, w, name, score, color, expanded) {
  const h = expanded ? 140 : 36;
  roundRect(ctx, x, y, w, h, 5);
  ctx.fillStyle = C.surface;
  ctx.fill();
  ctx.strokeStyle = C.border; ctx.lineWidth = 0.5; ctx.stroke();
  // Name
  ctx.fillStyle = C.fg;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(name, x + 10, y + 23);
  // Badge
  roundRect(ctx, x + w - 40, y + 10, 30, 16, 3);
  ctx.fillStyle = color + '20';
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(score), x + w - 25, y + 22);

  if (expanded) {
    ctx.strokeStyle = C.border; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x + 8, y + 40); ctx.lineTo(x + w - 8, y + 40); ctx.stroke();
    const perms = ['<all_urls>', 'cookies', 'webRequest', 'tabs'];
    let px = x + 10, py = y + 52;
    ctx.fillStyle = C.dim; ctx.font = '9px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('PERMISSIONS', px, py);
    py += 14;
    for (const p of perms) {
      const tw = ctx.measureText(p).width + 10;
      roundRect(ctx, px, py, tw, 16, 3);
      ctx.fillStyle = '#F8717115'; ctx.fill();
      ctx.fillStyle = C.red; ctx.font = '9px monospace'; ctx.textAlign = 'left';
      ctx.fillText(p, px + 5, py + 12);
      px += tw + 4;
      if (px > x + w - 30) { px = x + 10; py += 20; }
    }
    // Disable button
    roundRect(ctx, x + 10, y + h - 30, w - 20, 22, 4);
    ctx.fillStyle = 'transparent'; ctx.strokeStyle = '#F8717130'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.fillStyle = C.red; ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Disable This Extension', x + w / 2, y + h - 14);
  }
  return h;
}

function drawMockBar(ctx, x, y, w, name, score, maxScore, color) {
  ctx.fillStyle = C.fg; ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(name, x, y + 10);
  const barX = x + 100, barW = w - 145;
  roundRect(ctx, barX, y + 4, barW, 3, 1.5);
  ctx.fillStyle = C.border; ctx.fill();
  roundRect(ctx, barX, y + 4, barW * (score / maxScore), 3, 1.5);
  ctx.fillStyle = color; ctx.fill();
  ctx.fillStyle = C.dim; ctx.font = '10px monospace'; ctx.textAlign = 'right';
  ctx.fillText(String(score), x + w, y + 11);
}

// ═══════════════════════════════════════════════════
// Screenshot 1: Side Panel — Overview + Extensions
// ═══════════════════════════════════════════════════
console.log('\n=== Screenshots ===');
{
  const W = 1280, H = 800;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#202124'; ctx.fillRect(0, 0, W, H);
  drawBrowserChrome(ctx, W, H);

  // Web page (left side)
  ctx.fillStyle = C.white;
  ctx.fillRect(0, 40, W * 0.65, H - 40);
  for (let i = 0; i < 6; i++) {
    roundRect(ctx, 40, 60 + i * 100, W * 0.65 - 80, 70, 8);
    ctx.fillStyle = '#F3F4F6'; ctx.fill();
  }

  // Side panel (right)
  const px = W * 0.65, pw = W * 0.35;
  ctx.fillStyle = C.bg; ctx.fillRect(px, 40, pw, H - 40);
  ctx.strokeStyle = C.border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px, 40); ctx.lineTo(px, H); ctx.stroke();

  // Header
  drawShield(ctx, px + 20, 64, 16, C.accent);
  ctx.fillStyle = C.fg; ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Extension Audit', px + 34, 68);

  // KPI cards
  const kpis = [{ v: '12', l: 'ACTIVE' }, { v: '3', l: 'HIGH RISK' }, { v: '4', l: 'MEDIUM' }, { v: '2', l: 'ALERTS' }];
  const kw = (pw - 44) / 4;
  let kx = px + 14;
  const ky = 88;
  for (const kpi of kpis) {
    roundRect(ctx, kx, ky, kw, 44, 5);
    ctx.fillStyle = C.surface; ctx.fill();
    ctx.strokeStyle = C.border; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.fillStyle = C.fg; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
    ctx.fillText(kpi.v, kx + kw / 2, ky + 22);
    ctx.fillStyle = C.dim; ctx.font = '8px system-ui, sans-serif';
    ctx.fillText(kpi.l, kx + kw / 2, ky + 36);
    kx += kw + 5;
  }

  // Risk bars
  ctx.fillStyle = C.dim; ctx.font = '9px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('EXTENSIONS BY RISK', px + 14, ky + 64);
  const barsData = [
    { n: 'Bitwarden', s: 68, c: C.yellow },
    { n: 'React DevTools', s: 54, c: C.yellow },
    { n: 'uBlock Origin', s: 47, c: C.accent },
    { n: 'Grammarly', s: 41, c: C.accent },
    { n: 'Dark Reader', s: 33, c: C.accent },
  ];
  let by = ky + 76;
  for (const b of barsData) {
    drawMockBar(ctx, px + 14, by, pw - 28, b.n, b.s, 68, b.c);
    by += 20;
  }

  // Divider
  ctx.fillStyle = C.border; ctx.fillRect(px + 14, by + 6, pw - 28, 1);

  // Extension cards
  const cards = [
    { n: 'Bitwarden Password Manager', s: 68, c: C.yellow, exp: true },
    { n: 'React DevTools', s: 54, c: C.yellow, exp: false },
    { n: 'uBlock Origin', s: 47, c: C.accent, exp: false },
    { n: 'Grammarly', s: 41, c: C.accent, exp: false },
  ];
  let cy = by + 18;
  for (const card of cards) {
    const ch = drawMockExtCard(ctx, px + 14, cy, pw - 28, card.n, card.s, card.c, card.exp);
    cy += ch + 5;
  }

  save(c, 'screenshot-1-overview.jpg');
}

// ═══════════════════════════════════════════════════
// Screenshot 2: Popup
// ═══════════════════════════════════════════════════
{
  const W = 1280, H = 800;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#202124'; ctx.fillRect(0, 0, W, H);
  drawBrowserChrome(ctx, W, H);

  // White page
  ctx.fillStyle = C.white; ctx.fillRect(0, 40, W, H - 40);
  ctx.fillStyle = '#9CA3AF'; ctx.font = '14px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Your browsing continues normally...', W / 2, H / 2);

  // Popup (top right)
  const popW = 360, popH = 380;
  const popX = W - popW - 20, popY = 50;
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
  roundRect(ctx, popX, popY, popW, popH, 10);
  ctx.fillStyle = C.bg; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // Header
  drawShield(ctx, popX + 24, popY + 20, 14, C.accent);
  ctx.fillStyle = C.fg; ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Extension Audit', popX + 38, popY + 24);
  ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(popX + popW - 16, popY + 20, 3, 0, Math.PI * 2); ctx.fill();

  // KPIs
  const pkpis = [{ v: '12', l: 'ACTIVE' }, { v: '3', l: 'HIGH RISK' }, { v: '2', l: 'ALERTS' }];
  const pkw = (popW - 40) / 3;
  let pkx = popX + 14;
  const pky = popY + 42;
  for (const kpi of pkpis) {
    roundRect(ctx, pkx, pky, pkw, 44, 5);
    ctx.fillStyle = C.surface; ctx.fill();
    ctx.fillStyle = C.fg; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
    ctx.fillText(kpi.v, pkx + pkw / 2, pky + 22);
    ctx.fillStyle = C.dim; ctx.font = '8px system-ui, sans-serif';
    ctx.fillText(kpi.l, pkx + pkw / 2, pky + 36);
    pkx += pkw + 6;
  }

  // Section title + header
  ctx.fillStyle = C.dim; ctx.font = '9px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('HIGHEST RISK', popX + 14, pky + 64);
  ctx.textAlign = 'right';
  ctx.fillText('RISK', popX + popW - 14, pky + 64);

  // Top 5
  const topExts = [
    { n: 'Bitwarden Password Manager', s: 68, c: C.yellow },
    { n: 'React DevTools', s: 54, c: C.yellow },
    { n: 'uBlock Origin', s: 47, c: C.accent },
    { n: 'Grammarly for Chrome', s: 41, c: C.accent },
    { n: 'Dark Reader', s: 33, c: C.accent },
  ];
  let ty = pky + 76;
  for (const ext of topExts) {
    roundRect(ctx, popX + 14, ty, popW - 28, 28, 4);
    ctx.fillStyle = C.surface; ctx.fill();
    ctx.fillStyle = C.fg; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(ext.n, popX + 22, ty + 18);
    // Mini bar
    const barX = popX + popW - 92;
    roundRect(ctx, barX, ty + 11, 50, 3, 1.5);
    ctx.fillStyle = C.border; ctx.fill();
    roundRect(ctx, barX, ty + 11, 50 * (ext.s / 68), 3, 1.5);
    ctx.fillStyle = ext.c; ctx.fill();
    ctx.fillStyle = ext.c; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'right';
    ctx.fillText(String(ext.s), popX + popW - 18, ty + 18);
    ty += 34;
  }

  // Button
  ty += 4;
  roundRect(ctx, popX + 14, ty, popW - 28, 30, 5);
  ctx.strokeStyle = C.border; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.fillStyle = C.accent; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Open Full Audit  >', popX + popW / 2, ty + 19);

  save(c, 'screenshot-2-popup.jpg');
}

// ═══════════════════════════════════════════════════
// Screenshot 3: About section visible
// ═══════════════════════════════════════════════════
{
  const W = 1280, H = 800;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#202124'; ctx.fillRect(0, 0, W, H);
  drawBrowserChrome(ctx, W, H);
  ctx.fillStyle = C.white; ctx.fillRect(0, 40, W * 0.65, H - 40);
  for (let i = 0; i < 5; i++) {
    roundRect(ctx, 40, 60 + i * 110, W * 0.65 - 80, 80, 8);
    ctx.fillStyle = '#F3F4F6'; ctx.fill();
  }

  const px = W * 0.65, pw = W * 0.35;
  ctx.fillStyle = C.bg; ctx.fillRect(px, 40, pw, H - 40);
  ctx.strokeStyle = C.border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px, 40); ctx.lineTo(px, H); ctx.stroke();

  // Header
  drawShield(ctx, px + 20, 64, 16, C.accent);
  ctx.fillStyle = C.fg; ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Extension Audit', px + 34, 68);

  // About section
  const ay = 92;
  ctx.fillStyle = C.dim; ctx.font = '9px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('HOW THIS WORKS', px + 14, ay);

  const lines = [
    { t: 'This tool audits extensions using static analysis', bold: false },
    { t: 'only — it reads each extension\'s declared permissions', bold: false },
    { t: 'and content script patterns from their manifest.', bold: false },
    { t: '', bold: false },
    { t: 'Risk Score (0–100)', bold: true },
    { t: '', bold: false },
    { t: '· Permission sensitivity (60%)', bold: false },
    { t: '  Sensitive: <all_urls>, cookies, history,', bold: false },
    { t: '  webRequest → weighted 2×; others 0.5×', bold: false },
    { t: '', bold: false },
    { t: '· Content script scope (40%)', bold: false },
    { t: '  All websites → highest score', bold: false },
    { t: '  Narrow patterns → lower', bold: false },
    { t: '  None → 0', bold: false },
    { t: '', bold: false },
    { t: 'Scores are deterministic — same extension,', bold: false },
    { t: 'same score. No estimation, no sampling.', bold: false },
    { t: '', bold: false },
    { t: 'Chrome does not expose per-extension CPU or', bold: false },
    { t: 'memory to other extensions. This tool provides', bold: false },
    { t: 'the most reliable analysis possible within', bold: false },
    { t: 'Chrome\'s security model.', bold: false },
  ];

  let ly = ay + 16;
  for (const line of lines) {
    if (line.t === '') { ly += 6; continue; }
    ctx.fillStyle = line.bold ? C.fg : C.dim;
    ctx.font = line.bold ? 'bold 11px system-ui, sans-serif' : '11px system-ui, sans-serif';
    ctx.fillText(line.t, px + 14, ly);
    ly += 16;
  }

  // Score formula visualization
  ly += 10;
  roundRect(ctx, px + 14, ly, pw - 28, 60, 6);
  ctx.fillStyle = C.surface; ctx.fill();
  ctx.strokeStyle = C.border; ctx.lineWidth = 0.5; ctx.stroke();

  // Permissions bar (60%)
  ctx.fillStyle = C.dim; ctx.font = '9px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Permissions', px + 22, ly + 18);
  roundRect(ctx, px + 90, ly + 10, (pw - 120) * 0.6, 6, 3);
  ctx.fillStyle = C.accent; ctx.fill();
  ctx.fillStyle = C.dim; ctx.font = '9px monospace'; ctx.textAlign = 'right';
  ctx.fillText('60%', px + pw - 22, ly + 18);

  // Scope bar (40%)
  ctx.fillStyle = C.dim; ctx.font = '9px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Scope', px + 22, ly + 42);
  roundRect(ctx, px + 90, ly + 34, (pw - 120) * 0.4, 6, 3);
  ctx.fillStyle = C.blue; ctx.fill();
  ctx.fillStyle = C.dim; ctx.font = '9px monospace'; ctx.textAlign = 'right';
  ctx.fillText('40%', px + pw - 22, ly + 42);

  save(c, 'screenshot-3-about.jpg');
}

// ═══════════════════════════════════════════════════
// Small Promo Tile (440×280)
// ═══════════════════════════════════════════════════
console.log('\n=== Promo Tiles ===');
{
  const W = 440, H = 280;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0B1120'); grad.addColorStop(0.6, '#0F172A'); grad.addColorStop(1, '#151e2e');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = '#1e293b40'; ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Shield icon
  drawShield(ctx, W / 2, 60, 36, C.accent);

  // Title
  ctx.fillStyle = C.fg; ctx.font = 'bold 26px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Extension Audit', W / 2, 120);
  ctx.fillStyle = C.accent; ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Permissions  ·  Risk Score  ·  Scope', W / 2, 145);

  // Feature pills
  const pills = ['Static Analysis', 'Deterministic', 'Privacy First'];
  const pillW = 110, pillH = 26, gap = 10;
  const totalW = pills.length * pillW + (pills.length - 1) * gap;
  let pillX = (W - totalW) / 2;
  for (const label of pills) {
    roundRect(ctx, pillX, 170, pillW, pillH, 5);
    ctx.fillStyle = '#34D39910'; ctx.fill();
    ctx.strokeStyle = '#34D39930'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.fillStyle = C.accent; ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, pillX + pillW / 2, 187);
    pillX += pillW + gap;
  }

  ctx.fillStyle = C.dim; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Know which extensions deserve to stay', W / 2, 228);

  save(c, 'promo-small-440x280.jpg');
}

// ═══════════════════════════════════════════════════
// Large Promo Tile (1400×560)
// ═══════════════════════════════════════════════════
{
  const W = 1400, H = 560;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0B1120'); grad.addColorStop(0.35, '#0F172A');
  grad.addColorStop(0.7, '#151e2e'); grad.addColorStop(1, '#0F172A');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = '#1e293b40'; ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Left side: text
  drawShield(ctx, 140, H / 2 - 120, 48, C.accent);

  ctx.fillStyle = C.fg; ctx.font = 'bold 44px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Extension Audit', 120, H / 2 - 55);
  ctx.fillStyle = C.dim; ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Audit Chrome extensions by permissions and risk.', 120, H / 2 - 20);
  ctx.fillText('Know which ones deserve to stay.', 120, H / 2 + 10);

  const features = [
    'Permission sensitivity analysis (60%)',
    'Content script scope scoring (40%)',
    'Deterministic — same extension, same score',
    '100% local — zero data leaves your browser',
  ];
  let fy = H / 2 + 55;
  for (const f of features) {
    ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(140, fy + 4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.fg; ctx.font = '16px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(f, 155, fy + 9);
    fy += 32;
  }

  // Right side: mock dashboard card
  const cardX = 740, cardY = 50, cardW = 560, cardH = 460;
  roundRect(ctx, cardX, cardY, cardW, cardH, 14);
  ctx.fillStyle = C.bg + 'F5'; ctx.fill();
  ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.stroke();

  // Card header
  drawShield(ctx, cardX + 22, cardY + 24, 14, C.accent);
  ctx.fillStyle = C.fg; ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Extension Audit', cardX + 36, cardY + 28);

  // KPIs
  const ckpis = [{ v: '12', l: 'ACTIVE' }, { v: '3', l: 'HIGH' }, { v: '4', l: 'MEDIUM' }, { v: '2', l: 'ALERTS' }];
  const ckw = (cardW - 48) / 4;
  let ckx = cardX + 16;
  const cky = cardY + 46;
  for (const kpi of ckpis) {
    roundRect(ctx, ckx, cky, ckw, 44, 5);
    ctx.fillStyle = C.surface; ctx.fill();
    ctx.strokeStyle = C.border; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.fillStyle = C.fg; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
    ctx.fillText(kpi.v, ckx + ckw / 2, cky + 22);
    ctx.fillStyle = C.dim; ctx.font = '8px system-ui, sans-serif';
    ctx.fillText(kpi.l, ckx + ckw / 2, cky + 36);
    ckx += ckw + 6;
  }

  // Risk bars in card
  ctx.fillStyle = C.dim; ctx.font = '9px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('EXTENSIONS BY RISK', cardX + 16, cky + 64);
  const cbars = [
    { n: 'Bitwarden', s: 68, c: C.yellow },
    { n: 'React DevTools', s: 54, c: C.yellow },
    { n: 'uBlock Origin', s: 47, c: C.accent },
    { n: 'Grammarly', s: 41, c: C.accent },
    { n: 'Dark Reader', s: 33, c: C.accent },
  ];
  let cby = cky + 76;
  for (const b of cbars) {
    drawMockBar(ctx, cardX + 16, cby, cardW - 32, b.n, b.s, 68, b.c);
    cby += 20;
  }

  // Extension cards in dashboard
  cby += 14;
  const cCards = [
    { n: 'Bitwarden Password Manager', s: 68, c: C.yellow },
    { n: 'React DevTools', s: 54, c: C.yellow },
    { n: 'uBlock Origin', s: 47, c: C.accent },
    { n: 'Grammarly for Chrome', s: 41, c: C.accent },
    { n: 'Dark Reader', s: 33, c: C.accent },
    { n: 'JSON Viewer', s: 18, c: C.accent },
  ];
  for (const card of cCards) {
    drawMockExtCard(ctx, cardX + 16, cby, cardW - 32, card.n, card.s, card.c, false);
    cby += 41;
  }

  save(c, 'promo-large-1400x560.jpg');
}

console.log('\nAll store assets generated.\n');
