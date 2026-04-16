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
      <input id="search-ext" class="search-input" type="text" placeholder="Search extensions..." value="${escapeHtml(currentSearch)}">
      <button class="sort-btn ${currentSort === 'score' ? 'active' : ''}" data-sort="score">Score</button>
      <button class="sort-btn ${currentSort === 'traffic' ? 'active' : ''}" data-sort="traffic">Traffic</button>
      <button class="sort-btn ${currentSort === 'requests' ? 'active' : ''}" data-sort="requests">Requests</button>
    </div>
    <div id="details-list"></div>
  `;

  const searchInput = document.getElementById('search-ext');
  searchInput.addEventListener('input', (e) => {
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
    listEl.innerHTML = '<div class="empty-state">No extensions found</div>';
    return;
  }

  listEl.innerHTML = filtered.map(entry => {
    const color = getScoreColor(entry.score);
    const bgColor = color + '20';
    const iconUrl = getIconUrl(entry.icons);

    const allPerms = [...entry.permissions, ...entry.hostPermissions];
    const permsHtml = allPerms.length > 0
      ? allPerms.map(p => `<span class="perm-tag ${SENSITIVE_PERMS.includes(p) ? 'sensitive' : ''}">${escapeHtml(p)}</span>`).join('')
      : '<span style="color:var(--fg-muted);font-size:12px">None</span>';

    const latestBucket = entry.buckets.length > 0 ? entry.buckets[entry.buckets.length - 1] : null;
    const domains = latestBucket?.topDomains || {};
    const topDomains = Object.entries(domains).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const domainsHtml = topDomains.length > 0
      ? `<ul class="domain-list">${topDomains.map(([d, c]) => `<li>${escapeHtml(d)} <span>${c}</span></li>`).join('')}</ul>`
      : '<span style="color:var(--fg-muted);font-size:12px">None</span>';

    const scopeText = entry.contentScriptPatterns.length === 0 ? 'None'
      : entry.contentScriptPatterns.some(p => p === '<all_urls>' || p.includes('*://*/*'))
        ? 'All sites' : `${entry.contentScriptPatterns.length} pattern(s)`;

    const disabledAttr = entry.enabled ? '' : 'disabled style="opacity:0.5;cursor:default"';

    return `
      <div class="ext-card" data-ext-id="${entry.id}">
        <div class="ext-card-header" onclick="toggleCard(this)">
          <img class="ext-icon" src="${iconUrl}" alt="" width="24" height="24">
          <span class="ext-name">${escapeHtml(entry.name)}</span>
          <span class="ext-version">${escapeHtml(entry.version)}</span>
          <span class="ext-score-badge" style="color:${color};background:${bgColor}">${entry.score}</span>
        </div>
        <div class="ext-card-body">
          <div class="ext-detail-row">
            <span class="ext-detail-label">Requests</span>
            <span class="ext-detail-value">${formatNumber(entry.totalRequests)}</span>
          </div>
          <div class="ext-detail-row">
            <span class="ext-detail-label">Traffic</span>
            <span class="ext-detail-value">${formatBytes(entry.totalBytes)}</span>
          </div>
          <div class="ext-detail-row">
            <span class="ext-detail-label">Content Scripts</span>
            <span class="ext-detail-value">${scopeText}</span>
          </div>
          <div style="margin-top:8px">
            <div class="section-title">Permissions</div>
            <div>${permsHtml}</div>
          </div>
          <div style="margin-top:8px">
            <div class="section-title">Top Domains</div>
            ${domainsHtml}
          </div>
          <button class="btn-disable" ${disabledAttr} onclick="handleDisable(event, '${entry.id}')">
            ${entry.enabled ? 'Disable Extension' : 'Already Disabled'}
          </button>
        </div>
      </div>`;
  }).join('');
}

function toggleCard(headerEl) {
  headerEl.closest('.ext-card').classList.toggle('expanded');
}

function handleDisable(event, extId) {
  event.stopPropagation();
  const btn = event.target;

  if (btn.classList.contains('confirming')) {
    chrome.management.setEnabled(extId, false, () => {
      btn.textContent = 'Already Disabled';
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.classList.remove('confirming');
    });
    return;
  }

  btn.classList.add('confirming');
  btn.textContent = 'Click again to confirm';
  setTimeout(() => {
    if (btn.classList.contains('confirming')) {
      btn.classList.remove('confirming');
      btn.textContent = 'Disable Extension';
    }
  }, 3000);
}
