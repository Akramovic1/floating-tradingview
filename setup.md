# Quick Setup Guide

## Prerequisites

1. **Install Node.js** (version 16 or higher):
   - Windows/Mac: Download from [nodejs.org](https://nodejs.org)
   - Check installation: `node --version`

## Installation Steps

### 1. Download the Code
```bash
# Option 1: Clone with Git
git clone https://github.com/Akramovic1/floating-tradingview.git
cd floating-tradingview

# Option 2: Download ZIP and extract
# Then navigate to the folder in terminal/command prompt
```

### 2. Install Dependencies
```bash
npm install
```

This will download and install:
- Electron (the desktop framework)
- Electron Builder (for creating executables)
- Electron Store (for saving settings)

### 3. Run the Application
```bash
npm start
```

The application should open in a new window!

## Building Executables

### For Your Current Platform
```bash
npm run build
```

### For Specific Platforms
```bash
# Windows executable
npm run build-win

# Mac application  
npm run build-mac

# All platforms
npm run build-all
```

Built files will be in the `dist/` folder.

## First Time Setup

1. **Run the app**: `npm start`
2. **Configure settings**: Click the gear icon ⚙
3. **Set your symbol**: e.g., BTCUSD, AAPL, TSLA
4. **Choose interval**: 1D for daily charts
5. **Save settings**: Click "Save & Apply"

## Troubleshooting

### "npm is not recognized"
- Node.js is not installed or not in PATH
- Reinstall Node.js and restart your terminal

### "Permission denied" (Mac/Linux)
```bash
sudo npm install
```

### Charts not loading
- Check internet connection
- Try a different symbol (AAPL, GOOGL)
- Restart the application

### Build fails
- Update Node.js to latest version
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` folder and run `npm install` again

## File Structure After Setup

```
floating-tradingview/
├── node_modules/       # Dependencies (created by npm install)
├── dist/              # Built executables (created by npm run build)
├── main.js            # Main application
├── app.js             # Frontend logic
├── index.html         # Main window
├── package.json       # Project configuration
└── README.md          # Full documentation
```

## Quick Commands

```bash
npm start           # Run the application
npm run dev         # Run in development mode
npm run build       # Build for current platform
npm install         # Install dependencies (first time only)
```

---

**Need help?** Check the full [README.md](README.md) or open an issue on GitHub!