let prevTabData = {}; // { tabId: jsHeapUsed } for diff animation

function loadTabData(callback) {
  chrome.runtime.sendMessage({ type: 'GET_TABS' }, (response) => {
    if (!response) return;
    callback(response.tabs);
  });
}

function renderTabSection(tabs) {
  const container = document.getElementById('tab-section');
  if (!container) return;

  if (!tabs || tabs.length === 0) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(t('noTabs'))}</div>`;
    return;
  }

  // Aggregate stats
  const measurable = tabs.filter(t => t.jsHeapUsed > 0);
  const totalHeap = measurable.reduce((s, t) => s + t.jsHeapUsed, 0);
  const totalDom = measurable.reduce((s, t) => s + t.domNodes, 0);
  const heavyCount = measurable.filter(t => t.jsHeapUsed > 50 * 1024 * 1024).length; // >50MB

  // KPI row
  const kpiHtml = `
    <div class="kpi-row">
      <div class="kpi-card">
        <span class="kpi-value" id="tab-kpi-count">${tabs.length}</span>
        <span class="kpi-label">${escapeHtml(t('tabsOpen'))}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-value" id="tab-kpi-heap">${formatBytes(totalHeap)}</span>
        <span class="kpi-label">JS Heap</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-value" id="tab-kpi-dom">${formatNumber(totalDom)}</span>
        <span class="kpi-label">DOM</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-value" id="tab-kpi-heavy">${heavyCount}</span>
        <span class="kpi-label">${escapeHtml(t('tabsHeavy'))}</span>
      </div>
    </div>
  `;

  // Tab list
  const maxHeap = Math.max(...tabs.map(t => t.jsHeapUsed), 1);
  const listHtml = tabs.map(tab => {
    const heap = tab.jsHeapUsed;
    const pct = (heap / maxHeap) * 100;
    const color = heap > 100 * 1024 * 1024 ? '#F87171'
               : heap > 50 * 1024 * 1024 ? '#FBBF24'
               : '#34D399';
    const isNew = !(tab.id in prevTabData);
    const changed = prevTabData[tab.id] !== undefined && prevTabData[tab.id] !== heap;
    const animClass = isNew ? 'fade-in' : changed ? 'value-changed' : '';

    const domainShort = tab.domain.length > 25 ? tab.domain.slice(0, 25) + '...' : tab.domain;
    const titleShort = tab.title.length > 35 ? tab.title.slice(0, 35) + '...' : tab.title;

    return `
      <div class="tab-row ${animClass}" data-tab-id="${tab.id}">
        <div class="tab-info">
          <span class="tab-title" title="${escapeAttr(tab.title)}">${escapeHtml(titleShort)}</span>
          <span class="tab-domain">${escapeHtml(domainShort)}</span>
        </div>
        <div class="tab-metrics">
          <div class="tab-bar-wrap">
            <div class="tab-bar" style="width:${pct.toFixed(1)}%;background:${color}"></div>
          </div>
          <span class="tab-heap" style="color:${color}">${heap > 0 ? formatBytes(heap) : '—'}</span>
          <button class="tab-close" title="${escapeAttr(t('closeTab'))}" onclick="closeTab(${tab.id}, this)">×</button>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = kpiHtml + `
    <div class="section-title" style="margin-top:4px">${escapeHtml(t('tabsByMemory'))}</div>
    <div id="tab-list">${listHtml}</div>
  `;

  // Save snapshot for next diff
  prevTabData = {};
  for (const tab of tabs) {
    prevTabData[tab.id] = tab.jsHeapUsed;
  }
}

function closeTab(tabId, btn) {
  btn.disabled = true;
  btn.style.opacity = '0.3';
  chrome.runtime.sendMessage({ type: 'CLOSE_TAB', tabId }, (response) => {
    if (response?.ok) {
      const row = btn.closest('.tab-row');
      if (row) {
        row.classList.add('fade-out');
        setTimeout(() => row.remove(), 400);
      }
    }
  });
}
