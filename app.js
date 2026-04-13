// Main application logic for Floating TradingView Desktop
class FloatingTradingViewApp {
  constructor() {
    this.settings = {
      symbol: 'BTCUSD',
      interval: 'D',
      theme: 'dark',
      style: '0',
      alwaysOnTop: true
    };
    
    this.widget = null;
    this.isLoading = false;
    this.loadAttempts = 0;
    this.maxAttempts = 3;
    
    this.init();
  }

  async init() {
    console.log('Initializing Floating TradingView Desktop App');
    
    // Load settings from Electron store
    try {
      this.settings = await window.electronAPI.getSettings();
    } catch (error) {
      console.log('Using default settings');
    }
    
    // Setup UI event handlers
    this.setupEventHandlers();
    
    // Load the widget
    this.loadWidget();
    
    // Listen for settings show event from main process
    window.electronAPI.onShowSettings(() => {
      this.showSettings();
    });
  }

  setupEventHandlers() {
    // Control buttons
    const settingsBtn = document.getElementById('settingsBtn');
    const minimizeBtn = document.getElementById('minimizeBtn');
    const closeBtn = document.getElementById('closeBtn');

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.showSettings();
      });
    }

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', async () => {
        try {
          await window.electronAPI.minimizeWindow();
        } catch (error) {
          console.error('Failed to minimize window:', error);
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', async () => {
        try {
          await window.electronAPI.closeWindow();
        } catch (error) {
          console.error('Failed to close window:', error);
        }
      });
    }

    // Settings panel handlers
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');

    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => {
        this.saveSettings();
      });
    }

    if (cancelSettingsBtn) {
      cancelSettingsBtn.addEventListener('click', () => {
        this.hideSettings();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case ',':
            e.preventDefault();
            this.showSettings();
            break;
          case 'r':
            e.preventDefault();
            this.reloadWidget();
            break;
        }
      }
      
      if (e.key === 'Escape') {
        this.hideSettings();
      }
    });
  }

  loadWidget() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.loadAttempts++;
    
    console.log(`Loading widget (attempt ${this.loadAttempts}/${this.maxAttempts})`);
    
    const chartContainer = document.getElementById('chartContainer');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    if (loadingIndicator) {
      loadingIndicator.textContent = `Loading ${this.settings.symbol} chart...`;
      loadingIndicator.style.display = 'block';
    }

    // Clear existing widget
    if (chartContainer) {
      const existingWidget = chartContainer.querySelector('.tradingview-widget-container');
      if (existingWidget) {
        existingWidget.remove();
      }
    }

    // Try different loading methods
    if (this.loadAttempts === 1) {
      this.tryLightweightWidget();
    } else if (this.loadAttempts === 2) {
      this.tryAdvancedWidget();
    } else {
      this.showFallbackWidget();
    }
  }

  tryLightweightWidget() {
    console.log('Trying lightweight widget');
    
    const chartContainer = document.getElementById('chartContainer');
    
    try {
      // Create TradingView lightweight widget
      const widgetConfig = {
        "width": "100%",
        "height": "100%",
        "symbol": this.settings.symbol,
        "interval": this.settings.interval,
        "timezone": "Etc/UTC",
        "theme": this.settings.theme,
        "style": this.settings.style,
        "locale": "en",
        "toolbar_bg": this.settings.theme === 'dark' ? "#131722" : "#ffffff",
        "enable_publishing": false,
        "backgroundColor": this.settings.theme === 'dark' ? "#131722" : "#ffffff",
        "gridColor": this.settings.theme === 'dark' ? "#2A2E39" : "#e1ecf4",
        "hide_top_toolbar": false,
        "hide_legend": false,
        "save_image": false,
        "calendar": false,
        "support_host": "https://www.tradingview.com"
      };

      const widgetHtml = `
        <div class="tradingview-widget-container" style="width: 100%; height: 100%;">
          <div class="tradingview-widget-container__widget" style="width: 100%; height: 100%;"></div>
          <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>
          ${JSON.stringify(widgetConfig)}
          </script>
        </div>
      `;

      chartContainer.innerHTML = widgetHtml;
      
      // Check if widget loads successfully
      setTimeout(() => {
        const iframe = chartContainer.querySelector('iframe');
        if (iframe && iframe.src && iframe.src.includes('tradingview.com')) {
          console.log('Lightweight widget loaded successfully');
          this.onWidgetLoaded();
        } else {
          console.log('Lightweight widget failed, trying next method');
          this.loadWidget();
        }
      }, 5000);

    } catch (error) {
      console.error('Lightweight widget error:', error);
      this.loadWidget();
    }
  }

  tryAdvancedWidget() {
    console.log('Trying advanced widget');
    
    const chartContainer = document.getElementById('chartContainer');
    
    try {
      // Create advanced TradingView widget with direct script loading
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      
      script.onload = () => {
        setTimeout(() => {
          if (typeof TradingView !== 'undefined' && TradingView.widget) {
            const widgetContainer = document.createElement('div');
            widgetContainer.id = 'tradingview_widget_' + Date.now();
            widgetContainer.style.cssText = 'width: 100%; height: 100%;';
            
            chartContainer.appendChild(widgetContainer);
            
            new TradingView.widget({
              width: '100%',
              height: '100%',
              symbol: this.settings.symbol,
              interval: this.settings.interval,
              timezone: "Etc/UTC",
              theme: this.settings.theme,
              style: this.settings.style,
              locale: "en",
              toolbar_bg: this.settings.theme === 'dark' ? "#131722" : "#f1f3f6",
              enable_publishing: false,
              allow_symbol_change: true,
              hideideas: true,
              hide_top_toolbar: false,
              hide_legend: false,
              save_image: false,
              container_id: widgetContainer.id,
              onChartReady: () => {
                console.log('Advanced widget loaded successfully');
                this.onWidgetLoaded();
              }
            });
          } else {
            console.log('TradingView library not available, trying fallback');
            this.loadWidget();
          }
        }, 1000);
      };
      
      script.onerror = () => {
        console.log('Advanced widget script failed, trying fallback');
        this.loadWidget();
      };
      
      document.head.appendChild(script);

    } catch (error) {
      console.error('Advanced widget error:', error);
      this.loadWidget();
    }
  }

  showFallbackWidget() {
    console.log('Showing fallback widget');
    
    const chartContainer = document.getElementById('chartContainer');
    
    const fallbackHtml = `
      <div class="error-message">
        <h3>${this.settings.symbol}</h3>
        <p>Interval: ${this.settings.interval}</p>
        <p>Theme: ${this.settings.theme}</p>
        <p style="margin: 20px 0; font-size: 12px; opacity: 0.8;">
          Chart widget could not be loaded. This may be due to network restrictions.
        </p>
        <button onclick="window.open('https://www.tradingview.com/chart/?symbol=${encodeURIComponent(this.settings.symbol)}&interval=${encodeURIComponent(this.settings.interval)}')">
          Open in TradingView
        </button>
        <button onclick="location.reload()">
          Retry
        </button>
        <button onclick="floatingApp.showSettings()">
          Settings
        </button>
      </div>
    `;
    
    chartContainer.innerHTML = fallbackHtml;
    this.onWidgetLoaded();
  }

  onWidgetLoaded() {
    this.isLoading = false;
    this.loadAttempts = 0;
    
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
    
    console.log('Widget loaded successfully');
  }

  reloadWidget() {
    console.log('Reloading widget');
    this.loadAttempts = 0;
    this.loadWidget();
  }

  showSettings() {
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel) {
      // Populate current settings
      const symbolInput = document.getElementById('symbolInput');
      const intervalSelect = document.getElementById('intervalSelect');
      const themeSelect = document.getElementById('themeSelect');
      const styleSelect = document.getElementById('styleSelect');

      if (symbolInput) symbolInput.value = this.settings.symbol;
      if (intervalSelect) intervalSelect.value = this.settings.interval;
      if (themeSelect) themeSelect.value = this.settings.theme;
      if (styleSelect) styleSelect.value = this.settings.style;

      settingsPanel.style.display = 'flex';
    }
  }

  hideSettings() {
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel) {
      settingsPanel.style.display = 'none';
    }
  }

  async saveSettings() {
    // Get values from form
    const symbolInput = document.getElementById('symbolInput');
    const intervalSelect = document.getElementById('intervalSelect');
    const themeSelect = document.getElementById('themeSelect');
    const styleSelect = document.getElementById('styleSelect');

    const newSettings = {
      symbol: symbolInput ? symbolInput.value.toUpperCase() : this.settings.symbol,
      interval: intervalSelect ? intervalSelect.value : this.settings.interval,
      theme: themeSelect ? themeSelect.value : this.settings.theme,
      style: styleSelect ? styleSelect.value : this.settings.style
    };

    // Validate symbol
    if (!newSettings.symbol || newSettings.symbol.length < 2) {
      alert('Please enter a valid symbol');
      return;
    }

    // Save settings via Electron API
    try {
      this.settings = await window.electronAPI.saveSettings(newSettings);
      console.log('Settings saved:', this.settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }

    // Hide settings panel
    this.hideSettings();

    // Reload widget with new settings
    this.reloadWidget();
  }
}

// Initialize the app when DOM is loaded
let floatingApp;
document.addEventListener('DOMContentLoaded', () => {
  floatingApp = new FloatingTradingViewApp();
});

// Make app globally available for fallback buttons
window.floatingApp = floatingApp;