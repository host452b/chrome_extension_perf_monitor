const _lang = (typeof navigator !== 'undefined' && navigator.language || 'en').slice(0, 2);

const _strings = {
  en: {
    appName: 'Extension Audit',

    statusHealthy: 'All extensions look clean',
    statusWarning: 'Some extensions have broad permissions',
    statusCritical: 'Multiple high-risk extensions detected',

    kpiActive: 'Active',
    kpiHighRisk: 'High Risk',
    kpiMedRisk: 'Medium',
    kpiWarnings: 'Alerts',

    scoreLabel: 'Risk',
    scoreLow: 'Low Risk',
    scoreMedium: 'Medium Risk',
    scoreHigh: 'High Risk',
    scoreTooltip: 'Risk Score = permission sensitivity (60%) + content script scope (40%)',

    consumptionByExt: 'Extensions by Risk',
    searchPlaceholder: 'Search extensions...',
    sortScore: 'Risk',
    sortPerms: 'Permissions',
    detailSensitivePerms: 'Sensitive permissions',
    detailContentScripts: 'Content script scope',
    detailAllSites: 'All websites',
    detailPatterns: 'pattern(s)',
    detailNone: 'None',
    sectionPermissions: 'All Permissions',
    btnDisable: 'Disable This Extension',
    btnDisabled: 'Already Disabled',
    btnConfirm: 'Click again to confirm',
    noExtensions: 'No extensions found',

    settingRefreshRate: 'Dashboard Refresh Speed',
    settingRefreshDesc: 'How often data refreshes on screen',
    settingRefreshLow: 'Manual',
    settingRefreshMid: 'On open',
    settingRefreshHigh: 'On open',
    settingThreshold: 'Alert Sensitivity',
    settingThresholdDesc: 'Extensions scoring at or above this value are flagged',
    settingIgnoreList: 'Hidden Extensions',
    settingIgnoreDesc: 'These extensions are excluded from all views',
    settingRetention: 'Data Retention',
    settingRetentionDesc: 'Not applicable — all analysis is real-time from manifest data',
    settingExport: 'Export Audit Report',
    settingExportDesc: 'Download the current audit data as JSON',
    btnExport: 'Download JSON',

    topImpact: 'Highest Risk',
    openPanel: 'Open Full Audit',
    collecting: 'Reading extension manifests...',

    retention1h: '—',
    retention6h: '—',
    retention24h: '—',

    aboutTitle: 'How This Works',
    aboutBody: `<p>This tool audits your extensions using <strong>static analysis only</strong> — it reads each extension's declared permissions and content script patterns from their manifest.</p>
<p style="margin-top:6px"><strong>Risk Score (0–100)</strong> is computed from two factors:</p>
<ul style="margin:6px 0 6px 16px">
<li><strong>Permission sensitivity (60%)</strong> — sensitive permissions like <code>&lt;all_urls&gt;</code>, <code>cookies</code>, <code>history</code>, <code>webRequest</code> are weighted 2×; others 0.5×</li>
<li><strong>Content script scope (40%)</strong> — extensions that inject into all websites score highest; narrow patterns score lower; none scores 0</li>
</ul>
<p style="margin-top:6px">Scores are <strong>deterministic</strong> — they only change when an extension updates its permissions. No estimation, no sampling, no guesswork.</p>
<p style="margin-top:6px;color:var(--fg-dim)">Chrome does not expose per-extension CPU or memory to other extensions. This tool provides the most reliable analysis possible within Chrome's security model.</p>`,
  },
  zh: {
    appName: '扩展审计',

    statusHealthy: '所有扩展看起来正常',
    statusWarning: '部分扩展权限较广',
    statusCritical: '检测到多个高风险扩展',

    kpiActive: '已启用',
    kpiHighRisk: '高风险',
    kpiMedRisk: '中等',
    kpiWarnings: '警告',

    scoreLabel: '风险',
    scoreLow: '低风险',
    scoreMedium: '中风险',
    scoreHigh: '高风险',
    scoreTooltip: '风险评分 = 权限敏感度 (60%) + 内容脚本范围 (40%)',

    consumptionByExt: '扩展风险排名',
    searchPlaceholder: '搜索扩展...',
    sortScore: '风险',
    sortPerms: '权限数',
    detailSensitivePerms: '敏感权限数',
    detailContentScripts: '内容脚本范围',
    detailAllSites: '所有网站',
    detailPatterns: '个匹配规则',
    detailNone: '无',
    sectionPermissions: '全部权限',
    btnDisable: '禁用此扩展',
    btnDisabled: '已禁用',
    btnConfirm: '再点一次确认',
    noExtensions: '未找到扩展',

    settingRefreshRate: '刷新方式',
    settingRefreshDesc: '数据刷新时机',
    settingRefreshLow: '手动',
    settingRefreshMid: '打开时',
    settingRefreshHigh: '打开时',
    settingThreshold: '警告灵敏度',
    settingThresholdDesc: '风险评分达到此阈值的扩展会被标记',
    settingIgnoreList: '隐藏的扩展',
    settingIgnoreDesc: '这些扩展不会出现在任何视图中',
    settingRetention: '数据保留',
    settingRetentionDesc: '不适用 — 所有分析均为实时读取 manifest 数据',
    settingExport: '导出审计报告',
    settingExportDesc: '将当前审计数据下载为 JSON',
    btnExport: '下载 JSON',

    topImpact: '风险最高',
    openPanel: '打开完整审计',
    collecting: '正在读取扩展信息...',

    retention1h: '—',
    retention6h: '—',
    retention24h: '—',

    aboutTitle: '工作原理',
    aboutBody: `<p>本工具通过<strong>静态分析</strong>审计你的扩展 — 读取每个扩展在 manifest 中声明的权限和内容脚本模式。</p>
<p style="margin-top:6px"><strong>风险评分 (0–100)</strong> 由两个因素计算：</p>
<ul style="margin:6px 0 6px 16px">
<li><strong>权限敏感度 (60%)</strong> — <code>&lt;all_urls&gt;</code>、<code>cookies</code>、<code>history</code>、<code>webRequest</code> 等敏感权限权重 2×；其他 0.5×</li>
<li><strong>内容脚本范围 (40%)</strong> — 注入所有网站的得分最高；窄匹配较低；无注入为 0</li>
</ul>
<p style="margin-top:6px">评分是<strong>确定性的</strong> — 只有扩展更新权限时才会变化。没有估算、没有采样、没有猜测。</p>
<p style="margin-top:6px;color:var(--fg-dim)">Chrome 不允许扩展读取其他扩展的 CPU 或内存数据。本工具在 Chrome 安全模型允许范围内提供最可靠的分析。</p>`,
  },
};

function t(key) {
  const strings = _strings[_lang] || _strings.en;
  return strings[key] || _strings.en[key] || key;
}

if (typeof module !== 'undefined') {
  module.exports = { t, _strings };
}
