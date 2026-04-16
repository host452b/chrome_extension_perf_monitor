let currentData = null;
let refreshTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('panel-title').textContent = t('appName');

  document.getElementById('btn-settings-toggle').addEventListener('click', () => {
    const drawer = document.getElementById('settings-drawer');
    drawer.classList.toggle('hidden');
    if (!drawer.classList.contains('hidden') && currentData) {
      renderSettings(currentData.settings);
    }
  });

  loadData();
  startPolling();
});

function loadData() {
  chrome.runtime.sendMessage({ type: 'GET_LIVE_SNAPSHOT' }, (response) => {
    if (!response) return;
    currentData = response;
    updateStatusDot(response);
    renderAll();
  });
}

function startPolling() {
  if (refreshTimer) clearInterval(refreshTimer);
  const interval = currentData?.settings?.refreshInterval || 30;
  refreshTimer = setInterval(loadData, interval * 1000);
}

function renderAll() {
  if (!currentData) return;
  const container = document.getElementById('panel-content');
  const entries = buildSortedEntries(currentData.activity, currentData.extensions);

  // Flat layout: KPIs → CPU chart → Resource bars → Extension list
  container.innerHTML = `
    <div class="native-status ${currentData.nativeConnected ? 'connected' : ''}">${escapeHtml(currentData.nativeConnected ? t('nativeConnected') : t('nativeNotConnected'))}</div>
    ${renderOverviewSection(currentData)}

    <div class="section-divider"></div>

    <div class="toolbar">
      <input id="search-ext" class="search-input" type="text" placeholder="${escapeAttr(t('searchPlaceholder'))}" value="${escapeAttr(currentSearch)}">
      <button class="sort-btn ${currentSort === 'score' ? 'active' : ''}" data-sort="score">${escapeHtml(t('sortScore'))}</button>
      <button class="sort-btn ${currentSort === 'traffic' ? 'active' : ''}" data-sort="traffic">MEM</button>
    </div>
    <div id="details-list"></div>
  `;

  renderActivityChart(currentData.activity);
  renderConsumptionBars(entries);

  // Wire search + sort
  document.getElementById('search-ext').addEventListener('input', (e) => {
    currentSearch = e.target.value;
    renderDetailsList(entries, currentData.settings);
  });

  container.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSort = btn.dataset.sort;
      container.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDetailsList(entries, currentData.settings);
    });
  });

  renderDetailsList(entries, currentData.settings);
}

function updateStatusDot(data) {
  const threshold = data.settings.alertThreshold;
  const warningCount = Object.values(data.activity).filter(a => (a.score || 0) >= threshold).length;
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
}

function onSettingsChanged(newSettings) {
  currentData.settings = newSettings;
  chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings: newSettings });
  startPolling();
}
