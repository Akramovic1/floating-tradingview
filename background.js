// Background service worker for Floating TradingView Extension

// Track global widget state
let globalWidgetState = {
  isVisible: false,
  isMinimized: false,
  settings: {
    symbol: "BTCUSD",
    interval: "D",
    theme: "dark",
    style: "1",
    width: 600,
    height: 400,
    x: 100,
    y: 100,
    opacity: 1,
  },
};

// Track which tabs have the content script injected
const injectedTabs = new Set();
let globalWidgetId = "ftv-global-widget"; // Single global widget ID
let activeTabId = null; // Track which tab currently shows the widget

// Load saved state on startup
chrome.runtime.onStartup.addListener(async () => {
  const result = await chrome.storage.local.get(["globalWidgetState"]);
  if (result.globalWidgetState) {
    globalWidgetState = result.globalWidgetState;
  }
});

// Save state changes
async function saveGlobalState() {
  await chrome.storage.local.set({ globalWidgetState: globalWidgetState });
}

// Check if URL is injectable
function isInjectableUrl(url) {
  if (!url) return false;
  
  // Block system pages
  if (url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("edge://") ||
      url.startsWith("about:") ||
      url.startsWith("file://") ||
      url.startsWith("moz-extension://") ||
      url.startsWith("safari-extension://") ||
      url.startsWith("ms-browser-extension://")) {
    return false;
  }

  // Block certain problematic websites that might interfere
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Allow most websites, but add any known problematic ones here if needed
    const blockedDomains = [
      // Add domains here that consistently cause issues
    ];
    
    return !blockedDomains.some(domain => hostname.includes(domain));
  } catch (e) {
    return false;
  }
}

// Inject content script into a tab only if needed
async function ensureContentScriptInjected(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isInjectableUrl(tab.url)) {
      return false;
    }

    // Check if already injected
    if (injectedTabs.has(tabId)) {
      return true;
    }

    // Inject scripts only once per tab
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"],
    });

    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ["styles.css"],
    });

    // Mark as injected
    injectedTabs.add(tabId);

    return true;
  } catch (error) {
    console.error("Failed to inject content script:", error);
    injectedTabs.delete(tabId);
    return false;
  }
}

// Show widget on specific tab (ensures only one widget exists globally)
async function showWidgetOnTab(tabId) {
  if (!await ensureContentScriptInjected(tabId)) {
    return false;
  }

  // First, hide widget on ALL other tabs to ensure only one exists
  if (activeTabId && activeTabId !== tabId) {
    try {
      await chrome.tabs.sendMessage(activeTabId, {
        action: "destroyWidget",
        widgetId: globalWidgetId,
      });
    } catch (e) {
      // Tab might be closed or navigated
    }
  }

  // Show widget on current tab
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: "createWidget",
      widgetId: globalWidgetId,
      state: globalWidgetState,
    });
    activeTabId = tabId;
    return true;
  } catch (error) {
    console.error("Failed to show widget on tab:", error);
    injectedTabs.delete(tabId);
    return false;
  }
}

// Hide widget completely
async function hideWidget() {
  if (activeTabId && injectedTabs.has(activeTabId)) {
    try {
      await chrome.tabs.sendMessage(activeTabId, {
        action: "destroyWidget",
        widgetId: globalWidgetId,
      });
    } catch (e) {
      // Tab might be closed or navigated
    }
  }
  activeTabId = null;
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  // Load saved state
  const result = await chrome.storage.local.get(["globalWidgetState"]);
  if (result.globalWidgetState) {
    globalWidgetState = result.globalWidgetState;
  } else {
    await saveGlobalState();
  }
});

// Handle tab activation - move widget to active tab if visible
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { tabId } = activeInfo;
  
  if (globalWidgetState.isVisible) {
    // Small delay to ensure tab is ready
    setTimeout(async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (isInjectableUrl(tab.url)) {
          await showWidgetOnTab(tabId);
        }
      } catch (error) {
        // Tab might be closed
      }
    }, 100);
  }
});

// Handle tab updates - handle navigation
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && isInjectableUrl(tab.url)) {
    // Reset injection state for this tab since it navigated
    injectedTabs.delete(tabId);
    
    // If this is the active tab and widget should be visible, show it
    if (globalWidgetState.isVisible && activeTabId === tabId) {
      await showWidgetOnTab(tabId);
    }
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
  
  // If the closed tab was showing the widget, clear active tab
  if (activeTabId === tabId) {
    activeTabId = null;
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  switch (request.action) {

    case "updateGlobalState":
      // Update global state from the active widget
      if (request.widgetId === globalWidgetId && sender.tab.id === activeTabId) {
        Object.assign(globalWidgetState, request.state);
        saveGlobalState();
      }
      break;

    case "getGlobalState":
      sendResponse({
        widgetId: globalWidgetId,
        ...globalWidgetState,
      });
      break;

    case "toggleFromPopup":
      // Toggle visibility globally
      globalWidgetState.isVisible = !globalWidgetState.isVisible;
      saveGlobalState();

      if (globalWidgetState.isVisible) {
        // Show widget on current active tab
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          if (tabs[0] && isInjectableUrl(tabs[0].url)) {
            await showWidgetOnTab(tabs[0].id);
          } else {
            // Can't show on this page, revert state
            globalWidgetState.isVisible = false;
            saveGlobalState();
          }
        });
      } else {
        // Hide widget completely
        await hideWidget();
      }

      sendResponse({ success: true, isVisible: globalWidgetState.isVisible });
      break;

    case "updateSettings":
      // Update settings globally
      Object.assign(globalWidgetState.settings, request.settings);
      saveGlobalState();

      // Update widget on active tab if visible
      if (globalWidgetState.isVisible && activeTabId && injectedTabs.has(activeTabId)) {
        chrome.tabs.sendMessage(activeTabId, {
          action: "updateSettings",
          widgetId: globalWidgetId,
          settings: globalWidgetState.settings,
        }).catch(() => {});
      }

      sendResponse({ success: true });
      break;
  }

  return true;
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-widget") {
    // Toggle globally
    globalWidgetState.isVisible = !globalWidgetState.isVisible;
    saveGlobalState();

    if (globalWidgetState.isVisible) {
      // Show widget on current active tab
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0] && isInjectableUrl(tabs[0].url)) {
          await showWidgetOnTab(tabs[0].id);
        } else {
          // Can't show on this page, revert state
          globalWidgetState.isVisible = false;
          saveGlobalState();
        }
      });
    } else {
      // Hide widget completely
      await hideWidget();
    }
  }
});
