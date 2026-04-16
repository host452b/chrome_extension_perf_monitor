// Paste this into the service worker console (chrome://extensions → service worker → inspect)
// to check which APIs are actually available:

console.log('=== Chrome API Availability ===');
console.log('chrome.processes:', typeof chrome.processes);
console.log('chrome.debugger:', typeof chrome.debugger);
console.log('chrome.debugger.getTargets:', typeof chrome.debugger?.getTargets);
console.log('chrome.system.cpu:', typeof chrome.system?.cpu);
console.log('chrome.system.memory:', typeof chrome.system?.memory);
console.log('chrome.management:', typeof chrome.management);
console.log('chrome.webRequest:', typeof chrome.webRequest);

if (chrome.debugger?.getTargets) {
  chrome.debugger.getTargets((targets) => {
    const extTargets = targets.filter(t => t.extensionId && t.extensionId !== chrome.runtime.id);
    console.log('Extension targets found:', extTargets.length);
    extTargets.forEach(t => {
      console.log(`  ${t.title} (${t.type}) - ${t.extensionId}`);
    });
  });
}
