let currentData = null;
let prevSnapshot = {}; // { extId: { score, enabled, sensitiveCount } } for diff detection

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
  setInterval(loadData, 1000);
});

function loadData() {
  chrome.runtime.sendMessage({ type: 'GET_DATA' }, (response) => {
    if (!response) return;
    const isFirstLoad = !currentData;
    currentData = response;
    if (isFirstLoad) {
      renderAll();
    } else {
      updateDynamic();
    }
  });
}

/** Full render — only on first load or structural change (search/sort/settings) */
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
  wireToolbar(entries);
  renderDetailsList(entries, currentData.settings);
  saveSnapshot(entries);
}

/** Incremental update — detect changes and animate only what changed */
function updateDynamic() {
  if (!currentData) return;
  const entries = buildSortedEntries(currentData.extensions);
  const newSnapshot = buildSnapshot(entries);

  // Detect structural changes (new/removed extensions)
  const prevIds = new Set(Object.keys(prevSnapshot));
  const newIds = new Set(Object.keys(newSnapshot));
  const added = [...newIds].filter(id => !prevIds.has(id));
  const removed = [...prevIds].filter(id => !newIds.has(id));
  const structuralChange = added.length > 0 || removed.length > 0;

  if (structuralChange) {
    // Fade out removed items, then full re-render
    if (removed.length > 0) {
      for (const id of removed) {
        const el = document.querySelector(`[data-ext-id="${id}"]`);
        if (el) el.classList.add('fade-out');
        const barEl = document.querySelector(`[data-bar-id="${id}"]`);
        if (barEl) barEl.classList.add('fade-out');
      }
      setTimeout(() => { renderAll(); animateNewItems(added); }, 400);
    } else {
      renderAll();
      animateNewItems(added);
    }
    return;
  }

  // Detect value changes on existing items
  for (const [id, cur] of Object.entries(newSnapshot)) {
    const prev = prevSnapshot[id];
    if (!prev) continue;

    if (cur.score !== prev.score) {
      animateValueChange(`[data-ext-id="${id}"] .ext-score-badge`);
      animateValueChange(`[data-bar-id="${id}"] .bar-value`);
      // Update bar width
      const barFill = document.querySelector(`[data-bar-id="${id}"] .bar-fill`);
      if (barFill) {
        const maxScore = Math.max(...entries.map(e => e.score), 1);
        barFill.style.width = `${(cur.score / maxScore * 100).toFixed(1)}%`;
        barFill.style.background = getScoreColor(cur.score);
      }
      // Update badge
      const badge = document.querySelector(`[data-ext-id="${id}"] .ext-score-badge`);
      if (badge) {
        badge.textContent = cur.score;
        badge.style.color = getScoreColor(cur.score);
        badge.style.background = getScoreColor(cur.score) + '15';
      }
      const barVal = document.querySelector(`[data-bar-id="${id}"] .bar-value`);
      if (barVal) barVal.textContent = cur.score;
    }

    if (cur.enabled !== prev.enabled) {
      animateValueChange(`[data-ext-id="${id}"]`);
    }
  }

  // Update KPI values with animation
  updateKpi('kpi-active', entries.filter(e => e.enabled).length);
  updateKpi('kpi-high', entries.filter(e => e.score >= 70).length);
  updateKpi('kpi-med', entries.filter(e => e.score >= 50 && e.score < 70).length);
  updateKpi('kpi-warnings', entries.filter(e => e.score >= (currentData.settings.alertThreshold || 70)).length);

  saveSnapshot(entries);
}

function updateKpi(id, newValue) {
  const el = document.getElementById(id);
  if (!el) return;
  const oldValue = el.textContent;
  const newStr = String(newValue);
  if (oldValue !== newStr) {
    el.textContent = newStr;
    animateValueChange('#' + id);
  }
}

function animateValueChange(selector) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el) return;
  el.classList.remove('value-changed');
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add('value-changed');
}

function animateNewItems(ids) {
  requestAnimationFrame(() => {
    for (const id of ids) {
      const card = document.querySelector(`[data-ext-id="${id}"]`);
      if (card) card.classList.add('fade-in');
      const bar = document.querySelector(`[data-bar-id="${id}"]`);
      if (bar) bar.classList.add('fade-in');
    }
  });
}

function buildSnapshot(entries) {
  const snap = {};
  for (const e of entries) {
    snap[e.id] = { score: e.score, enabled: e.enabled, sensitiveCount: e.sensitiveCount };
  }
  return snap;
}

function saveSnapshot(entries) {
  prevSnapshot = buildSnapshot(entries);
}

function wireToolbar(entries) {
  document.getElementById('search-ext').addEventListener('input', (e) => {
    currentSearch = e.target.value;
    renderDetailsList(entries, currentData.settings);
  });

  document.getElementById('panel-content').querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSort = btn.dataset.sort;
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDetailsList(entries, currentData.settings);
    });
  });
}

function onSettingsChanged(newSettings) {
  currentData.settings = newSettings;
  chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings: newSettings });
  renderAll();
}
