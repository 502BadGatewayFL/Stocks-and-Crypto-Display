# StockDisplay

Fullscreen Windows touchscreen dashboard for NVIDIA, Bitcoin, and Marlin using Twelve Data market data.

The app is built with Electron and plain HTML/CSS/JS. It is meant for a small secondary display, kiosk screen, or touchscreen panel, but it also works on a normal monitor.

## Features

- One fullscreen page per asset: `NVDA`, `BTC/USD`, and `POND/USD`.
- Touch swipe, left/right edge tap, and keyboard arrow navigation.
- Canvas chart rendering for fast startup and low overhead.
- Local cache, so the last successful data is shown immediately.
- Configurable display target and refresh interval.
- Optional Windows startup shortcut.

## Setup

1. Install Node.js 22 or newer.
2. Run `npm install`.
3. If Electron does not unpack automatically, run `npm run prepare-electron`.
4. Copy `.env.example` to `.env`.
5. Put your Twelve Data key in `.env`:

```env
TWELVEDATA_API_KEY=your_key_here
```

6. Start the app:

```powershell
npm start
```

Do not commit `.env`. It is ignored by Git because it contains your API key.

## Display Configuration

Set `TARGET_DISPLAY` in `.env`.

Useful values:

```env
TARGET_DISPLAY=auto
TARGET_DISPLAY=primary
TARGET_DISPLAY=DISPLAY4
TARGET_DISPLAY=\\.\DISPLAY4
TARGET_DISPLAY=index:4
TARGET_DISPLAY=label:Waveshare
TARGET_DISPLAY=id:123456
```

`auto` prefers the 4th detected display, then the last non-primary display, then the primary display. This is a good default for small external panels.

On Windows, you can inspect displays with PowerShell:

```powershell
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Screen]::AllScreens | Select-Object DeviceName,Primary,Bounds,WorkingArea
```

## Data Usage

Twelve Data's free tier has a daily request quota. The default refresh interval is 10 minutes:

```env
REFRESH_SECONDS=600
```

With 3 assets, that is about 432 requests per day if the app runs continuously. Lower values update more often but use the quota faster.

## Startup

Install a Windows logon scheduled task for the current user:

```powershell
npm run install-startup
```

This starts the app as soon as Windows logs in and removes any older Startup-folder shortcut.

Remove it again:

```powershell
npm run remove-startup
```

## Development

Run with a framed window and dev tools:

```powershell
npm run dev
```

Run syntax checks:

```powershell
npm run check
```
