// i18n — auto-detect browser language, fallback to English
const _lang = (typeof navigator !== 'undefined' && navigator.language || 'en').slice(0, 2);

const _strings = {
  en: {
    // Header
    appName: 'Perf Monitor',

    // Status
    statusHealthy: 'Status: All clear',
    statusWarning: 'Status: Some extensions need attention',
    statusCritical: 'Status: Multiple high-impact extensions detected',

    // KPI cards
    kpiActive: 'Active',
    kpiRequests: 'Requests',
    kpiTraffic: 'Traffic',
    kpiWarnings: 'Alerts',

    // Tabs
    tabOverview: 'Overview',
    tabDetails: 'Details',
    tabSettings: 'Settings',

    // Overview
    networkActivity: 'Network Activity (Last 30 min)',
    consumptionByExt: 'Traffic Share by Extension',
    noTraffic: 'No traffic recorded yet — browse a few pages and check back',

    // Score — the key explanation
    scoreLabel: 'Impact',
    scoreLow: 'Low Impact',
    scoreMedium: 'Moderate Impact',
    scoreHigh: 'High Impact',
    scoreTooltip: 'Impact Score: permissions breadth + network activity + content script scope',

    // Details
    searchPlaceholder: 'Search extensions...',
    sortScore: 'Impact',
    sortTraffic: 'Traffic',
    sortRequests: 'Requests',
    detailRequests: 'Requests sent',
    detailTraffic: 'Data transferred',
    detailContentScripts: 'Injected pages',
    detailAllSites: 'All websites',
    detailPatterns: 'pattern(s)',
    detailNone: 'None',
    sectionPermissions: 'Permissions',
    sectionTopDomains: 'Top Requested Domains',
    btnDisable: 'Disable This Extension',
    btnDisabled: 'Already Disabled',
    btnConfirm: 'Tap again to confirm',
    noExtensions: 'No extensions found',

    // Settings
    settingRefreshRate: 'Dashboard Refresh Speed',
    settingRefreshDesc: 'How often the data updates on screen',
    settingRefreshLow: 'Slow (60s)',
    settingRefreshMid: 'Normal (30s)',
    settingRefreshHigh: 'Fast (10s)',
    settingThreshold: 'Alert Sensitivity',
    settingThresholdDesc: 'Extensions with impact at or above this level show an alert badge',
    settingIgnoreList: 'Hidden Extensions',
    settingIgnoreDesc: 'These extensions are excluded from all views',
    settingRetention: 'Data Retention',
    settingRetentionDesc: 'How long monitoring data is kept before auto-cleanup',
    settingExport: 'Export Data',
    settingExportDesc: 'Download all current monitoring data as a JSON file',
    btnExport: 'Download JSON',

    // Popup
    topImpact: 'Highest Impact',
    openPanel: 'Open Full Dashboard',
    collecting: 'Monitoring extensions — CPU & memory data refreshes every 30s',
    debuggerNote: 'A brief "debugging" banner may flash as we sample each extension',

    // Retention options
    retention1h: '1 hour',
    retention6h: '6 hours',
    retention24h: '24 hours',

    kpiCpu: 'CPU',
    kpiMemory: 'MEM',
    nativeConnected: 'Measured — native host connected',
    nativeNotConnected: 'Install native host for precise data',
    estimateMode: '~Estimated from network, permissions & tab coverage',
    copyInstallCmd: 'Copy Install Command',
    copied: 'Copied!',
    pasteInTerminal: 'Paste in Terminal, then restart Chrome',
  },
  zh: {
    appName: '扩展性能监控',

    statusHealthy: '状态：一切正常',
    statusWarning: '状态：部分扩展需要关注',
    statusCritical: '状态：检测到多个高影响扩展',

    kpiActive: '已启用',
    kpiRequests: '请求数',
    kpiTraffic: '流量',
    kpiWarnings: '警告',

    tabOverview: '总览',
    tabDetails: '详情',
    tabSettings: '设置',

    networkActivity: '网络活动（近 30 分钟）',
    consumptionByExt: '各扩展流量占比',
    noTraffic: '暂无流量记录 — 浏览几个网页后再来看看',

    scoreLabel: '影响度',
    scoreLow: '影响较低',
    scoreMedium: '影响中等',
    scoreHigh: '影响较高',
    scoreTooltip: '影响度评分：权限广度 + 网络活动 + 内容脚本注入范围',

    searchPlaceholder: '搜索扩展...',
    sortScore: '影响度',
    sortTraffic: '流量',
    sortRequests: '请求数',
    detailRequests: '发送请求数',
    detailTraffic: '传输数据量',
    detailContentScripts: '注入页面',
    detailAllSites: '所有网站',
    detailPatterns: '个匹配规则',
    detailNone: '无',
    sectionPermissions: '权限列表',
    sectionTopDomains: '请求最多的域名',
    btnDisable: '禁用此扩展',
    btnDisabled: '已禁用',
    btnConfirm: '再点一次确认',
    noExtensions: '未找到扩展',

    settingRefreshRate: '面板刷新速度',
    settingRefreshDesc: '数据在屏幕上的更新频率',
    settingRefreshLow: '慢 (60秒)',
    settingRefreshMid: '正常 (30秒)',
    settingRefreshHigh: '快 (10秒)',
    settingThreshold: '警告灵敏度',
    settingThresholdDesc: '影响度达到此阈值的扩展会显示警告标记',
    settingIgnoreList: '隐藏的扩展',
    settingIgnoreDesc: '这些扩展不会出现在任何视图中',
    settingRetention: '数据保留时间',
    settingRetentionDesc: '监控数据在自动清理前保留多久',
    settingExport: '导出数据',
    settingExportDesc: '将当前所有监控数据下载为 JSON 文件',
    btnExport: '下载 JSON',

    topImpact: '影响度最高',
    openPanel: '打开完整面板',
    collecting: '正在监控扩展 — CPU 和内存数据每 30 秒刷新',
    debuggerNote: '采样时浏览器顶部会短暂闪现调试横幅',

    retention1h: '1 小时',
    retention6h: '6 小时',
    retention24h: '24 小时',

    kpiCpu: 'CPU',
    kpiMemory: '内存',
    nativeConnected: '精确模式 — 本地采集器已连接',
    nativeNotConnected: '安装本地采集器以获取精确数据',
    estimateMode: '~基于网络活动、权限和 Tab 覆盖率估算',
    copyInstallCmd: '复制安装命令',
    copied: '已复制！',
    pasteInTerminal: '粘贴到终端执行，然后重启 Chrome',
  },
};

function t(key) {
  const strings = _strings[_lang] || _strings.en;
  return strings[key] || _strings.en[key] || key;
}

if (typeof module !== 'undefined') {
  module.exports = { t, _strings };
}
