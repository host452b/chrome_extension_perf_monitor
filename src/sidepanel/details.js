const SENSITIVE_PERMS = [
  '<all_urls>', 'tabs', 'webRequest', 'webRequestBlocking',
  'cookies', 'history', 'bookmarks', 'debugger',
  'clipboardRead', 'clipboardWrite', 'nativeMessaging',
];

let currentSort = 'score';
let currentSearch = '';

function renderDetails(data) {
  const container = document.getElementById('tab-details');
  let entries = buildSortedEntries(data.activity, data.extensions);

  container.innerHTML = `
    <div class="toolbar">
      <input id="search-ext" class="search-input" type="text" placeholder="${escapeAttr(t('searchPlaceholder'))}" value="${escapeAttr(currentSearch)}">
      <button class="sort-btn ${currentSort === 'score' ? 'active' : ''}" data-sort="score">${escapeHtml(t('sortScore'))}</button>
      <button class="sort-btn ${currentSort === 'traffic' ? 'active' : ''}" data-sort="traffic">${escapeHtml(t('sortTraffic'))}</button>
      <button class="sort-btn ${currentSort === 'requests' ? 'active' : ''}" data-sort="requests">${escapeHtml(t('sortRequests'))}</button>
    </div>
    <div id="details-list"></div>
  `;

  document.getElementById('search-ext').addEventListener('input', (e) => {
    currentSearch = e.target.value;
    renderDetailsList(entries, data.settings);
  });

  container.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSort = btn.dataset.sort;
      container.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDetailsList(entries, data.settings);
    });
  });

  renderDetailsList(entries, data.settings);
}

function renderDetailsList(entries, settings) {
  let filtered = entries;
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    filtered = entries.filter(e => e.name.toLowerCase().includes(q));
  }

  if (currentSort === 'traffic') filtered.sort((a, b) => b.totalBytes - a.totalBytes);
  else if (currentSort === 'requests') filtered.sort((a, b) => b.totalRequests - a.totalRequests);
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
      : `<span style="color:var(--fg-muted);font-size:12px">${escapeHtml(t('detailNone'))}</span>`;

    const latestBucket = entry.buckets.length > 0 ? entry.buckets[entry.buckets.length - 1] : null;
    const domains = latestBucket?.topDomains || {};
    const topDomains = Object.entries(domains).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const domainsHtml = topDomains.length > 0
      ? `<ul class="domain-list">${topDomains.map(([d, c]) => `<li>${escapeHtml(d)} <span>${c}</span></li>`).join('')}</ul>`
      : `<span style="color:var(--fg-muted);font-size:12px">${escapeHtml(t('detailNone'))}</span>`;

    const scopeText = entry.contentScriptPatterns.length === 0 ? t('detailNone')
      : entry.contentScriptPatterns.some(p => p === '<all_urls>' || p.includes('*://*/*'))
        ? t('detailAllSites') : `${entry.contentScriptPatterns.length} ${t('detailPatterns')}`;

    const disabledAttr = entry.enabled ? '' : 'disabled style="opacity:0.4;cursor:default"';

    return `
      <div class="ext-card" data-ext-id="${entry.id}">
        <div class="ext-card-header" tabindex="0" role="button" aria-expanded="false" onclick="toggleCard(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleCard(this)}">
          <span class="ext-name">${escapeHtml(entry.name)}</span>
          <span class="ext-version">${escapeHtml(entry.version)}</span>
          <span class="ext-score-badge" style="color:${color};background:${bgColor}" title="${escapeAttr(t('scoreTooltip'))}">${entry.score}</span>
        </div>
        <div class="ext-card-body">
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
          <div style="margin-top:8px">
            <div class="section-title">${escapeHtml(t('sectionPermissions'))}</div>
            <div>${permsHtml}</div>
          </div>
          <div style="margin-top:8px">
            <div class="section-title">${escapeHtml(t('sectionTopDomains'))}</div>
            ${domainsHtml}
          </div>
          <button class="btn-disable" ${disabledAttr} onclick="handleDisable(event, '${entry.id}')">
            ${entry.enabled ? escapeHtml(t('btnDisable')) : escapeHtml(t('btnDisabled'))}
          </button>
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
      btn.style.opacity = '0.4';
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
