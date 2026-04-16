const SENSITIVE_PERMS = [
  '<all_urls>', 'tabs', 'webRequest', 'webRequestBlocking',
  'cookies', 'history', 'bookmarks', 'debugger',
  'clipboardRead', 'clipboardWrite', 'nativeMessaging',
];

let currentSort = 'score';
let currentSearch = '';

function renderDetailsList(entries, settings) {
  let filtered = entries;
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    filtered = entries.filter(e => e.name.toLowerCase().includes(q));
  }

  if (currentSort === 'traffic') filtered.sort((a, b) => (b.memory || 0) - (a.memory || 0));
  else filtered.sort((a, b) => b.score - a.score);

  const ignoreList = settings?.ignoreList || [];
  const listEl = document.getElementById('details-list');
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state">${escapeHtml(t('noExtensions'))}</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(entry => {
    const color = getScoreColor(entry.score);
    const bgColor = color + '15';
    const isIgnored = ignoreList.includes(entry.id);

    const allPerms = [...entry.permissions, ...entry.hostPermissions];
    const permsHtml = allPerms.length > 0
      ? allPerms.map(p => `<span class="perm-tag ${SENSITIVE_PERMS.includes(p) ? 'sensitive' : ''}">${escapeHtml(p)}</span>`).join('')
      : `<span style="color:var(--fg-dim);font-size:10px">${escapeHtml(t('detailNone'))}</span>`;

    const latestBucket = entry.buckets.length > 0 ? entry.buckets[entry.buckets.length - 1] : null;
    const domains = latestBucket?.topDomains || {};
    const topDomains = Object.entries(domains).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const domainsHtml = topDomains.length > 0
      ? `<ul class="domain-list">${topDomains.map(([d, c]) => `<li>${escapeHtml(d)} <span>${c}</span></li>`).join('')}</ul>`
      : `<span style="color:var(--fg-dim);font-size:10px">${escapeHtml(t('detailNone'))}</span>`;

    const scopeText = entry.contentScriptPatterns.length === 0 ? t('detailNone')
      : entry.contentScriptPatterns.some(p => p === '<all_urls>' || p.includes('*://*/*'))
        ? t('detailAllSites') : `${entry.contentScriptPatterns.length} ${t('detailPatterns')}`;

    const disabledAttr = entry.enabled ? '' : 'disabled style="opacity:0.35;cursor:default"';

    return `
      <div class="ext-card" data-ext-id="${entry.id}">
        <div class="ext-card-header" tabindex="0" role="button" aria-expanded="false" onclick="toggleCard(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleCard(this)}">
          <span class="ext-name">${escapeHtml(entry.name)}</span>
          <span class="ext-score-badge" style="color:${color};background:${bgColor}" title="${escapeAttr(t('scoreTooltip'))}">${entry.score}</span>
        </div>
        <div class="ext-card-body">
          <div class="ext-detail-row">
            <span class="ext-detail-label">CPU</span>
            <span class="ext-detail-value">${(entry.cpu || 0).toFixed(1)}%</span>
          </div>
          <div class="ext-detail-row">
            <span class="ext-detail-label">Memory</span>
            <span class="ext-detail-value">${formatBytes(entry.memory || 0)}</span>
          </div>
          <div class="ext-detail-row">
            <span class="ext-detail-label">JS Heap</span>
            <span class="ext-detail-value">${formatBytes(entry.jsMemory || 0)}</span>
          </div>
          <div class="ext-detail-row">
            <span class="ext-detail-label">${escapeHtml(t('detailRequests'))}</span>
            <span class="ext-detail-value">${formatNumber(entry.totalRequests)}</span>
          </div>
          <div class="ext-detail-row">
            <span class="ext-detail-label">${escapeHtml(t('detailTraffic'))}</span>
            <span class="ext-detail-value">${formatBytes(entry.totalBytes)}</span>
          </div>
          <div class="ext-detail-row">
            <span class="ext-detail-label">${escapeHtml(t('detailContentScripts'))}</span>
            <span class="ext-detail-value">${escapeHtml(scopeText)}</span>
          </div>
          <div style="margin-top:6px">
            <div class="section-title">${escapeHtml(t('sectionPermissions'))}</div>
            <div>${permsHtml}</div>
          </div>
          <div style="margin-top:6px">
            <div class="section-title">${escapeHtml(t('sectionTopDomains'))}</div>
            ${domainsHtml}
          </div>
          <div class="ext-actions">
            <button class="btn-disable" ${disabledAttr} onclick="handleDisable(event, '${entry.id}')">
              ${entry.enabled ? escapeHtml(t('btnDisable')) : escapeHtml(t('btnDisabled'))}
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function toggleCard(headerEl) {
  const card = headerEl.closest('.ext-card');
  const isExpanded = card.classList.toggle('expanded');
  headerEl.setAttribute('aria-expanded', isExpanded);
}

function handleDisable(event, extId) {
  event.stopPropagation();
  const btn = event.target;

  if (btn.classList.contains('confirming')) {
    chrome.management.setEnabled(extId, false, () => {
      btn.textContent = t('btnDisabled');
      btn.disabled = true;
      btn.style.opacity = '0.35';
      btn.classList.remove('confirming');
    });
    return;
  }

  btn.classList.add('confirming');
  btn.textContent = t('btnConfirm');
  setTimeout(() => {
    if (btn.classList.contains('confirming')) {
      btn.classList.remove('confirming');
      btn.textContent = t('btnDisable');
    }
  }, 3000);
}
