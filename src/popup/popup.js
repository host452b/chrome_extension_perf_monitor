document.addEventListener('DOMContentLoaded', () => {
  loadData();
  document.getElementById('btn-open-panel').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
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

  const activeCount = Object.values(extensions).filter(e => e.enabled).length;
  const totalBytes = extEntries.reduce((sum, e) => sum + e.totalBytes, 0);
  const warningCount = extEntries.filter(e => e.score >= settings.alertThreshold).length;

  document.getElementById('kpi-active').textContent = activeCount;
  document.getElementById('kpi-traffic').textContent = formatBytes(totalBytes);
  document.getElementById('kpi-warnings').textContent = warningCount;

  const dot = document.getElementById('status-dot');
  dot.className = 'status-dot';
  if (warningCount > 3) dot.classList.add('status-red');
  else if (warningCount > 0) dot.classList.add('status-yellow');
  else dot.classList.add('status-green');

  const top5 = extEntries.slice(0, 5);
  const listEl = document.getElementById('top-list');

  if (top5.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Collecting data...</div>';
    return;
  }

  const maxScore = Math.max(...top5.map(e => e.score), 1);
  listEl.innerHTML = top5.map(entry => {
    const barWidth = Math.round((entry.score / maxScore) * 100);
    const color = getScoreColor(entry.score);
    const iconUrl = getIconUrl(entry.icons);
    return `
      <div class="top-item" data-ext-id="${entry.id}">
        <img class="top-item-icon" src="${iconUrl}" alt="" width="20" height="20">
        <span class="top-item-name">${escapeHtml(entry.name)}</span>
        <div class="top-item-bar-wrap">
          <div class="top-item-bar" style="width:${barWidth}%;background:${color}"></div>
        </div>
        <span class="top-item-score" style="color:${color}">${entry.score}</span>
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
    entries.push({ id: extId, name: ext.name, version: ext.version, enabled: ext.enabled, icons: ext.icons, totalRequests, totalBytes, score });
  }
  entries.sort((a, b) => b.score - a.score);
  return entries;
}

function getIconUrl(icons) {
  if (!icons || icons.length === 0) return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="%23334155" rx="4"/></svg>';
  const icon = icons.find(i => i.size >= 32) || icons[icons.length - 1];
  return icon.url;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
