const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const dotenv = require('dotenv');
const {
  ASSETS,
  DEFAULT_BASE_URL,
  DEFAULT_TARGET_DISPLAY,
  DEFAULT_REFRESH_SECONDS,
  DEFAULT_ROTATE_SECONDS,
  MIN_REQUEST_GAP_MS
} = require('./config');

const appRoot = path.resolve(__dirname, '..');
const envPath = path.join(appRoot, '.env');
const settingsPath = path.join(appRoot, 'settings.json');

dotenv.config({ path: envPath });

let mainWindow;
let lastRequestAt = 0;
let requestQueue = Promise.resolve();

function normalizeAsset(asset, index) {
  const fallback = ASSETS[index] || ASSETS[0];
  const symbol = String(asset?.symbol || fallback.symbol).trim().toUpperCase();
  const shortLabel = String(asset?.shortLabel || symbol.split('/')[0]).trim().toUpperCase();
  const id = String(asset?.id || shortLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `asset-${index + 1}`)
    .replace(/^-+|-+$/g, '');

  return {
    id,
    symbol,
    label: String(asset?.label || shortLabel).trim(),
    shortLabel,
    kind: asset?.kind === 'stock' ? 'stock' : 'crypto',
    accent: /^#[0-9a-f]{6}$/i.test(asset?.accent || '') ? asset.accent : fallback.accent
  };
}

function normalizeSettings(settings = {}) {
  const assets = Array.isArray(settings.assets) && settings.assets.length
    ? settings.assets.map(normalizeAsset)
    : ASSETS;

  const refreshSeconds = Number.parseInt(settings.refreshSeconds, 10);
  const rotateSeconds = Number.parseInt(settings.rotateSeconds, 10);

  return {
    apiKey: String(settings.apiKey || process.env.TWELVEDATA_API_KEY || ''),
    baseUrl: String(settings.baseUrl || process.env.TWELVEDATA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ''),
    targetDisplay: String(settings.targetDisplay || process.env.TARGET_DISPLAY || DEFAULT_TARGET_DISPLAY),
    refreshSeconds: Number.isFinite(refreshSeconds) && refreshSeconds >= 30
      ? refreshSeconds
      : Number.parseInt(process.env.REFRESH_SECONDS || '', 10) || DEFAULT_REFRESH_SECONDS,
    rotateSeconds: Number.isFinite(rotateSeconds) && rotateSeconds >= 5
      ? rotateSeconds
      : DEFAULT_ROTATE_SECONDS,
    assets
  };
}

async function readSettingsFile() {
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function readSettingsFileSync() {
  try {
    return JSON.parse(require('node:fs').readFileSync(settingsPath, 'utf8'));
  } catch {
    return {};
  }
}

async function writeSettingsFile(settings) {
  await fs.writeFile(settingsPath, `${JSON.stringify(normalizeSettings(settings), null, 2)}\n`, 'utf8');
}

async function writeEnvFile(settings) {
  const env = {
    TWELVEDATA_API_KEY: settings.apiKey || '',
    TWELVEDATA_BASE_URL: settings.baseUrl || DEFAULT_BASE_URL,
    TARGET_DISPLAY: settings.targetDisplay || DEFAULT_TARGET_DISPLAY,
    REFRESH_SECONDS: String(settings.refreshSeconds || DEFAULT_REFRESH_SECONDS)
  };

  const lines = Object.entries(env).map(([key, value]) => `${key}=${value}`);
  await fs.writeFile(envPath, `${lines.join('\n')}\n`, 'utf8');
}

function readRuntimeConfig() {
  const settings = normalizeSettings(readSettingsFileSync());

  return {
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    targetDisplay: settings.targetDisplay,
    refreshSeconds: settings.refreshSeconds,
    rotateSeconds: settings.rotateSeconds,
    minRequestGapMs: MIN_REQUEST_GAP_MS,
    assets: settings.assets
  };
}

function getCachePath() {
  return path.join(app.getPath('userData'), 'market-cache.json');
}

async function readCache() {
  try {
    const raw = await fs.readFile(getCachePath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeCache(cache) {
  await fs.mkdir(path.dirname(getCachePath()), { recursive: true });
  await fs.writeFile(getCachePath(), JSON.stringify(cache, null, 2), 'utf8');
}

function findDisplayByTarget(displays, targetDisplay) {
  const target = (targetDisplay || '').trim();
  const lowerTarget = target.toLowerCase();
  const bySmallestArea = [...displays]
    .filter((display) => !display.primary)
    .sort((a, b) => (a.bounds.width * a.bounds.height) - (b.bounds.width * b.bounds.height));

  if (!target || lowerTarget === 'auto') {
    return bySmallestArea[0]
      || screen.getPrimaryDisplay();
  }

  if (lowerTarget === 'primary') {
    return screen.getPrimaryDisplay();
  }

  if (lowerTarget === 'waveshare' || lowerTarget === 'smallest') {
    return bySmallestArea[0] || screen.getPrimaryDisplay();
  }

  const displayNumberMatch = target.match(/(?:display|index:)(\d+)$/i);
  if (displayNumberMatch) {
    const index = Number.parseInt(displayNumberMatch[1], 10) - 1;
    if (displays[index]) {
      return displays[index];
    }
  }

  const idMatch = target.match(/^id:(.+)$/i);
  if (idMatch) {
    return displays.find((display) => display.id?.toString() === idMatch[1]);
  }

  const labelMatch = target.match(/^label:(.+)$/i);
  const labelNeedle = (labelMatch ? labelMatch[1] : target).toLowerCase();
  return displays.find((display) => display.label?.toLowerCase().includes(labelNeedle))
    || displays.find((display) => display.name?.toLowerCase().includes(labelNeedle))
    || displays.find((display) => display.id?.toString() === target);
}

function findTargetDisplay() {
  const config = readRuntimeConfig();
  const displays = screen.getAllDisplays();
  const target = findDisplayByTarget(displays, config.targetDisplay) || screen.getPrimaryDisplay();

  return target;
}

function createDisplayWindow() {
  const devMode = process.env.STOCK_DISPLAY_DEV === '1';
  const display = findTargetDisplay();
  const bounds = display.bounds;

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fullscreen: false,
    frame: devMode,
    resizable: devMode,
    movable: devMode,
    show: false,
    backgroundColor: '#050608',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.setBounds(bounds, false);
    mainWindow.show();
    mainWindow.focus();

    if (!devMode) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.setFullScreen(true);
    }
  });

  if (devMode) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function createSettingsWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 880,
    minHeight: 620,
    show: false,
    backgroundColor: '#101317',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.loadFile(path.join(__dirname, 'settings.html'));
}

function normalizeBars(values) {
  return (Array.isArray(values) ? values : [])
    .map((bar) => ({
      t: Date.parse(bar.datetime),
      o: Number.parseFloat(bar.open),
      h: Number.parseFloat(bar.high),
      l: Number.parseFloat(bar.low),
      c: Number.parseFloat(bar.close),
      v: Number.parseFloat(bar.volume || '0')
    }))
    .filter((bar) => Number.isFinite(bar.t) && Number.isFinite(bar.c))
    .sort((a, b) => a.t - b.t);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_GAP_MS) {
    await wait(MIN_REQUEST_GAP_MS - elapsed);
  }
  lastRequestAt = Date.now();
}

