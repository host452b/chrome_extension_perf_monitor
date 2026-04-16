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

  if (currentSort === 'perms') filtered.sort((a, b) => b.sensitiveCount - a.sensitiveCount);
  else filtered.sort((a, b) => b.score - a.score);

  const listEl = document.getElementById('details-list');
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state">${escapeHtml(t('noExtensions'))}</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(entry => {
    const color = getScoreColor(entry.score);
    const bgColor = color + '15';

    const allPerms = [...entry.permissions, ...entry.hostPermissions];
    const permsHtml = allPerms.length > 0
      ? allPerms.map(p => `<span class="perm-tag ${SENSITIVE_PERMS.includes(p) ? 'sensitive' : ''}">${escapeHtml(p)}</span>`).join('')
      : `<span style="color:var(--fg-dim);font-size:10px">${escapeHtml(t('detailNone'))}</span>`;

    const scopeText = entry.contentScriptPatterns.length === 0
      ? t('detailNone')
      : entry.scopeLabel === 'all_sites'
        ? t('detailAllSites')
        : `${entry.contentScriptPatterns.length} ${t('detailPatterns')}`;

    const disabledAttr = entry.enabled ? '' : 'disabled style="opacity:0.35;cursor:default"';

    return `
      <div class="ext-card" data-ext-id="${entry.id}">
        <div class="ext-card-header" tabindex="0" role="button" aria-expanded="false" onclick="toggleCard(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleCard(this)}">
          <span class="ext-name">${escapeHtml(entry.name)}</span>
          <span class="ext-score-badge" style="color:${color};background:${bgColor}" title="${escapeAttr(t('scoreTooltip'))}">${entry.score}</span>
        </div>
        <div class="ext-card-body">
          <div class="ext-detail-row">
            <span class="ext-detail-label">${escapeHtml(t('detailSensitivePerms'))}</span>
            <span class="ext-detail-value">${entry.sensitiveCount}</span>
          </div>
          <div class="ext-detail-row">
            <span class="ext-detail-label">${escapeHtml(t('detailContentScripts'))}</span>
            <span class="ext-detail-value">${escapeHtml(scopeText)}</span>
          </div>
          <div class="ext-detail-row">
            <span class="ext-detail-label">Version</span>
            <span class="ext-detail-value">${escapeHtml(entry.version)}</span>
          </div>
          <div style="margin-top:6px">
            <div class="section-title">${escapeHtml(t('sectionPermissions'))}</div>
            <div>${permsHtml}</div>
          </div>
          ${entry.contentScriptPatterns.length > 0 ? `
          <div style="margin-top:6px">
            <div class="section-title">${escapeHtml(t('detailContentScripts'))}</div>
            <div>${entry.contentScriptPatterns.slice(0, 5).map(p => `<span class="perm-tag">${escapeHtml(p)}</span>`).join('')}${entry.contentScriptPatterns.length > 5 ? `<span class="perm-tag">+${entry.contentScriptPatterns.length - 5}</span>` : ''}</div>
          </div>` : ''}
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
