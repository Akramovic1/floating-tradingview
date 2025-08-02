// Background service worker for Floating TradingView Extension

// Track tab states
const tabStates = new Map();

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This won't fire since we have a popup
  // Popup handles the toggle
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "updateVisibility":
      // Update badge to show status
      if (sender.tab) {
        tabStates.set(sender.tab.id, request.isVisible);
        chrome.action.setBadgeText({
          text: request.isVisible ? "ON" : "",
          tabId: sender.tab.id,
        });
        chrome.action.setBadgeBackgroundColor({
          color: "#4CAF50",
        });
      }
      break;

    case "openSettings":
      // Open popup for settings
      chrome.action.openPopup();
      break;

    case "toggleFromPopup":
      // Forward toggle request to content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { action: "toggle" },
            (response) => {
              if (chrome.runtime.lastError) {
                // Content script not loaded, inject it
                chrome.scripting.executeScript(
                  {
                    target: { tabId: tabs[0].id },
                    files: ["content.js"],
                  },
                  () => {
                    // Try again after injection
                    setTimeout(() => {
                      chrome.tabs.sendMessage(tabs[0].id, { action: "toggle" });
                    }, 100);
                  }
                );
              }
              sendResponse(response);
            }
          );
        }
      });
      return true; // Keep message channel open
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-widget") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "toggle" },
          (response) => {
            if (chrome.runtime.lastError) {
              // Content script not loaded, inject it
              chrome.scripting.executeScript(
                {
                  target: { tabId: tabs[0].id },
                  files: ["content.js"],
                },
                () => {
                  // Try again after injection
                  setTimeout(() => {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "toggle" });
                  }, 100);
                }
              );
            }
          }
        );
      }
    });
  }
});

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.local.get(["tradingViewSettings"], (result) => {
    if (!result.tradingViewSettings) {
      chrome.storage.local.set({
        tradingViewSettings: {
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
      });
    }
  });
});
