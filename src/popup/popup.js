document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('header-title').textContent = t('appName');
  document.getElementById('lbl-active').textContent = t('kpiActive');
  document.getElementById('lbl-traffic').textContent = t('kpiRequests');
  document.getElementById('lbl-warnings').textContent = t('kpiWarnings');
  document.getElementById('section-top').textContent = t('topImpact');
  document.getElementById('btn-panel-text').textContent = t('openPanel');

  loadData();
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
  chrome.runtime.sendMessage({ type: 'GET_LIVE_SNAPSHOT' }, (response) => {
    if (!response) return;
    render(response);
  });
}

function render({ activity, extensions, settings, nativeConnected }) {
  const extEntries = buildExtensionEntries(activity, extensions, settings);
  const warningCount = extEntries.filter(e => e.score >= settings.alertThreshold).length;

  // Always show estimated/real memory — the estimator always provides data
  let totalMem = 0;
  for (const e of extEntries) { totalMem += e.rss || 0; }
  const activeCount = Object.values(extensions).filter(e => e.enabled).length;
  const prefix = nativeConnected ? '' : '~';
  document.getElementById('kpi-active').textContent = activeCount;
  document.getElementById('kpi-traffic').textContent = prefix + formatBytes(totalMem);
  document.getElementById('lbl-active').textContent = t('kpiActive');
  document.getElementById('lbl-traffic').textContent = t('kpiMemory');
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

  const top5 = extEntries.slice(0, 5);
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
      <div class="top-item" data-ext-id="${entry.id}">
        <span class="top-item-name">${escapeHtml(entry.name)}</span>
        <div class="top-item-bar-wrap">
          <div class="top-item-bar" style="width:${barWidth}%;background:${color}"></div>
        </div>
        <span class="top-item-score" style="color:${color}" title="${escapeAttr(t('scoreTooltip'))}">${entry.score}</span>
      </div>`;
  }).join('');
}

function buildExtensionEntries(activity, extensions, settings) {
  const ignoreList = settings?.ignoreList || [];
  const entries = [];
  for (const [extId, ext] of Object.entries(extensions)) {
    if (ignoreList.includes(extId)) continue;
    const act = activity[extId];
    const totalRequests = act ? act.buckets.reduce((s, b) => s + b.requests, 0) : 0;
    const totalBytes = act ? act.buckets.reduce((s, b) => s + b.bytesTransferred, 0) : 0;
    const score = act?.score || 0;
    const cpu = act?.cpu || 0;
    const rss = act?.rss || 0;
    entries.push({ id: extId, name: ext.name, version: ext.version, enabled: ext.enabled, totalRequests, totalBytes, score, cpu, rss });
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
