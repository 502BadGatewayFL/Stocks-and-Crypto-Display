const ASSETS = [
  {
    id: 'nvda',
    symbol: 'NVDA',
    label: 'NVIDIA',
    shortLabel: 'NVDA',
    kind: 'stock',
    accent: '#76b900'
  },
  {
    id: 'btc',
    symbol: 'BTC/USD',
    label: 'Bitcoin',
    shortLabel: 'BTC',
    kind: 'crypto',
    accent: '#f7931a'
  },
  {
    id: 'pond',
    symbol: 'POND/USD',
    label: 'Marlin',
    shortLabel: 'POND',
    kind: 'crypto',
    accent: '#24c7d3'
  }
];

const DEFAULT_BASE_URL = 'https://api.twelvedata.com';
const DEFAULT_TARGET_DISPLAY = 'waveshare';
const DEFAULT_REFRESH_SECONDS = 600;
const DEFAULT_ROTATE_SECONDS = 30;
const MIN_REQUEST_GAP_MS = 1000;

module.exports = {
  ASSETS,
  DEFAULT_BASE_URL,
  DEFAULT_TARGET_DISPLAY,
  DEFAULT_REFRESH_SECONDS,
  DEFAULT_ROTATE_SECONDS,
  MIN_REQUEST_GAP_MS
};
