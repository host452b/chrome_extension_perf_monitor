let currentData = null;
let refreshTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  // i18n static elements
  document.getElementById('panel-title').textContent = t('appName');
  document.getElementById('tab-btn-overview').textContent = t('tabOverview');
  document.getElementById('tab-btn-details').textContent = t('tabDetails');
  document.getElementById('tab-btn-settings').textContent = t('tabSettings');

  setupTabs();
  loadData();
  startPolling();
});

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
      if (currentData) renderActiveTab();
    });
  });
}

function loadData() {
  chrome.runtime.sendMessage({ type: 'GET_LIVE_SNAPSHOT' }, (response) => {
    if (!response) return;
    currentData = response;
    updateStatusDot(response);
    renderActiveTab();
  });
}

function startPolling() {
  if (refreshTimer) clearInterval(refreshTimer);
  const interval = currentData?.settings?.refreshInterval || 30;
  refreshTimer = setInterval(loadData, interval * 1000);
}

function renderActiveTab() {
  const activeTab = document.querySelector('.tab.active')?.dataset.tab;
  if (!currentData) return;
  if (activeTab === 'overview') renderOverview(currentData);
  if (activeTab === 'details') renderDetails(currentData);
  if (activeTab === 'settings') renderSettings(currentData.settings);
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
