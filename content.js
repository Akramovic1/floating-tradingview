// Content script for Floating TradingView Extension
(function () {
  "use strict";

  // Check if already initialized to prevent duplicate instances
  if (window.floatingTVInitialized) {
    return;
  }
  window.floatingTVInitialized = true;

  var floatingTV = {
    isVisible: false,
    isMinimized: false,
    widget: null,
    container: null,
    chartContainer: null,
    dragHandler: null,
    resizeHandler: null,
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

    init: function () {
      console.log("FloatingTradingView: Initializing...");
      var self = this;

      // Initialize drag and resize handlers
      this.dragHandler = new DragHandler(this);
      this.resizeHandler = new ResizeHandler(this);

      // Load saved settings
      this.loadSettings()
        .then(function () {
          // Create floating window
          self.createFloatingWindow();

          // Listen for messages from popup
          chrome.runtime.onMessage.addListener(function (
            request,
            sender,
            sendResponse
          ) {
            console.log("FloatingTradingView: Received message", request);
            self.handleMessage(request, sendResponse);
            return true;
          });

          // Listen for keyboard shortcuts
          document.addEventListener("keydown", function (e) {
            if (e.ctrlKey && e.shiftKey && e.key === "F") {
              e.preventDefault();
              e.stopPropagation();
              self.toggleVisibility();
            }
          });

          console.log("FloatingTradingView: Initialization complete");
        })
        .catch(function (error) {
          console.error("FloatingTradingView: Init error", error);
        });
    },

    loadSettings: function () {
      var self = this;
      return new Promise(function (resolve) {
        chrome.storage.local.get(["tradingViewSettings"], function (result) {
          if (result.tradingViewSettings) {
            Object.assign(self.settings, result.tradingViewSettings);
          }
          resolve();
        });
      });
    },

    saveSettings: function () {
      var self = this;
      return new Promise(function (resolve) {
        chrome.storage.local.set(
          { tradingViewSettings: self.settings },
          resolve
        );
      });
    },

    createFloatingWindow: function () {
      var self = this;

      // Create container
      this.container = document.createElement("div");
      this.container.id = "floating-tradingview-container";
      this.container.style.cssText =
        "position: fixed;" +
        "width: " +
        this.settings.width +
        "px;" +
        "height: " +
        this.settings.height +
        "px;" +
        "left: " +
        this.settings.x +
        "px;" +
        "top: " +
        this.settings.y +
        "px;" +
        "z-index: 999999;" +
        "background: #131722;" +
        "border: 1px solid #2a2e39;" +
        "border-radius: 8px;" +
        "box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);" +
        "display: none;" +
        "opacity: " +
        this.settings.opacity +
        ";" +
        "transition: opacity 0.3s ease;";

      // Create header
      var header = document.createElement("div");
      header.className = "ftv-header";
      header.style.cssText =
        "height: 35px;" +
        "background: #131722;" +
        "border-radius: 8px 8px 0 0;" +
        "display: flex;" +
        "align-items: center;" +
        "justify-content: space-between;" +
        "padding: 0 10px;" +
        "cursor: move;" +
        "user-select: none;" +
        "-webkit-user-select: none;" +
        "touch-action: none;";

      // Title
      var title = document.createElement("span");
      title.textContent = "TradingView";
      title.style.cssText =
        "color: #d1d4dc;" +
        "font-size: 14px;" +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
        "pointer-events: none;";

      // Controls
      var controls = document.createElement("div");
      controls.style.cssText = "display: flex; gap: 8px;";

      // Minimize button
      var minimizeBtn = this.createControlButton("−", function () {
        self.toggleMinimize();
      });

      // Settings button
      var settingsBtn = this.createControlButton("⚙", function () {
        self.showSettings();
      });

      // Close button
      var closeBtn = this.createControlButton("✕", function () {
        self.toggleVisibility();
      });

      controls.appendChild(minimizeBtn);
      controls.appendChild(settingsBtn);
      controls.appendChild(closeBtn);
      header.appendChild(title);
      header.appendChild(controls);

      // Chart container
      this.chartContainer = document.createElement("div");
      this.chartContainer.id = "tradingview-widget-container";
      this.chartContainer.style.cssText =
        "width: 100%;" +
        "height: calc(100% - 35px);" +
        "overflow: hidden;" +
        "position: relative;" +
        "background: #131722;";

      // Resize handle
      var resizeHandle = document.createElement("div");
      resizeHandle.className = "ftv-resize-handle";
      resizeHandle.style.cssText =
        "position: absolute;" +
        "bottom: 0;" +
        "right: 0;" +
        "width: 20px;" +
        "height: 20px;" +
        "cursor: nwse-resize;" +
        "background: linear-gradient(135deg, transparent 50%, #2a2e39 50%);" +
        "border-radius: 0 0 8px 0;" +
        "touch-action: none;";

      // Assemble container
      this.container.appendChild(header);
      this.container.appendChild(this.chartContainer);
      this.container.appendChild(resizeHandle);
      document.body.appendChild(this.container);

      // Set up drag and resize
      this.dragHandler.attach(header);
      this.resizeHandler.attach(resizeHandle);
    },

    createControlButton: function (text, onClick) {
      var button = document.createElement("button");
      button.textContent = text;
      button.style.cssText =
        "background: transparent;" +
        "border: none;" +
        "color: #d1d4dc;" +
        "font-size: 18px;" +
        "cursor: pointer;" +
        "padding: 4px 8px;" +
        "border-radius: 4px;" +
        "transition: background 0.2s;";

      button.onmouseover = function () {
        button.style.background = "#2a2e39";
      };
      button.onmouseout = function () {
        button.style.background = "transparent";
      };
      button.onclick = onClick;
      return button;
    },

    toggleVisibility: function () {
      console.log("FloatingTradingView: Toggling visibility");
      this.isVisible = !this.isVisible;
      this.container.style.display = this.isVisible ? "block" : "none";

      if (this.isVisible && !this.widget) {
        console.log("FloatingTradingView: Loading widget...");
        this.loadTradingViewWidget();
      }

      // Notify background script
      chrome.runtime.sendMessage({
        action: "updateVisibility",
        isVisible: this.isVisible,
      });
    },

    toggleMinimize: function () {
      this.isMinimized = !this.isMinimized;
      if (this.isMinimized) {
        this.container.style.height = "35px";
        this.chartContainer.style.display = "none";
      } else {
        this.container.style.height = this.settings.height + "px";
        this.chartContainer.style.display = "block";
      }
    },

    showSettings: function () {
      chrome.runtime.sendMessage({ action: "openSettings" });
    },

    loadTradingViewWidget: function () {
      console.log("FloatingTradingView: Loading TradingView widget");
      var self = this;

      // Clear existing content
      this.chartContainer.innerHTML = "";

      // Create iframe to bypass CSP restrictions
      var iframe = document.createElement("iframe");
      iframe.style.cssText =
        "width: 100%;" + "height: 100%;" + "border: none;" + "display: block;";

      // Use TradingView's embed URL with proper configuration
      var widgetConfig = {
        symbol: this.settings.symbol,
        interval: this.settings.interval,
        timezone: "Etc/UTC",
        theme: this.settings.theme,
        style: this.settings.style,
        locale: "en",
        toolbar_bg: "#f1f3f6",
        enable_publishing: false,
        allow_symbol_change: true,
        hide_side_toolbar: false,
        studies: [],
        show_popup_button: false,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        container_id: "tradingview_widget",
      };

      // Create the widget HTML content with proper sizing
      var widgetHtml =
        "<!DOCTYPE html>" +
        '<html style="height: 100%; margin: 0; padding: 0;">' +
        "<head>" +
        '<meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">' +
        "<style>" +
        "html, body { " +
        "  height: 100%; " +
        "  margin: 0; " +
        "  padding: 0; " +
        "  overflow: hidden; " +
        "  background: #131722; " +
        "}" +
        ".tradingview-widget-container { " +
        "  position: absolute; " +
        "  top: 0; " +
        "  left: 0; " +
        "  right: 0; " +
        "  bottom: 0; " +
        "  width: 100%; " +
        "  height: 100%; " +
        "}" +
        "#tradingview_widget { " +
        "  width: 100%; " +
        "  height: 100%; " +
        "}" +
        "</style>" +
        "</head>" +
        "<body>" +
        '<div class="tradingview-widget-container">' +
        '<div id="tradingview_widget"></div>' +
        "</div>" +
        '<script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>' +
        '<script type="text/javascript">' +
        'window.addEventListener("DOMContentLoaded", function() {' +
        "  setTimeout(function() {" +
        "    new TradingView.widget({" +
        '      "autosize": true,' +
        '      "symbol": "' +
        widgetConfig.symbol +
        '",' +
        '      "interval": "' +
        widgetConfig.interval +
        '",' +
        '      "timezone": "' +
        widgetConfig.timezone +
        '",' +
        '      "theme": "' +
        widgetConfig.theme +
        '",' +
        '      "style": "' +
        widgetConfig.style +
        '",' +
        '      "locale": "' +
        widgetConfig.locale +
        '",' +
        '      "toolbar_bg": "' +
        widgetConfig.toolbar_bg +
        '",' +
        '      "enable_publishing": ' +
        widgetConfig.enable_publishing +
        "," +
        '      "allow_symbol_change": ' +
        widgetConfig.allow_symbol_change +
        "," +
        '      "container_id": "' +
        widgetConfig.container_id +
        '",' +
        '      "hide_side_toolbar": ' +
        widgetConfig.hide_side_toolbar +
        "," +
        '      "hide_top_toolbar": ' +
        widgetConfig.hide_top_toolbar +
        "," +
        '      "hide_legend": ' +
        widgetConfig.hide_legend +
        "," +
        '      "save_image": ' +
        widgetConfig.save_image +
        "," +
        '      "withdateranges": true' +
        "    });" +
        "  }, 100);" +
        "});" +
        "</script>" +
        "</body>" +
        "</html>";

      // Set iframe content
      iframe.onload = function () {
        console.log("FloatingTradingView: Widget iframe loaded");
      };

      // Use data URL to load the content
      iframe.src =
        "data:text/html;charset=utf-8," + encodeURIComponent(widgetHtml);

      this.chartContainer.appendChild(iframe);
      this.widget = iframe;
    },

    handleMessage: function (request, sendResponse) {
      switch (request.action) {
        case "toggle":
          this.toggleVisibility();
          sendResponse({ success: true });
          break;
        case "updateSettings":
          Object.assign(this.settings, request.settings);
          this.saveSettings();
          this.applySettings();
          sendResponse({ success: true });
          break;
        case "getStatus":
          sendResponse({ isVisible: this.isVisible, settings: this.settings });
          break;
        default:
          sendResponse({ success: false });
      }
    },

    applySettings: function () {
      // Update opacity
      this.container.style.opacity = this.settings.opacity;

      // Reload widget if symbol or interval changed
      if (this.widget) {
        this.loadTradingViewWidget();
      }
    },
  };

  // Professional Drag Handler
  function DragHandler(parent) {
    this.parent = parent;
    this.element = null;
    this.active = false;
    this.currentX = 0;
    this.currentY = 0;
    this.initialX = 0;
    this.initialY = 0;
    this.xOffset = 0;
    this.yOffset = 0;

    // Bind methods
    this.handleStart = this.handleStart.bind(this);
    this.handleMove = this.handleMove.bind(this);
    this.handleEnd = this.handleEnd.bind(this);
  }

  DragHandler.prototype.attach = function (element) {
    this.element = element;

    // Use pointer events for better performance
    if (window.PointerEvent) {
      this.element.addEventListener("pointerdown", this.handleStart);
    } else {
      this.element.addEventListener("mousedown", this.handleStart);
      this.element.addEventListener("touchstart", this.handleStart);
    }
  };

  DragHandler.prototype.handleStart = function (e) {
    if (e.target.closest("button")) return;

    // Get initial positions
    var rect = this.parent.container.getBoundingClientRect();
    this.initialX = e.clientX || e.touches[0].clientX;
    this.initialY = e.clientY || e.touches[0].clientY;
    this.xOffset = this.initialX - rect.left;
    this.yOffset = this.initialY - rect.top;

    this.active = true;

    // Disable transitions
    this.parent.container.style.transition = "none";
    this.parent.container.classList.add("dragging");

    // Set capture for reliable tracking
    if (e.type === "pointerdown") {
      this.element.setPointerCapture(e.pointerId);
      document.addEventListener("pointermove", this.handleMove);
      document.addEventListener("pointerup", this.handleEnd);
    } else if (e.type === "mousedown") {
      document.addEventListener("mousemove", this.handleMove);
      document.addEventListener("mouseup", this.handleEnd);
    } else if (e.type === "touchstart") {
      document.addEventListener("touchmove", this.handleMove, {
        passive: false,
      });
      document.addEventListener("touchend", this.handleEnd);
    }

    e.preventDefault();
  };

  DragHandler.prototype.handleMove = function (e) {
    if (!this.active) return;

    e.preventDefault();

    this.currentX = (e.clientX || e.touches[0].clientX) - this.xOffset;
    this.currentY = (e.clientY || e.touches[0].clientY) - this.yOffset;

    // Constrain to viewport
    var maxX = window.innerWidth - this.parent.container.offsetWidth;
    var maxY = window.innerHeight - this.parent.container.offsetHeight;

    this.currentX = Math.max(0, Math.min(this.currentX, maxX));
    this.currentY = Math.max(0, Math.min(this.currentY, maxY));

    // Apply position
    this.parent.container.style.left = this.currentX + "px";
    this.parent.container.style.top = this.currentY + "px";
  };

  DragHandler.prototype.handleEnd = function (e) {
    if (!this.active) return;

    this.active = false;

    // Release capture
    if (e.type === "pointerup" && this.element.releasePointerCapture) {
      this.element.releasePointerCapture(e.pointerId);
    }

    // Remove event listeners
    document.removeEventListener("pointermove", this.handleMove);
    document.removeEventListener("pointerup", this.handleEnd);
    document.removeEventListener("mousemove", this.handleMove);
    document.removeEventListener("mouseup", this.handleEnd);
    document.removeEventListener("touchmove", this.handleMove);
    document.removeEventListener("touchend", this.handleEnd);

    // Re-enable transitions
    setTimeout(() => {
      this.parent.container.style.transition = "opacity 0.3s ease";
      this.parent.container.classList.remove("dragging");
    }, 0);

    // Save position
    this.parent.settings.x = parseInt(this.parent.container.style.left, 10);
    this.parent.settings.y = parseInt(this.parent.container.style.top, 10);
    this.parent.saveSettings();
  };

  // Professional Resize Handler
  function ResizeHandler(parent) {
    this.parent = parent;
    this.element = null;
    this.active = false;
    this.startX = 0;
    this.startY = 0;
    this.startWidth = 0;
    this.startHeight = 0;

    // Bind methods
    this.handleStart = this.handleStart.bind(this);
    this.handleMove = this.handleMove.bind(this);
    this.handleEnd = this.handleEnd.bind(this);
  }

  ResizeHandler.prototype.attach = function (element) {
    this.element = element;

    // Use pointer events for better performance
    if (window.PointerEvent) {
      this.element.addEventListener("pointerdown", this.handleStart);
    } else {
      this.element.addEventListener("mousedown", this.handleStart);
      this.element.addEventListener("touchstart", this.handleStart);
    }
  };

  ResizeHandler.prototype.handleStart = function (e) {
    this.startX = e.clientX || e.touches[0].clientX;
    this.startY = e.clientY || e.touches[0].clientY;
    this.startWidth = parseInt(this.parent.container.style.width, 10);
    this.startHeight = parseInt(this.parent.container.style.height, 10);

    this.active = true;

    // Disable transitions
    this.parent.container.style.transition = "none";
    this.parent.container.classList.add("resizing");

    // Set capture for reliable tracking
    if (e.type === "pointerdown") {
      this.element.setPointerCapture(e.pointerId);
      document.addEventListener("pointermove", this.handleMove);
      document.addEventListener("pointerup", this.handleEnd);
    } else if (e.type === "mousedown") {
      document.addEventListener("mousemove", this.handleMove);
      document.addEventListener("mouseup", this.handleEnd);
    } else if (e.type === "touchstart") {
      document.addEventListener("touchmove", this.handleMove, {
        passive: false,
      });
      document.addEventListener("touchend", this.handleEnd);
    }

    e.preventDefault();
  };

  ResizeHandler.prototype.handleMove = function (e) {
    if (!this.active) return;

    e.preventDefault();

    var currentX = e.clientX || e.touches[0].clientX;
    var currentY = e.clientY || e.touches[0].clientY;

    var newWidth = this.startWidth + (currentX - this.startX);
    var newHeight = this.startHeight + (currentY - this.startY);

    // Apply constraints
    var containerRect = this.parent.container.getBoundingClientRect();
    var maxWidth = window.innerWidth - containerRect.left - 20;
    var maxHeight = window.innerHeight - containerRect.top - 20;

    newWidth = Math.max(300, Math.min(newWidth, maxWidth));
    newHeight = Math.max(200, Math.min(newHeight, maxHeight));

    this.parent.container.style.width = newWidth + "px";
    this.parent.container.style.height = newHeight + "px";
  };

  ResizeHandler.prototype.handleEnd = function (e) {
    if (!this.active) return;

    this.active = false;

    // Release capture
    if (e.type === "pointerup" && this.element.releasePointerCapture) {
      this.element.releasePointerCapture(e.pointerId);
    }

    // Remove event listeners
    document.removeEventListener("pointermove", this.handleMove);
    document.removeEventListener("pointerup", this.handleEnd);
    document.removeEventListener("mousemove", this.handleMove);
    document.removeEventListener("mouseup", this.handleEnd);
    document.removeEventListener("touchmove", this.handleMove);
    document.removeEventListener("touchend", this.handleEnd);

    // Re-enable transitions
    setTimeout(() => {
      this.parent.container.style.transition = "opacity 0.3s ease";
      this.parent.container.classList.remove("resizing");
    }, 0);

    // Save size
    this.parent.settings.width = parseInt(
      this.parent.container.style.width,
      10
    );
    this.parent.settings.height = parseInt(
      this.parent.container.style.height,
      10
    );
    this.parent.saveSettings();
  };

  // Initialize
  floatingTV.init();

  // Make it accessible for debugging
  window.floatingTV = floatingTV;
})();
