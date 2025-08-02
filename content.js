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

      // Request current global state from background
      chrome.runtime.sendMessage(
        { action: "getGlobalState" },
        function (state) {
          if (state) {
            self.isVisible = state.isVisible;
            self.isMinimized = state.isMinimized;
            self.settings = state.settings;
          }

          // Create floating window
          self.createFloatingWindow();

          // Show widget if it was visible
          if (self.isVisible) {
            self.container.style.display = "block";
            if (!self.widget) {
              self.loadTradingViewWidget();
            }
          }

          console.log("FloatingTradingView: Initialization complete");
        }
      );

      // Listen for messages from popup and background
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

      // Refresh button
      var refreshBtn = this.createControlButton("↻", function () {
        self.widget = null;
        self.loadTradingViewWidget();
      });

      controls.appendChild(minimizeBtn);
      controls.appendChild(refreshBtn);
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

      // Apply minimized state if needed
      if (this.isMinimized) {
        this.container.style.height = "35px";
        this.chartContainer.style.display = "none";
      }

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

      // Update global state
      this.updateGlobalState();
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

      // Update global state
      this.updateGlobalState();
    },

    showSettings: function () {
      chrome.runtime.sendMessage({ action: "openSettings" });
    },

    loadTradingViewWidget: function () {
      console.log("FloatingTradingView: Loading TradingView widget");
      var self = this;
      var retryCount = 0;
      var maxRetries = 3;

      function attemptLoad() {
        // Clear existing content
        self.chartContainer.innerHTML = "";

        // Show loading indicator
        var loadingDiv = document.createElement("div");
        loadingDiv.style.cssText =
          "position: absolute;" +
          "top: 50%;" +
          "left: 50%;" +
          "transform: translate(-50%, -50%);" +
          "color: #787b86;" +
          "font-size: 14px;" +
          'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
        loadingDiv.textContent = "Loading chart...";
        self.chartContainer.appendChild(loadingDiv);

        // Create iframe
        var iframe = document.createElement("iframe");
        iframe.style.cssText =
          "width: 100%;" +
          "height: 100%;" +
          "border: none;" +
          "display: block;" +
          "opacity: 0;" +
          "transition: opacity 0.3s ease;";

        // Set sandbox attributes to bypass CSP
        iframe.setAttribute(
          "sandbox",
          "allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        );

        // Add error handling
        var loadTimeout;
        var hasLoaded = false;

        iframe.onload = function () {
          // Give the widget time to initialize
          setTimeout(function () {
            clearTimeout(loadTimeout);
            hasLoaded = true;

            // Remove loading indicator
            if (loadingDiv.parentNode) {
              loadingDiv.parentNode.removeChild(loadingDiv);
            }

            // Fade in the iframe
            iframe.style.opacity = "1";
            console.log(
              "FloatingTradingView: Widget iframe loaded successfully"
            );
          }, 1000);
        };

        iframe.onerror = function () {
          console.error("FloatingTradingView: Widget iframe failed to load");
          handleLoadError();
        };

        // Set timeout for load
        loadTimeout = setTimeout(function () {
          if (!hasLoaded) {
            console.error("FloatingTradingView: Widget load timeout");
            handleLoadError();
          }
        }, 15000); // 15 second timeout

        function handleLoadError() {
          clearTimeout(loadTimeout);
          retryCount++;

          if (retryCount <= maxRetries) {
            console.log(
              "FloatingTradingView: Retrying load (attempt " + retryCount + ")"
            );
            setTimeout(attemptLoad, 2000);
          } else {
            // Show error message with reload button
            self.chartContainer.innerHTML = "";
            var errorDiv = document.createElement("div");
            errorDiv.style.cssText =
              "position: absolute;" +
              "top: 50%;" +
              "left: 50%;" +
              "transform: translate(-50%, -50%);" +
              "text-align: center;" +
              "color: #787b86;" +
              'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';

            var errorMsg = document.createElement("div");
            errorMsg.textContent = "Failed to load TradingView";
            errorMsg.style.marginBottom = "10px";

            var reloadBtn = document.createElement("button");
            reloadBtn.textContent = "Reload";
            reloadBtn.style.cssText =
              "background: #2196F3;" +
              "color: white;" +
              "border: none;" +
              "padding: 8px 16px;" +
              "border-radius: 4px;" +
              "cursor: pointer;" +
              "font-size: 14px;";
            reloadBtn.onclick = function () {
              retryCount = 0;
              attemptLoad();
            };

            errorDiv.appendChild(errorMsg);
            errorDiv.appendChild(reloadBtn);
            self.chartContainer.appendChild(errorDiv);
          }
        }

        // Create a blob URL instead of data URL for better compatibility
        var widgetHtml =
          "<!DOCTYPE html>\n" +
          "<html>\n" +
          "<head>\n" +
          '<meta charset="utf-8">\n' +
          '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
          "<title>TradingView Widget</title>\n" +
          "<style>\n" +
          "html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; background: #131722; }\n" +
          ".tradingview-widget-container { position: absolute; inset: 0; }\n" +
          "#tradingview_widget { width: 100%; height: 100%; }\n" +
          ".loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #787b86; font-family: sans-serif; }\n" +
          "</style>\n" +
          "</head>\n" +
          "<body>\n" +
          '<div class="loading">Initializing chart...</div>\n' +
          '<div class="tradingview-widget-container">\n' +
          '<div id="tradingview_widget"></div>\n' +
          "</div>\n" +
          '<script type="text/javascript">\n' +
          "var scriptLoaded = false;\n" +
          "var widgetCreated = false;\n" +
          "function createWidget() {\n" +
          "  if (widgetCreated) return;\n" +
          "  try {\n" +
          '    if (typeof TradingView !== "undefined" && TradingView.widget) {\n' +
          '      document.querySelector(".loading").style.display = "none";\n' +
          "      new TradingView.widget({\n" +
          '        "autosize": true,\n' +
          '        "symbol": "' +
          self.settings.symbol +
          '",\n' +
          '        "interval": "' +
          self.settings.interval +
          '",\n' +
          '        "timezone": "Etc/UTC",\n' +
          '        "theme": "' +
          self.settings.theme +
          '",\n' +
          '        "style": "' +
          self.settings.style +
          '",\n' +
          '        "locale": "en",\n' +
          '        "toolbar_bg": "#f1f3f6",\n' +
          '        "enable_publishing": false,\n' +
          '        "allow_symbol_change": true,\n' +
          '        "container_id": "tradingview_widget",\n' +
          '        "hide_side_toolbar": false,\n' +
          '        "hide_top_toolbar": false,\n' +
          '        "hide_legend": false,\n' +
          '        "save_image": false,\n' +
          '        "studies": [],\n' +
          '        "show_popup_button": false\n' +
          "      });\n" +
          "      widgetCreated = true;\n" +
          "    } else {\n" +
          "      setTimeout(createWidget, 100);\n" +
          "    }\n" +
          "  } catch (e) {\n" +
          '    console.error("Widget error:", e);\n' +
          '    document.querySelector(".loading").textContent = "Error: " + e.message;\n' +
          "  }\n" +
          "}\n" +
          "function loadScript() {\n" +
          '  var script = document.createElement("script");\n' +
          '  script.type = "text/javascript";\n' +
          '  script.src = "https://s3.tradingview.com/tv.js";\n' +
          "  script.onload = function() {\n" +
          "    scriptLoaded = true;\n" +
          "    setTimeout(createWidget, 500);\n" +
          "  };\n" +
          "  script.onerror = function() {\n" +
          '    document.querySelector(".loading").textContent = "Failed to load TradingView library";\n' +
          "  };\n" +
          "  document.head.appendChild(script);\n" +
          "}\n" +
          'if (document.readyState === "loading") {\n' +
          '  document.addEventListener("DOMContentLoaded", loadScript);\n' +
          "} else {\n" +
          "  loadScript();\n" +
          "}\n" +
          "</script>\n" +
          "</body>\n" +
          "</html>";

        // Create blob URL
        var blob = new Blob([widgetHtml], { type: "text/html" });
        var blobUrl = URL.createObjectURL(blob);

        // Set iframe source
        iframe.src = blobUrl;

        // Clean up blob URL after load
        iframe.onload = function () {
          setTimeout(function () {
            URL.revokeObjectURL(blobUrl);
          }, 1000);

          // Call the original onload
          setTimeout(function () {
            clearTimeout(loadTimeout);
            hasLoaded = true;

            if (loadingDiv.parentNode) {
              loadingDiv.parentNode.removeChild(loadingDiv);
            }

            iframe.style.opacity = "1";
            console.log("FloatingTradingView: Widget loaded successfully");
          }, 1000);
        };

        self.chartContainer.appendChild(iframe);
        self.widget = iframe;
      }

      // Start loading
      attemptLoad();
    },

    updateGlobalState: function () {
      // Send state update to background script
      chrome.runtime.sendMessage({
        action: "updateGlobalState",
        state: {
          isVisible: this.isVisible,
          isMinimized: this.isMinimized,
          settings: this.settings,
        },
      });
    },

    handleMessage: function (request, sendResponse) {
      switch (request.action) {
        case "toggle":
          if (request.hasOwnProperty("isVisible")) {
            this.isVisible = request.isVisible;
            this.container.style.display = this.isVisible ? "block" : "none";
            if (this.isVisible && !this.widget) {
              this.loadTradingViewWidget();
            }
          } else {
            this.toggleVisibility();
          }
          sendResponse({ success: true });
          break;

        case "syncState":
          // Sync with global state from other tabs
          if (request.state) {
            this.isVisible = request.state.isVisible;
            this.isMinimized = request.state.isMinimized;
            this.settings = request.state.settings;

            // Update UI
            this.container.style.display = this.isVisible ? "block" : "none";
            this.container.style.left = this.settings.x + "px";
            this.container.style.top = this.settings.y + "px";
            this.container.style.width = this.settings.width + "px";
            this.container.style.height = this.isMinimized
              ? "35px"
              : this.settings.height + "px";
            this.container.style.opacity = this.settings.opacity;

            if (this.isMinimized) {
              this.chartContainer.style.display = "none";
            } else {
              this.chartContainer.style.display = "block";
            }

            // Load widget if needed
            if (this.isVisible && !this.widget) {
              this.loadTradingViewWidget();
            }
          }
          break;

        case "updateSettings":
          Object.assign(this.settings, request.settings);
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

      // Reload widget with new settings
      if (this.widget) {
        // Clear the widget first
        this.widget = null;
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
    this.parent.updateGlobalState();
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
    this.parent.updateGlobalState();
  };

  // Initialize
  floatingTV.init();

  // Make it accessible for debugging
  window.floatingTV = floatingTV;
})();
