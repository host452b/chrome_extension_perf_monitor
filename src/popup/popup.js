document.addEventListener('DOMContentLoaded', () => {
  // Apply i18n to static elements
  document.getElementById('header-title').textContent = t('appName');
  document.getElementById('lbl-active').textContent = 'CPU';
  document.getElementById('lbl-traffic').textContent = 'MEM';
  document.getElementById('lbl-warnings').textContent = t('kpiWarnings');
  document.getElementById('section-top').textContent = t('topImpact');
  document.getElementById('btn-panel-text').textContent = t('openPanel');

  loadData();
  document.getElementById('btn-open-panel').addEventListener('click', async () => {
    try {
      const win = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: win.id });
      window.close(); // close popup after opening panel
    } catch (e) {
      console.error('[PerfMon] Failed to open side panel:', e);
    }
  });
});

async function loadData() {
  chrome.runtime.sendMessage({ type: 'GET_LIVE_SNAPSHOT' }, (response) => {
    if (!response) return;
    render(response);
  });
}

function render({ activity, extensions, settings }) {
  const extEntries = buildExtensionEntries(activity, extensions, settings);

  let totalCpu = 0, totalMemory = 0;
  for (const e of extEntries) {
    totalCpu += e.cpu || 0;
    totalMemory += e.memory || 0;
  }
  const warningCount = extEntries.filter(e => e.score >= settings.alertThreshold).length;

  document.getElementById('kpi-active').textContent = totalCpu.toFixed(1) + '%';
  document.getElementById('kpi-traffic').textContent = formatBytes(totalMemory);
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
  // Column header row showing what the number means
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
    const memory = act?.memory || 0;
    entries.push({ id: extId, name: ext.name, version: ext.version, enabled: ext.enabled, icons: ext.icons, totalRequests, totalBytes, score, cpu, memory });
  }
  entries.sort((a, b) => b.score - a.score);
  return entries;
}

function getIconUrl(icons) {
  if (!icons || icons.length === 0) return '';
  const icon = icons.find(i => i.size >= 32) || icons[icons.length - 1];
  return icon.url || '';
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
