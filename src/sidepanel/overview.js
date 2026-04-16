let cpuChart = null;

function renderKpiCard(id, value, label, format) {
  let display = value;
  if (format === 'bytes') display = formatBytes(value);
  else if (format === 'number') display = formatNumber(value);
  else if (format === 'cpu') display = value.toFixed(1) + '%';
  return `
    <div class="kpi-card">
      <span id="${id}" class="kpi-value">${display}</span>
      <span class="kpi-label">${escapeHtml(label)}</span>
    </div>`;
}

function renderOverviewSection(data) {
  const entries = buildSortedEntries(data.activity, data.extensions);

  // Aggregate CPU and memory across all extensions
  let totalCpu = 0, totalMemory = 0;
  for (const entry of entries) {
    totalCpu += entry.cpu || 0;
    totalMemory += entry.memory || 0;
  }

  const warningCount = countWarnings(entries, data.settings.alertThreshold);

  return `
    <div class="kpi-row">
      ${renderKpiCard('kpi-cpu', totalCpu, 'CPU', 'cpu')}
      ${renderKpiCard('kpi-mem', totalMemory, t('kpiTraffic').replace('Traffic', 'Memory') === t('kpiTraffic') ? 'MEM' : 'MEM', 'bytes')}
      ${renderKpiCard('kpi-active', countActiveExtensions(data.extensions), t('kpiActive'), null)}
      ${renderKpiCard('kpi-warnings', warningCount, t('kpiWarnings'), null)}
    </div>

    <div class="section-title">CPU ${escapeHtml(t('networkActivity').includes('30') ? '(30 min)' : '(30 min)')}</div>
    <div class="chart-container">
      <canvas id="cpu-chart" height="120"></canvas>
    </div>

    <div class="section-title">${escapeHtml(t('consumptionByExt'))}</div>
    <div id="consumption-bars"></div>
  `;
}

function renderCpuChart(processHistory) {
  const canvas = document.getElementById('cpu-chart');
  if (!canvas) return;

  // Aggregate CPU history across all extensions
  const allTimestamps = new Set();
  for (const history of Object.values(processHistory)) {
    for (const point of history) {
      allTimestamps.add(point.ts);
    }
  }

  const sorted = [...allTimestamps].sort();
  const labels = sorted.map(ts =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  // Total CPU at each timestamp
  const dataPoints = sorted.map(ts => {
    let total = 0;
    for (const history of Object.values(processHistory)) {
      const point = history.find(p => p.ts === ts);
      if (point) total += point.cpu;
    }
    return Math.round(total * 10) / 10;
  });

  if (cpuChart) cpuChart.destroy();

  // Fill with zeros if no data
  if (labels.length === 0) {
    labels.push('--');
    dataPoints.push(0);
  }

  cpuChart = new Chart(canvas, {
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
          callbacks: { label: (ctx) => `${ctx.raw}% CPU` },
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
          ticks: { color: '#475569', font: { size: 10 }, callback: v => v + '%' },
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

  // Sort by memory (primary resource metric)
  const sorted = entries.slice().sort((a, b) => (b.memory || 0) - (a.memory || 0));
  const hasProcessData = sorted.some(e => e.memory > 0);

  if (!hasProcessData) {
    // Fallback to network traffic if no process data
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
    return;
  }

  // Show memory bars
  const maxMem = Math.max(...sorted.map(e => e.memory || 0), 1);
  container.innerHTML = sorted.slice(0, 10).map(entry => {
    const mem = entry.memory || 0;
    const pct = (mem / maxMem) * 100;
    const color = getScoreColor(entry.score);
    const cpu = entry.cpu || 0;
    return `
      <div class="bar-item">
        <span class="bar-label">${escapeHtml(entry.name)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div>
        </div>
        <span class="bar-value" title="CPU: ${cpu.toFixed(1)}%">${formatBytes(mem)}</span>
      </div>`;
  }).join('');
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
      cpu: act?.cpu || 0,
      memory: act?.memory || 0,
      jsMemory: act?.jsMemory || 0,
      buckets: act?.buckets || [],
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
