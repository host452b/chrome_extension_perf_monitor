let activityChart = null;

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

function renderOverviewSection(data) {
  const entries = buildSortedEntries(data.activity, data.extensions);
  const warningCount = countWarnings(entries, data.settings.alertThreshold);
  const prefix = data.nativeConnected ? '' : '~';

  let totalMem = 0, totalCpu = 0;
  for (const e of entries) { totalMem += e.rss || 0; totalCpu += e.cpu || 0; }

  const kpiHtml = `
    ${renderKpiCard('kpi-mem', prefix + formatBytes(totalMem), t('kpiMemory'), null)}
    ${renderKpiCard('kpi-cpu', prefix + Math.round(totalCpu), 'CPU', null)}
    ${renderKpiCard('kpi-active', countActiveExtensions(data.extensions), t('kpiActive'), null)}
    ${renderKpiCard('kpi-warnings', warningCount, t('kpiWarnings'), null)}
  `;

  return `
    <div class="kpi-row">${kpiHtml}</div>
    <div class="section-title">${escapeHtml(t('networkActivity'))}</div>
    <div class="chart-container">
      <canvas id="activity-chart" height="120"></canvas>
    </div>
    <div class="section-title">${escapeHtml(t('consumptionByExt'))}</div>
    <div id="consumption-bars"></div>
  `;
}

function renderActivityChart(activity) {
  const canvas = document.getElementById('activity-chart');
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

  if (activityChart) activityChart.destroy();

  activityChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: dataPoints,
        borderColor: '#60A5FA',
        backgroundColor: '#60A5FA08',
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
          backgroundColor: '#151e2e',
          borderColor: '#1e293b',
          borderWidth: 1,
          titleColor: '#E2E8F0',
          bodyColor: '#64748B',
          callbacks: { label: (ctx) => `${ctx.raw} req/min` },
        },
      },
      scales: {
        x: {
          ticks: { color: '#475569', font: { size: 10 }, maxRotation: 0, maxTicksLimit: 6 },
          grid: { color: '#1e293b40' },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#475569', font: { size: 10 } },
          grid: { color: '#1e293b40' },
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

  const hasProcessData = entries.some(e => (e.rss || 0) > 0);

  if (hasProcessData) {
    const sorted = entries.slice().sort((a, b) => (b.rss || 0) - (a.rss || 0));
    const maxRss = Math.max(...sorted.map(e => e.rss || 0), 1);
    container.innerHTML = sorted.slice(0, 10).map(entry => {
      const pct = ((entry.rss || 0) / maxRss) * 100;
      const color = getScoreColor(entry.score);
      return `
        <div class="bar-item">
          <span class="bar-label">${escapeHtml(entry.name)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div>
          </div>
          <span class="bar-value" title="CPU: ${(entry.cpu || 0).toFixed(1)}%">${formatBytes(entry.rss || 0)}</span>
        </div>`;
    }).join('');
    return;
  }

  // No data at all
  container.innerHTML = `<div class="empty-state">${escapeHtml(t('noTraffic'))}</div>`;
}

// --- Shared helpers ---

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
      totalRequests, totalBytes,
      score: act?.score || 0,
      buckets: act?.buckets || [],
      cpu: act?.cpu || 0,
      rss: act?.rss || 0,
      measured: act?.measured || false,
      matchingTabs: act?.matchingTabs || 0,
      reqPerMin: act?.reqPerMin || 0,
      isPolling: act?.isPolling || false,
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