function enqueueRequest(task) {
  requestQueue = requestQueue.then(async () => {
    await throttle();
    return task();
  });
  return requestQueue;
}

async function fetchAsset(asset) {
  const config = readRuntimeConfig();
  if (!config.apiKey) {
    throw new Error('Missing TWELVEDATA_API_KEY in .env');
  }

  const url = new URL(`${config.baseUrl}/time_series`);
  url.searchParams.set('symbol', asset.symbol);
  url.searchParams.set('interval', '1min');
  url.searchParams.set('outputsize', '240');
  url.searchParams.set('apikey', config.apiKey);

  const response = await fetch(url, {
    headers: { accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Twelve Data returned ${response.status}`);
  }

  const payload = await response.json();
  if (payload.status === 'error') {
    throw new Error(payload.message || 'Twelve Data error');
  }

  const bars = normalizeBars(payload.values);
  if (!bars.length) {
    throw new Error('No time series values returned yet');
  }

  const first = bars[0].c;
  const last = bars[bars.length - 1].c;
  const previous = bars.length > 1 ? bars[bars.length - 2].c : first;
  const change = last - first;
  const changePercent = first ? (change / first) * 100 : 0;

  return {
    assetId: asset.id,
    symbol: asset.symbol,
    fetchedAt: Date.now(),
    price: last,
    previousPrice: previous,
    change,
    changePercent,
    bars
  };
}

ipcMain.handle('app:get-initial-state', async () => {
  const config = readRuntimeConfig();
  const cache = await readCache();

  return {
    assets: config.assets,
    refreshSeconds: config.refreshSeconds,
    rotateSeconds: config.rotateSeconds,
    targetDisplay: config.targetDisplay,
    hasApiKey: Boolean(config.apiKey),
    cache
  };
});

ipcMain.handle('market:fetch-asset', async (_event, assetId) => {
  const asset = readRuntimeConfig().assets.find((item) => item.id === assetId);
  if (!asset) {
    throw new Error(`Unknown asset: ${assetId}`);
  }

  return enqueueRequest(async () => {
    const data = await fetchAsset(asset);
    const cache = await readCache();
    cache[asset.id] = data;
    await writeCache(cache);
    return data;
  });
});

ipcMain.handle('settings:get', async () => normalizeSettings(await readSettingsFile()));

ipcMain.handle('settings:save', async (_event, nextSettings) => {
  const settings = normalizeSettings(nextSettings);
  await writeSettingsFile(settings);
  await writeEnvFile(settings);
  return settings;
});

app.whenReady().then(() => {
  if (process.argv.includes('--settings')) {
    createSettingsWindow();
  } else {
    createDisplayWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (process.argv.includes('--settings')) {
        createSettingsWindow();
      } else {
        createDisplayWindow();
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
