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

// Inject content script into a tab
async function injectContentScript(tabId) {
  if (injectedTabs.has(tabId)) {
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"],
    });

    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ["styles.css"],
    });

    injectedTabs.add(tabId);

    // Send current state to the newly injected script
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, {
        action: "syncState",
        state: globalWidgetState,
      });
    }, 100);
  } catch (error) {
    console.error("Failed to inject content script:", error);
  }
}

// Inject into all existing tabs on extension load
chrome.runtime.onInstalled.addListener(async () => {
  // Load saved state
  const result = await chrome.storage.local.get(["globalWidgetState"]);
  if (result.globalWidgetState) {
    globalWidgetState = result.globalWidgetState;
  }

  // Get all tabs and inject content script
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (
      tab.url &&
      !tab.url.startsWith("chrome://") &&
      !tab.url.startsWith("chrome-extension://")
    ) {
      await injectContentScript(tab.id);
    }
  }
});

// Inject into new tabs
chrome.tabs.onCreated.addListener(async (tab) => {
  if (
    tab.id &&
    tab.url &&
    !tab.url.startsWith("chrome://") &&
    !tab.url.startsWith("chrome-extension://")
  ) {
    // Wait a bit for the tab to fully load
    setTimeout(() => {
      injectContentScript(tab.id);
    }, 1000);
  }
});

// Inject when tab is updated
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    !tab.url.startsWith("chrome://") &&
    !tab.url.startsWith("chrome-extension://")
  ) {
    await injectContentScript(tabId);
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "updateGlobalState":
      // Update global state from any tab
      Object.assign(globalWidgetState, request.state);
      saveGlobalState();

      // Broadcast to all tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id !== sender.tab?.id && !tab.url.startsWith("chrome://")) {
            chrome.tabs
              .sendMessage(tab.id, {
                action: "syncState",
                state: globalWidgetState,
              })
              .catch(() => {}); // Ignore errors for tabs without content script
          }
        });
      });
      break;

    case "getGlobalState":
      sendResponse(globalWidgetState);
      break;

    case "toggleFromPopup":
      // Toggle visibility globally
      globalWidgetState.isVisible = !globalWidgetState.isVisible;
      saveGlobalState();

      // Broadcast to all tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (!tab.url.startsWith("chrome://")) {
            chrome.tabs
              .sendMessage(tab.id, {
                action: "toggle",
                isVisible: globalWidgetState.isVisible,
              })
              .catch(() => {});
          }
        });
      });

      sendResponse({ success: true, isVisible: globalWidgetState.isVisible });
      break;

    case "updateSettings":
      // Update settings globally
      Object.assign(globalWidgetState.settings, request.settings);
      saveGlobalState();

      // Broadcast to all tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (!tab.url.startsWith("chrome://")) {
            chrome.tabs
              .sendMessage(tab.id, {
                action: "updateSettings",
                settings: globalWidgetState.settings,
              })
              .catch(() => {});
          }
        });
      });

      sendResponse({ success: true });
      break;
  }

  return true; // Keep message channel open for async responses
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-widget") {
    // Toggle globally
    globalWidgetState.isVisible = !globalWidgetState.isVisible;
    saveGlobalState();

    // Broadcast to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (!tab.url.startsWith("chrome://")) {
          chrome.tabs
            .sendMessage(tab.id, {
              action: "toggle",
              isVisible: globalWidgetState.isVisible,
            })
            .catch(() => {});
        }
      });
    });
  }
});

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings if not exists
  chrome.storage.local.get(["globalWidgetState"], (result) => {
    if (!result.globalWidgetState) {
      chrome.storage.local.set({ globalWidgetState: globalWidgetState });
    }
  });
});
