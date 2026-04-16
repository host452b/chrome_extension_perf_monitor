function renderOverviewSection(data) {
  const entries = buildSortedEntries(data.extensions);
  const activeCount = entries.filter(e => e.enabled).length;
  const highRisk = entries.filter(e => e.score >= 70).length;
  const medRisk = entries.filter(e => e.score >= 50 && e.score < 70).length;
  const warningCount = entries.filter(e => e.score >= data.settings.alertThreshold).length;

  return `
    <div class="kpi-row">
      ${renderKpiCard('kpi-active', activeCount, t('kpiActive'), null)}
      ${renderKpiCard('kpi-high', highRisk, t('kpiHighRisk'), null)}
      ${renderKpiCard('kpi-med', medRisk, t('kpiMedRisk'), null)}
      ${renderKpiCard('kpi-warnings', warningCount, t('kpiWarnings'), null)}
    </div>

    <div class="section-title">${escapeHtml(t('consumptionByExt'))}</div>
    <div id="consumption-bars"></div>
  `;
}

function renderKpiCard(id, value, label) {
  return `
    <div class="kpi-card">
      <span id="${id}" class="kpi-value">${value}</span>
      <span class="kpi-label">${escapeHtml(label)}</span>
    </div>`;
}

function renderConsumptionBars(entries) {
  const container = document.getElementById('consumption-bars');
  if (!container) return;

  if (entries.length === 0) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(t('noExtensions'))}</div>`;
    return;
  }

  const sorted = entries.slice().sort((a, b) => b.score - a.score);
  const maxScore = Math.max(...sorted.map(e => e.score), 1);

  container.innerHTML = sorted.slice(0, 15).map(entry => {
    const pct = (entry.score / maxScore) * 100;
    const color = getScoreColor(entry.score);
    return `
      <div class="bar-item">
        <span class="bar-label">${escapeHtml(entry.name)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div>
        </div>
        <span class="bar-value">${entry.score}</span>
      </div>`;
  }).join('');
}

// --- Shared helpers ---

function buildSortedEntries(extensions) {
  const ignoreList = currentData?.settings?.ignoreList || [];
  const entries = [];
  for (const [extId, ext] of Object.entries(extensions)) {
    if (ignoreList.includes(extId)) continue;
    entries.push({ id: extId, ...ext });
  }
  entries.sort((a, b) => b.score - a.score);
  return entries;
}

function escapeHtml(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
