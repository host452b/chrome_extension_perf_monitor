let currentData = null;

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
});

function loadData() {
  chrome.runtime.sendMessage({ type: 'GET_DATA' }, (response) => {
    if (!response) return;
    currentData = response;
    renderAll();
  });
}

function renderAll() {
  if (!currentData) return;
  const container = document.getElementById('panel-content');
  const entries = buildSortedEntries(currentData.extensions);

  container.innerHTML = `
    ${renderOverviewSection(currentData)}

    <div class="section-divider"></div>

    <div class="toolbar">
      <input id="search-ext" class="search-input" type="text" placeholder="${escapeAttr(t('searchPlaceholder'))}" value="${escapeAttr(currentSearch)}">
      <button class="sort-btn ${currentSort === 'score' ? 'active' : ''}" data-sort="score">${escapeHtml(t('sortScore'))}</button>
      <button class="sort-btn ${currentSort === 'perms' ? 'active' : ''}" data-sort="perms">${escapeHtml(t('sortPerms'))}</button>
    </div>
    <div id="details-list"></div>

    <div class="section-divider"></div>

    <div class="about-section">
      <div class="section-title">${escapeHtml(t('aboutTitle'))}</div>
      <div class="about-text">${t('aboutBody')}</div>
    </div>
  `;

  renderConsumptionBars(entries);

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

function onSettingsChanged(newSettings) {
  currentData.settings = newSettings;
  chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings: newSettings });
  renderAll();
}
