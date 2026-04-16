document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('header-title').textContent = t('appName');
  document.getElementById('lbl-active').textContent = t('kpiActive');
  document.getElementById('lbl-traffic').textContent = t('kpiHighRisk');
  document.getElementById('lbl-warnings').textContent = t('kpiWarnings');
  document.getElementById('section-top').textContent = t('topImpact');
  document.getElementById('btn-panel-text').textContent = t('openPanel');

  loadData();
  setInterval(loadData, 1000);
  document.getElementById('btn-open-panel').addEventListener('click', async () => {
    try {
      const win = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: win.id });
      window.close();
    } catch (e) {
      console.error('[PerfMon] Failed to open side panel:', e);
    }
  });
});

function loadData() {
  chrome.runtime.sendMessage({ type: 'GET_DATA' }, (response) => {
    if (!response) return;
    render(response);
  });
}

function render({ extensions, settings }) {
  const entries = buildEntries(extensions, settings);
  const activeCount = entries.filter(e => e.enabled).length;
  const highRisk = entries.filter(e => e.score >= 70).length;
  const warningCount = entries.filter(e => e.score >= settings.alertThreshold).length;

  document.getElementById('kpi-active').textContent = activeCount;
  document.getElementById('kpi-traffic').textContent = highRisk;
  document.getElementById('kpi-warnings').textContent = warningCount;

  const dot = document.getElementById('status-dot');
  dot.className = 'status-dot';
  if (warningCount > 3) {
    dot.classList.add('status-red');
    dot.setAttribute('aria-label', t('statusCritical'));
  } else if (warningCount > 0) {
    dot.classList.add('status-yellow');
    dot.setAttribute('aria-label', t('statusWarning'));
  } else {
    dot.classList.add('status-green');
    dot.setAttribute('aria-label', t('statusHealthy'));
  }

  const top5 = entries.slice(0, 5);
  const listEl = document.getElementById('top-list');

  if (top5.length === 0) {
    listEl.innerHTML = `<div class="empty-state">${escapeHtml(t('collecting'))}</div>`;
    return;
  }

  const maxScore = Math.max(...top5.map(e => e.score), 1);
  const headerRow = `<div class="top-item-header"><span></span><span class="top-item-header-label">${escapeHtml(t('scoreLabel'))}</span></div>`;
  listEl.innerHTML = headerRow + top5.map(entry => {
    const barWidth = Math.round((entry.score / maxScore) * 100);
    const color = getScoreColor(entry.score);
    return `
      <div class="top-item">
        <span class="top-item-name">${escapeHtml(entry.name)}</span>
        <div class="top-item-bar-wrap">
          <div class="top-item-bar" style="width:${barWidth}%;background:${color}"></div>
        </div>
        <span class="top-item-score" style="color:${color}" title="${escapeAttr(t('scoreTooltip'))}">${entry.score}</span>
      </div>`;
  }).join('');
}

function buildEntries(extensions, settings) {
  const ignoreList = settings?.ignoreList || [];
  const entries = [];
  for (const [extId, ext] of Object.entries(extensions)) {
    if (ignoreList.includes(extId)) continue;
    entries.push({ id: extId, ...ext });
  }
  entries.sort((a, b) => b.score - a.score);
  return entries;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
