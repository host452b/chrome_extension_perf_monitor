function renderSettings(settings) {
  const container = document.getElementById('tab-settings');
  const extensions = currentData?.extensions || {};
  const ignoreList = settings.ignoreList || [];

  const ignoreHtml = Object.entries(extensions).map(([id, ext]) => {
    const checked = ignoreList.includes(id) ? 'checked' : '';
    return `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;cursor:pointer">
      <input type="checkbox" class="ignore-checkbox" data-ext-id="${id}" ${checked} style="accent-color:var(--green)">
      ${escapeHtml(ext.name)}
    </label>`;
  }).join('');

  container.innerHTML = `
    <div class="setting-group">
      <div class="setting-label">${escapeHtml(t('settingRefreshRate'))}</div>
      <div class="setting-description">${escapeHtml(t('settingRefreshDesc'))}</div>
      <div class="radio-group" id="setting-refresh">
        <div class="radio-option ${settings.refreshInterval === 60 ? 'selected' : ''}" data-value="60">${escapeHtml(t('settingRefreshLow'))}</div>
        <div class="radio-option ${settings.refreshInterval === 30 ? 'selected' : ''}" data-value="30">${escapeHtml(t('settingRefreshMid'))}</div>
        <div class="radio-option ${settings.refreshInterval === 10 ? 'selected' : ''}" data-value="10">${escapeHtml(t('settingRefreshHigh'))}</div>
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-label">${escapeHtml(t('settingThreshold'))}</div>
      <div class="setting-description">${escapeHtml(t('settingThresholdDesc'))}</div>
      <div class="slider-row">
        <input type="range" id="setting-threshold" min="10" max="100" step="5" value="${settings.alertThreshold}">
        <span class="slider-value" id="threshold-display">${settings.alertThreshold}</span>
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-label">${escapeHtml(t('settingIgnoreList'))}</div>
      <div class="setting-description">${escapeHtml(t('settingIgnoreDesc'))}</div>
      <div id="ignore-list" style="max-height:160px;overflow-y:auto;padding:4px 0">
        ${ignoreHtml || `<span style="color:var(--fg-muted);font-size:12px">${escapeHtml(t('noExtensions'))}</span>`}
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-label">${escapeHtml(t('settingRetention'))}</div>
      <div class="setting-description">${escapeHtml(t('settingRetentionDesc'))}</div>
      <div class="radio-group" id="setting-retention">
        <div class="radio-option ${settings.retentionHours === 1 ? 'selected' : ''}" data-value="1">${escapeHtml(t('retention1h'))}</div>
        <div class="radio-option ${settings.retentionHours === 6 ? 'selected' : ''}" data-value="6">${escapeHtml(t('retention6h'))}</div>
        <div class="radio-option ${settings.retentionHours === 24 ? 'selected' : ''}" data-value="24">${escapeHtml(t('retention24h'))}</div>
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-label">${escapeHtml(t('settingExport'))}</div>
      <div class="setting-description">${escapeHtml(t('settingExportDesc'))}</div>
      <button class="btn-export" id="btn-export">${escapeHtml(t('btnExport'))}</button>
    </div>
  `;

  container.querySelectorAll('#setting-refresh .radio-option').forEach(opt => {
    opt.addEventListener('click', () => {
      container.querySelectorAll('#setting-refresh .radio-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      onSettingsChanged({ ...currentData.settings, refreshInterval: parseInt(opt.dataset.value) });
    });
  });

  const slider = document.getElementById('setting-threshold');
  const display = document.getElementById('threshold-display');
  slider.addEventListener('input', () => { display.textContent = slider.value; });
  slider.addEventListener('change', () => {
    onSettingsChanged({ ...currentData.settings, alertThreshold: parseInt(slider.value) });
  });

  container.querySelectorAll('.ignore-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const newIgnore = [];
      container.querySelectorAll('.ignore-checkbox:checked').forEach(c => newIgnore.push(c.dataset.extId));
      onSettingsChanged({ ...currentData.settings, ignoreList: newIgnore });
    });
  });

  container.querySelectorAll('#setting-retention .radio-option').forEach(opt => {
    opt.addEventListener('click', () => {
      container.querySelectorAll('#setting-retention .radio-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      onSettingsChanged({ ...currentData.settings, retentionHours: parseInt(opt.dataset.value) });
    });
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `perf-monitor-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
