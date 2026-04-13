// Content script for Floating TradingView Extension
(function () {
  "use strict";

  // Global widget instance - singleton pattern
  let floatingWidget = null;

  var FloatingTradingView = function (widgetId) {
    this.widgetId = widgetId;
    this.isVisible = false;
    this.isMinimized = false;
    this.widget = null;
    this.container = null;
    this.chartContainer = null;
    this.dragHandler = null;
    this.resizeHandler = null;
    this.initialized = false;
    this.lastWidgetLoad = 0;
    this.isLoading = false;
    this.settings = {
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
  };

  FloatingTradingView.prototype.init = function (state) {
    if (this.initialized) {
      return;
    }

    // Apply initial state
    if (state) {
      this.isVisible = state.isVisible;
      this.isMinimized = state.isMinimized;
      this.settings = state.settings;
    }

    // Initialize handlers
    this.dragHandler = new DragHandler(this);
    this.resizeHandler = new ResizeHandler(this);

    // Create floating window
    this.createFloatingWindow();

    // Show widget if it was visible
    if (this.isVisible) {
      this.show();
    }

    this.initialized = true;
  };

  FloatingTradingView.prototype.createFloatingWindow = function () {
    var self = this;

    // Check if container already exists
    if (this.container && this.container.parentNode) {
      return;
    }

    // Create container with unique ID
    this.container = document.createElement("div");
    this.container.id = "floating-tradingview-container-" + this.widgetId;
    this.container.className = "floating-tradingview-container";
    this.container.setAttribute("data-widget-id", this.widgetId);
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

    // Refresh button
    var refreshBtn = this.createControlButton("↻", function () {
      self.reloadWidget();
    });

    // Close button
    var closeBtn = this.createControlButton("✕", function () {
      // Send message to background to hide widget globally
      chrome.runtime.sendMessage({
        action: "toggleFromPopup"
      });
    });

    controls.appendChild(minimizeBtn);
    controls.appendChild(refreshBtn);
    controls.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(controls);

    // Chart container
    this.chartContainer = document.createElement("div");
    this.chartContainer.className = "tradingview-widget-container";
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
  };

  FloatingTradingView.prototype.createControlButton = function (text, onClick) {
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
  };

  FloatingTradingView.prototype.show = function () {
    if (!this.container) return;

    this.isVisible = true;
    this.container.style.display = "block";

    // Ensure widget is within viewport bounds
    setTimeout(() => {
      this.constrainToViewport();
    }, 100);

    // Load widget if not loaded yet
    if (!this.widget || !this.lastWidgetLoad) {
      this.loadTradingViewWidget();
    }
  };

  FloatingTradingView.prototype.hide = function () {
    if (!this.container) return;

    this.isVisible = false;
    this.container.style.display = "none";
  };


  FloatingTradingView.prototype.toggleMinimize = function () {
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
  };


  FloatingTradingView.prototype.reloadWidget = function () {
    this.widget = null;
    this.loadTradingViewWidget();
  };

  FloatingTradingView.prototype.loadTradingViewWidget = function () {
    var self = this;

    // Prevent multiple simultaneous loads
    if (this.isLoading) return;
    this.isLoading = true;

    // Clear existing content
    this.chartContainer.innerHTML = "";

    // Show loading indicator
    var loadingDiv = document.createElement("div");
    loadingDiv.style.cssText =
      "position: absolute;" +
      "top: 50%;" +
      "left: 50%;" +
      "transform: translate(-50%, -50%);" +
      "color: #787b86;" +
      "font-size: 14px;" +
      "text-align: center;" +
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
    loadingDiv.textContent = "Loading TradingView chart...";
    this.chartContainer.appendChild(loadingDiv);

    // Create widget container for direct embedding
    var widgetContainer = document.createElement("div");
    widgetContainer.id = "tradingview_widget_" + Date.now();
    widgetContainer.style.cssText = 
      "width: 100%;" +
      "height: 100%;" +
      "position: relative;";

    this.chartContainer.appendChild(widgetContainer);

    // Try multiple approaches in sequence
    var attempts = 0;
    var maxAttempts = 3;
    
    function tryNext() {
      attempts++;
      
      if (attempts === 1) {
        // First: Try lightweight widget
        loadingDiv.textContent = "Loading TradingView widget...";
        self.tryLightweightWidget(loadingDiv, tryNext);
      } else if (attempts === 2) {
        // Second: Try direct widget
        loadingDiv.textContent = "Loading chart (method 2)...";
        self.loadTradingViewScript(function() {
          self.createDirectWidget(widgetContainer, loadingDiv);
        }, tryNext);
      } else {
        // Final: Fallback display
        loadingDiv.textContent = "Loading fallback display...";
        self.loadFallbackWidget(loadingDiv, null);
      }
    }
    
    tryNext();
  };

  FloatingTradingView.prototype.loadTradingViewScript = function(onSuccess, onError) {
    var self = this;
    
    // Check if TradingView is already loaded
    if (typeof window.TradingView !== 'undefined' && window.TradingView.widget) {
      onSuccess();
      return;
    }

    // Try to load TradingView script
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    
    var timeout = setTimeout(function() {
      onError();
    }, 10000);

    script.onload = function() {
      clearTimeout(timeout);
      // Wait a bit for TradingView to fully initialize
      setTimeout(function() {
        if (typeof window.TradingView !== 'undefined' && window.TradingView.widget) {
          onSuccess();
        } else {
          onError();
        }
      }, 500);
    };

    script.onerror = function() {
      clearTimeout(timeout);
      onError();
    };

    document.head.appendChild(script);
  };

  FloatingTradingView.prototype.createDirectWidget = function(container, loadingDiv) {
    var self = this;

    try {
      // Create TradingView widget directly
      new window.TradingView.widget({
        width: '100%',
        height: '100%',
        symbol: this.settings.symbol,
        interval: this.settings.interval,
        timezone: "Etc/UTC",
        theme: this.settings.theme,
        style: this.settings.style.toString(),
        locale: "en",
        toolbar_bg: this.settings.theme === 'dark' ? "#131722" : "#f1f3f6",
        enable_publishing: false,
        allow_symbol_change: true,
        hideideas: true,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        container_id: container.id,
        onChartReady: function() {
          if (loadingDiv && loadingDiv.parentNode) {
            loadingDiv.parentNode.removeChild(loadingDiv);
          }
          self.widget = container;
          self.lastWidgetLoad = Date.now();
          self.isLoading = false;
        }
      });
    } catch (error) {
      console.error('Direct TradingView widget creation failed:', error);
      this.loadFallbackWidget(loadingDiv);
    }
  };

  FloatingTradingView.prototype.loadFallbackWidget = function(loadingDiv) {
    var self = this;

    // Try lightweight widget approach first
    this.tryLightweightWidget(loadingDiv, function() {
      // If lightweight widget fails, show minimal chart info
      loadingDiv.innerHTML = 
        '<div style="text-align: center; color: #787b86; padding: 20px;">' +
        '<div style="margin-bottom: 15px; font-size: 16px; color: #d1d4dc;">' + self.settings.symbol + '</div>' +
        '<div style="font-size: 12px; margin-bottom: 5px;">Interval: ' + self.settings.interval + '</div>' +
        '<div style="font-size: 12px; margin-bottom: 15px;">Theme: ' + self.settings.theme + '</div>' +
        '<div style="margin: 15px 0; font-size: 11px; opacity: 0.8;">Chart loading restricted by website security policy</div>' +
        '<button onclick="window.open(\'https://www.tradingview.com/chart/?symbol=' + 
        encodeURIComponent(self.settings.symbol) + 
        '&interval=' + encodeURIComponent(self.settings.interval) +
        '\', \'_blank\')" style="margin:10px 5px;padding:8px 12px;background:#2196F3;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Open in TradingView</button>' +
        '<button onclick="location.reload()" style="margin:10px 5px;padding:8px 12px;background:#666;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Retry</button>' +
        '</div>';
      
      self.widget = loadingDiv;
      self.isLoading = false;
    });
  };

  FloatingTradingView.prototype.tryLightweightWidget = function(loadingDiv, onFallback) {
    var self = this;

    try {
      // Create TradingView widget HTML structure
      var widgetHtml = 
        '<div class="tradingview-widget-container" style="width: 100%; height: 100%;">' +
        '<div class="tradingview-widget-container__widget" style="width: 100%; height: 100%;"></div>' +
        '</div>';

      // Create script element for TradingView widget
      var scriptContent = {
        "width": "100%",
        "height": "100%",
        "symbol": this.settings.symbol,
        "interval": this.settings.interval,
        "timezone": "Etc/UTC",
        "theme": this.settings.theme,
        "style": this.settings.style.toString(),
        "locale": "en",
        "enable_publishing": false,
        "backgroundColor": this.settings.theme === 'dark' ? "#131722" : "#ffffff",
        "gridColor": this.settings.theme === 'dark' ? "#2A2E39" : "#e1ecf4",
        "hide_top_toolbar": false,
        "hide_legend": false,
        "save_image": false,
        "calendar": false,
        "support_host": "https://www.tradingview.com"
      };

      // Clear existing content and add widget HTML
      this.chartContainer.innerHTML = widgetHtml;
      
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      script.async = true;
      script.text = JSON.stringify(scriptContent);

      // Add script to widget container
      var widgetContainer = this.chartContainer.querySelector('.tradingview-widget-container');
      if (widgetContainer) {
        widgetContainer.appendChild(script);
      }

      // Hide loading div initially
      if (loadingDiv) {
        loadingDiv.style.display = 'none';
      }

      // Check for successful loading with multiple attempts
      var checkCount = 0;
      var checkInterval = setInterval(function() {
        checkCount++;
        
        var iframe = self.chartContainer.querySelector('iframe');
        if (iframe && iframe.src && iframe.src.includes('tradingview.com')) {
          clearInterval(checkInterval);
          self.widget = widgetContainer;
          self.lastWidgetLoad = Date.now();
          self.isLoading = false;
          console.log('TradingView lightweight widget loaded successfully');
          return;
        }
        
        // Give up after 10 seconds (20 checks)
        if (checkCount >= 20) {
          clearInterval(checkInterval);
          if (loadingDiv) {
            loadingDiv.style.display = 'block';
          }
          console.log('TradingView lightweight widget failed to load, trying fallback');
          if (onFallback) onFallback();
        }
      }, 500);

    } catch (error) {
      console.error('Lightweight widget setup failed:', error);
      if (onFallback) onFallback();
    }
  };

  FloatingTradingView.prototype.updateGlobalState = function () {
    // Send state update to background script (only from active widget)
    chrome.runtime.sendMessage({
      action: "updateGlobalState",
      widgetId: this.widgetId,
      state: {
        isVisible: this.isVisible,
        isMinimized: this.isMinimized,
        settings: this.settings,
      },
    }).catch(function(error) {
      // Handle connection errors gracefully
    });
  };


  FloatingTradingView.prototype.constrainToViewport = function () {
    if (!this.container) return;

    var rect = this.container.getBoundingClientRect();
    var viewportWidth = window.innerWidth;
    var viewportHeight = window.innerHeight;
    
    var newX = this.settings.x;
    var newY = this.settings.y;
    var changed = false;

    // Ensure widget doesn't go off screen horizontally
    if (rect.right > viewportWidth) {
      newX = viewportWidth - this.settings.width - 20;
      changed = true;
    }
    if (newX < 0) {
      newX = 20;
      changed = true;
    }

    // Ensure widget doesn't go off screen vertically
    if (rect.bottom > viewportHeight) {
      newY = viewportHeight - this.settings.height - 20;
      changed = true;
    }
    if (newY < 0) {
      newY = 20;
      changed = true;
    }

    // Apply new position if changed
    if (changed) {
      this.settings.x = newX;
      this.settings.y = newY;
      this.container.style.left = newX + "px";
      this.container.style.top = newY + "px";
      this.updateGlobalState();
    }
  };

  FloatingTradingView.prototype.destroy = function () {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.widget = null;
    this.initialized = false;
  };

  // Drag Handler
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

    this.handleStart = this.handleStart.bind(this);
    this.handleMove = this.handleMove.bind(this);
    this.handleEnd = this.handleEnd.bind(this);
  }

  DragHandler.prototype.attach = function (element) {
    this.element = element;
    this.element.addEventListener("mousedown", this.handleStart);
    this.element.addEventListener("touchstart", this.handleStart, {
      passive: false,
    });
  };

  DragHandler.prototype.handleStart = function (e) {
    if (e.target.closest("button")) return;

    var clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    var clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

    var rect = this.parent.container.getBoundingClientRect();
    this.xOffset = clientX - rect.left;
    this.yOffset = clientY - rect.top;

    this.active = true;
    this.parent.container.style.transition = "none";

    document.addEventListener("mousemove", this.handleMove);
    document.addEventListener("mouseup", this.handleEnd);
    document.addEventListener("touchmove", this.handleMove, { passive: false });
    document.addEventListener("touchend", this.handleEnd);

    e.preventDefault();
  };

  DragHandler.prototype.handleMove = function (e) {
    if (!this.active) return;

    e.preventDefault();

    var clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
    var clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

    this.currentX = clientX - this.xOffset;
    this.currentY = clientY - this.yOffset;

    // Constrain to viewport with margins
    var margin = 20;
    var containerWidth = this.parent.container.offsetWidth;
    var containerHeight = this.parent.container.offsetHeight;
    var maxX = window.innerWidth - containerWidth - margin;
    var maxY = window.innerHeight - containerHeight - margin;

    this.currentX = Math.max(margin, Math.min(this.currentX, maxX));
    this.currentY = Math.max(margin, Math.min(this.currentY, maxY));

    this.parent.container.style.left = this.currentX + "px";
    this.parent.container.style.top = this.currentY + "px";
  };

  DragHandler.prototype.handleEnd = function () {
    if (!this.active) return;

    this.active = false;

    document.removeEventListener("mousemove", this.handleMove);
    document.removeEventListener("mouseup", this.handleEnd);
    document.removeEventListener("touchmove", this.handleMove);
    document.removeEventListener("touchend", this.handleEnd);

    this.parent.container.style.transition = "opacity 0.3s ease";

    // Save position
    this.parent.settings.x = parseInt(this.parent.container.style.left, 10);
    this.parent.settings.y = parseInt(this.parent.container.style.top, 10);
    this.parent.updateGlobalState();
  };

  // Resize Handler
  function ResizeHandler(parent) {
    this.parent = parent;
    this.element = null;
    this.active = false;
    this.startX = 0;
    this.startY = 0;
    this.startWidth = 0;
    this.startHeight = 0;

    this.handleStart = this.handleStart.bind(this);
    this.handleMove = this.handleMove.bind(this);
    this.handleEnd = this.handleEnd.bind(this);
  }

  ResizeHandler.prototype.attach = function (element) {
    this.element = element;
    this.element.addEventListener("mousedown", this.handleStart);
    this.element.addEventListener("touchstart", this.handleStart, {
      passive: false,
    });
  };

  ResizeHandler.prototype.handleStart = function (e) {
    var clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    var clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

    this.startX = clientX;
    this.startY = clientY;
    this.startWidth = parseInt(this.parent.container.style.width, 10);
    this.startHeight = parseInt(this.parent.container.style.height, 10);

    this.active = true;
    this.parent.container.style.transition = "none";

    document.addEventListener("mousemove", this.handleMove);
    document.addEventListener("mouseup", this.handleEnd);
    document.addEventListener("touchmove", this.handleMove, { passive: false });
    document.addEventListener("touchend", this.handleEnd);

    e.preventDefault();
  };

  ResizeHandler.prototype.handleMove = function (e) {
    if (!this.active) return;

    e.preventDefault();

    var clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
    var clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

    var newWidth = this.startWidth + (clientX - this.startX);
    var newHeight = this.startHeight + (clientY - this.startY);

    // Apply constraints
    var containerRect = this.parent.container.getBoundingClientRect();
    var margin = 20;
    var maxWidth = window.innerWidth - containerRect.left - margin;
    var maxHeight = window.innerHeight - containerRect.top - margin;

    // Minimum and maximum size constraints
    var minWidth = 300;
    var minHeight = 200;
    var maxWidthLimit = Math.min(maxWidth, 1200); // Cap at reasonable size
    var maxHeightLimit = Math.min(maxHeight, 800);

    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidthLimit));
    newHeight = Math.max(minHeight, Math.min(newHeight, maxHeightLimit));

    this.parent.container.style.width = newWidth + "px";
    this.parent.container.style.height = newHeight + "px";
  };

  ResizeHandler.prototype.handleEnd = function () {
    if (!this.active) return;

    this.active = false;

    document.removeEventListener("mousemove", this.handleMove);
    document.removeEventListener("mouseup", this.handleEnd);
    document.removeEventListener("touchmove", this.handleMove);
    document.removeEventListener("touchend", this.handleEnd);

    this.parent.container.style.transition = "opacity 0.3s ease";

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

  // Message handler
  chrome.runtime.onMessage.addListener(function (
    request,
    sender,
    sendResponse
  ) {

    var widgetId = request.widgetId;

    switch (request.action) {
      case "createWidget":
        // Create the global widget (destroy any existing first)
        if (floatingWidget) {
          floatingWidget.destroy();
          floatingWidget = null;
        }

        if (widgetId) {
          floatingWidget = new FloatingTradingView(widgetId);
          floatingWidget.init(request.state);
          floatingWidget.show();
        }
        sendResponse({ success: true });
        break;

      case "destroyWidget":
        // Destroy the global widget
        if (floatingWidget) {
          floatingWidget.destroy();
          floatingWidget = null;
        }
        sendResponse({ success: true });
        break;

      case "updateSettings":
        // Update settings for the widget
        if (floatingWidget && floatingWidget.widgetId === widgetId) {
          Object.assign(floatingWidget.settings, request.settings);
          floatingWidget.container.style.opacity = floatingWidget.settings.opacity;
          
          // Only reload if symbol or interval changed
          var needsReload = false;
          if (floatingWidget.widget && floatingWidget.widget.src) {
            var currentUrl = new URL(floatingWidget.widget.src);
            var currentSymbol = currentUrl.searchParams.get("symbol");
            var currentInterval = currentUrl.searchParams.get("interval");

            if (currentSymbol !== floatingWidget.settings.symbol ||
                currentInterval !== floatingWidget.settings.interval) {
              needsReload = true;
            }
          }

          if (needsReload) {
            floatingWidget.reloadWidget();
          }
        }
        sendResponse({ success: true });
        break;

      case "getStatus":
        // Get status of the widget
        if (floatingWidget) {
          sendResponse({
            isVisible: floatingWidget.isVisible,
            settings: floatingWidget.settings,
            widgetId: floatingWidget.widgetId,
          });
        } else {
          sendResponse({ isVisible: false });
        }
        break;

      default:
        sendResponse({ success: false });
    }

    return true;
  });


  // Handle page visibility changes to prevent resource waste
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && floatingWidget) {
      // Page is hidden, widget will remain but won't update while hidden
    }
  });

  // Handle window resize to reposition widget within viewport bounds
  window.addEventListener("resize", function() {
    if (floatingWidget && floatingWidget.container && floatingWidget.isVisible) {
      floatingWidget.constrainToViewport();
    }
  });

  // Clean up on page unload
  window.addEventListener("beforeunload", function () {
    if (floatingWidget) {
      floatingWidget.destroy();
      floatingWidget = null;
    }
  });
})();
