// Popup script for Floating TradingView Extension

let currentSettings = {
  symbol: "BTCUSD",
  interval: "D",
  theme: "dark",
  style: "1",
  width: 600,
  height: 400,
  x: 100,
  y: 100,
  opacity: 1,
};

let isVisible = false;

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  // Load current settings from global state
  chrome.runtime.sendMessage({ action: "getGlobalState" }, (state) => {
    if (state) {
      currentSettings = state.settings;
      isVisible = state.isVisible;
      updateUI();
      updateVisibilityToggle();
    }
  });

  // Set up event listeners
  setupEventListeners();
});

function updateUI() {
  document.getElementById("symbol").value = currentSettings.symbol;
  document.getElementById("interval").value = currentSettings.interval;
  document.getElementById("theme").value = currentSettings.theme;
  document.getElementById("chartStyle").value = currentSettings.style;
  document.getElementById("opacity").value = currentSettings.opacity;
  document.getElementById("opacityValue").textContent = `${Math.round(
    currentSettings.opacity * 100
  )}%`;
}

function updateVisibilityToggle() {
  const toggle = document.getElementById("visibilityToggle");
  if (isVisible) {
    toggle.classList.add("active");
  } else {
    toggle.classList.remove("active");
  }
}

function setupEventListeners() {
  // Visibility toggle
  document.getElementById("visibilityToggle").addEventListener("click", () => {
    // Send message through background script to toggle globally
    chrome.runtime.sendMessage({ action: "toggleFromPopup" }, (response) => {
      if (response && response.success) {
        isVisible = response.isVisible;
        updateVisibilityToggle();
      }
    });
  });

  // Symbol chips
  document.querySelectorAll(".symbol-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const symbol = chip.getAttribute("data-symbol");
      document.getElementById("symbol").value = symbol;
    });
  });

  // Opacity slider
  document.getElementById("opacity").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("opacityValue").textContent = `${Math.round(
      value * 100
    )}%`;
  });

  // Save button
  document.getElementById("saveBtn").addEventListener("click", saveSettings);

  // Reset button
  document.getElementById("resetBtn").addEventListener("click", resetSettings);
}

async function saveSettings() {
  // Gather settings from UI
  const newSettings = {
    ...currentSettings,
    symbol: document.getElementById("symbol").value.toUpperCase(),
    interval: document.getElementById("interval").value,
    theme: document.getElementById("theme").value,
    style: document.getElementById("chartStyle").value,
    opacity: parseFloat(document.getElementById("opacity").value),
  };

  // Send to background script to update globally
  chrome.runtime.sendMessage(
    {
      action: "updateSettings",
      settings: newSettings,
    },
    (response) => {
      if (response && response.success) {
        // Show success feedback
        const saveBtn = document.getElementById("saveBtn");
        const originalText = saveBtn.textContent;
        saveBtn.textContent = "Saved!";
        saveBtn.style.background = "#4CAF50";

        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.style.background = "";
        }, 2000);

        currentSettings = newSettings;
      }
    }
  );
}

async function resetSettings() {
  // Reset to defaults
  const defaultSettings = {
    symbol: "BTCUSD",
    interval: "D",
    theme: "dark",
    style: "1",
    width: 600,
    height: 400,
    x: 100,
    y: 100,
    opacity: 1,
  };

  currentSettings = defaultSettings;
  updateUI();

  // Send to background script to update globally
  chrome.runtime.sendMessage({
    action: "updateSettings",
    settings: defaultSettings,
  });

  // Show feedback
  const resetBtn = document.getElementById("resetBtn");
  const originalText = resetBtn.textContent;
  resetBtn.textContent = "Reset!";

  setTimeout(() => {
    resetBtn.textContent = originalText;
  }, 2000);
}
