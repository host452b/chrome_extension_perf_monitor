let areaChart = null;

function renderOverview(data) {
  const container = document.getElementById('tab-overview');
  const entries = buildSortedEntries(data.activity, data.extensions);

  container.innerHTML = `
    <div class="kpi-row">
      ${renderKpiCard('kpi-ov-active', countActiveExtensions(data.extensions), t('kpiActive'), null)}
      ${renderKpiCard('kpi-ov-requests', sumField(entries, 'totalRequests'), t('kpiRequests'), 'number')}
      ${renderKpiCard('kpi-ov-traffic', sumField(entries, 'totalBytes'), t('kpiTraffic'), 'bytes')}
      ${renderKpiCard('kpi-ov-warnings', countWarnings(entries, data.settings.alertThreshold), t('kpiWarnings'), null)}
    </div>

    <div class="section-title">${escapeHtml(t('networkActivity'))}</div>
    <div class="chart-container">
      <canvas id="area-chart" height="150"></canvas>
    </div>

    <div class="section-title">${escapeHtml(t('consumptionByExt'))}</div>
    <div id="consumption-bars"></div>
  `;

  renderAreaChart(data.activity);
  renderConsumptionBars(entries);
}

function renderKpiCard(id, value, label, format) {
  let display = value;
  if (format === 'bytes') display = formatBytes(value);
  else if (format === 'number') display = formatNumber(value);
  return `
    <div class="kpi-card">
      <span id="${id}" class="kpi-value">${display}</span>
      <span class="kpi-label">${escapeHtml(label)}</span>
    </div>`;
}

function renderAreaChart(activity) {
  const canvas = document.getElementById('area-chart');
  if (!canvas) return;

  const now = Date.now();
  const thirtyMinAgo = now - 30 * 60 * 1000;
  const labels = [];
  const dataPoints = [];

  for (let i = 0; i < 30; i++) {
    const slotStart = thirtyMinAgo + i * 60 * 1000;
    labels.push(new Date(slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    let total = 0;
    for (const act of Object.values(activity)) {
      for (const bucket of act.buckets || []) {
        const bucketEnd = bucket.timestamp + 15 * 60 * 1000;
        if (bucket.timestamp <= slotStart + 60000 && bucketEnd > slotStart) {
          total += bucket.requests / 15;
        }
      }
    }
    dataPoints.push(Math.round(total));
  }

  if (areaChart) areaChart.destroy();

  areaChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: dataPoints,
        borderColor: '#3B82F6',
        backgroundColor: '#3B82F610',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 1.5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1E293B',
          borderColor: '#334155',
          borderWidth: 1,
          titleColor: '#F8FAFC',
          bodyColor: '#94A3B8',
          callbacks: { label: (ctx) => `${ctx.raw} req/min` },
        },
      },
      scales: {
        x: {
          ticks: { color: '#475569', font: { size: 10 }, maxRotation: 0, maxTicksLimit: 6 },
          grid: { color: '#1E293B40' },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#475569', font: { size: 10 } },
          grid: { color: '#1E293B40' },
          border: { display: false },
        },
      },
      animation: { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300 },
    },
  });
}

function renderConsumptionBars(entries) {
  const container = document.getElementById('consumption-bars');
  if (!container) return;

  const totalBytes = entries.reduce((s, e) => s + e.totalBytes, 0);
  if (totalBytes === 0) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(t('noTraffic'))}</div>`;
    return;
  }

  container.innerHTML = entries.slice(0, 10).map(entry => {
    const pct = totalBytes > 0 ? (entry.totalBytes / totalBytes * 100) : 0;
    const color = getScoreColor(entry.score);
    return `
      <div class="bar-item">
        <span class="bar-label">${escapeHtml(entry.name)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div>
        </div>
        <span class="bar-value">${pct.toFixed(1)}%</span>
      </div>`;
  }).join('');
}

function buildSortedEntries(activity, extensions) {
  const ignoreList = currentData?.settings?.ignoreList || [];
  const entries = [];
  for (const [extId, ext] of Object.entries(extensions)) {
    if (ignoreList.includes(extId)) continue;
    const act = activity[extId];
    const totalRequests = act ? act.buckets.reduce((s, b) => s + b.requests, 0) : 0;
    const totalBytes = act ? act.buckets.reduce((s, b) => s + b.bytesTransferred, 0) : 0;
    entries.push({
      id: extId, name: ext.name, version: ext.version, enabled: ext.enabled,
      permissions: ext.permissions || [], hostPermissions: ext.hostPermissions || [],
      contentScriptPatterns: ext.contentScriptPatterns || [],
      totalRequests, totalBytes, score: act?.score || 0, buckets: act?.buckets || [],
    });
  }
  entries.sort((a, b) => b.score - a.score);
  return entries;
}

function countActiveExtensions(extensions) {
  return Object.values(extensions).filter(e => e.enabled).length;
}

function sumField(entries, field) {
  return entries.reduce((s, e) => s + e[field], 0);
}

function countWarnings(entries, threshold) {
  return entries.filter(e => e.score >= threshold).length;
}

function escapeHtml(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
