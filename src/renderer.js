const state = {
  assets: [],
  data: {},
  errors: {},
  activeIndex: 0,
  refreshSeconds: 90,
  hasApiKey: false,
  refreshTimer: null,
  rotateTimer: null,
  rotateSeconds: 30,
  chartAnimationFrame: null,
  chartAnimatedAssetId: null
};

const APP_ACCENT = '#76b900';

const elements = {
  assetLabel: document.getElementById('assetLabel'),
  symbolLabel: document.getElementById('symbolLabel'),
  pager: document.getElementById('pager'),
  price: document.getElementById('price'),
  change: document.getElementById('change'),
  status: document.getElementById('status'),
  chart: document.getElementById('chart')
};

function activeAsset() {
  return state.assets[state.activeIndex];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function usdFractionDigits(value, options = {}) {
  const step = Math.abs(options.step || 0);
  const absValue = Math.abs(value);

  if (Number.isFinite(step) && step > 0 && step < 1) {
    return clamp(Math.ceil(-Math.log10(step)) + 1, 2, 8);
  }

  if (Number.isFinite(absValue) && absValue > 0 && absValue < 1) {
    return clamp(Math.ceil(-Math.log10(absValue)) + 3, 4, 8);
  }

  if (step > 0 && step < 10) {
    return 2;
  }

  if (absValue < 100) {
    return 2;
  }

  return 2;
}

function formatUsd(value, options = {}) {
  if (!Number.isFinite(value)) {
    return '--';
  }

  const maximumFractionDigits = usdFractionDigits(value, options);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: options.minimumFractionDigits || 0,
    maximumFractionDigits
  }).format(value);
}

function formatPrice(value) {
  return formatUsd(value);
}

function formatChange(data) {
  if (!data || !Number.isFinite(data.change) || !Number.isFinite(data.changePercent)) {
    return '--';
  }

  const sign = data.change >= 0 ? '+' : '';
  return `${sign}${data.change.toFixed(2)} (${sign}${data.changePercent.toFixed(2)}%)`;
}

function formatTime(timestamp) {
  if (!timestamp) {
    return 'never';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(timestamp));
}

function setAccent(asset) {
  document.documentElement.style.setProperty('--accent', asset?.accent || APP_ACCENT);
}

function resizeCanvas() {
  const canvas = elements.chart;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
}

function drawEmpty(ctx, canvas, message) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
  ctx.font = `${Math.max(16, Math.floor(canvas.height / 15))}px Segoe UI, Arial`;
  ctx.textAlign = 'center';
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}

function formatChartLabel(value, step) {
  return formatUsd(value, { step });
}

function drawSmoothLine(ctx, points) {
  if (!points.length) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i += 1) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }

  if (points.length > 1) {
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }
}

function drawChart(progress = 1) {
  resizeCanvas();

  const asset = activeAsset();
  const data = asset ? state.data[asset.id] : null;
  const bars = data?.bars || [];
  const canvas = elements.chart;
  const ctx = canvas.getContext('2d');

  if (!asset || bars.length < 2) {
    drawEmpty(ctx, canvas, state.hasApiKey ? 'Waiting for market data' : 'Set TWELVEDATA_API_KEY in .env');
    return;
  }

  const pad = {
    left: Math.max(58, canvas.width * 0.075),
    right: Math.max(76, canvas.width * 0.1),
    top: 18,
    bottom: 32
  };
  const width = canvas.width - pad.left - pad.right;
  const height = canvas.height - pad.top - pad.bottom;
  const closes = bars.map((bar) => bar.c);
  let min = Math.min(...closes);
  let max = Math.max(...closes);

  if (min === max) {
    min -= 1;
    max += 1;
  }

  const range = max - min;
  min -= range * 0.08;
  max += range * 0.08;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.54)';
  ctx.font = `${Math.max(11, Math.floor(canvas.height / 22))}px Segoe UI, Arial`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const tickStep = (max - min) / 4;

  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (height / 4) * i;
    const value = max - tickStep * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(canvas.width - pad.right, y);
    ctx.stroke();
    ctx.fillText(formatChartLabel(value, tickStep), pad.left - 10, y);
  }

  ctx.strokeStyle = APP_ACCENT;
  ctx.lineWidth = Math.max(2, canvas.height / 125);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const visibleBars = Math.max(2, Math.ceil(bars.length * progress));
  const animatedBars = bars.slice(0, visibleBars);
  const points = animatedBars.map((bar, index) => ({
    x: pad.left + (index / Math.max(1, animatedBars.length - 1)) * width,
    y: pad.top + (1 - ((bar.c - min) / (max - min))) * height,
    value: bar.c
  }));

  drawSmoothLine(ctx, points);
  ctx.stroke();

  const last = points[points.length - 1];
  ctx.fillStyle = APP_ACCENT;
  ctx.beginPath();
  ctx.arc(last.x, last.y, Math.max(4, canvas.height / 70), 0, Math.PI * 2);
  ctx.fill();

  const label = formatChartLabel(last.value, tickStep);
  ctx.font = `${Math.max(12, Math.floor(canvas.height / 20))}px Segoe UI, Arial`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const labelWidth = ctx.measureText(label).width + 14;
  const labelX = Math.min(canvas.width - labelWidth - 10, last.x + 10);
  const labelY = Math.max(pad.top + 12, Math.min(canvas.height - pad.bottom - 12, last.y));
  ctx.fillStyle = 'rgba(5, 6, 8, 0.78)';
  ctx.fillRect(labelX, labelY - 13, labelWidth, 26);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.strokeRect(labelX, labelY - 13, labelWidth, 26);
  ctx.fillStyle = 'rgba(244, 247, 251, 0.9)';
  ctx.fillText(label, labelX + 7, labelY);
}

function animateChart() {
  if (state.chartAnimationFrame) {
    cancelAnimationFrame(state.chartAnimationFrame);
  }

  const startedAt = performance.now();
  const duration = 360;

  function frame(now) {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    drawChart(eased);

    if (progress < 1) {
      state.chartAnimationFrame = requestAnimationFrame(frame);
    }
  }

  state.chartAnimationFrame = requestAnimationFrame(frame);
}

function renderChart({ animate = false } = {}) {
  const asset = activeAsset();

  if (animate && asset?.id !== state.chartAnimatedAssetId) {
    state.chartAnimatedAssetId = asset.id;
    animateChart();
    return;
  }

  if (state.chartAnimationFrame) {
    cancelAnimationFrame(state.chartAnimationFrame);
    state.chartAnimationFrame = null;
  }

  drawChart(1);
}

function renderPager() {
  elements.pager.innerHTML = '';
  state.assets.forEach((asset, index) => {
    const dot = document.createElement('div');
    dot.className = `dot${index === state.activeIndex ? ' active' : ''}`;
    dot.addEventListener('click', () => setActiveIndex(index));
    elements.pager.appendChild(dot);
  });
}

function render(options = {}) {
  const asset = activeAsset();
  const data = asset ? state.data[asset.id] : null;
  const error = asset ? state.errors[asset.id] : null;

  setAccent(asset);
  renderPager();

  elements.assetLabel.textContent = asset?.label || 'Loading';
  elements.symbolLabel.textContent = asset ? `${asset.shortLabel} / ${asset.symbol}` : '--';
  elements.price.textContent = data ? formatPrice(data.price) : '--';
  elements.change.textContent = formatChange(data);
  elements.change.className = `change ${data?.change >= 0 ? 'up' : 'down'}`;

  if (!state.hasApiKey) {
    elements.status.textContent = 'Missing TWELVEDATA_API_KEY in .env';
  } else if (error && data) {
    elements.status.textContent = `Cached ${formatTime(data.fetchedAt)} | ${error}`;
  } else if (error) {
    elements.status.textContent = error;
  } else if (data) {
    elements.status.textContent = `Updated ${formatTime(data.fetchedAt)}`;
  } else {
    elements.status.textContent = 'Loading market data';
  }

  renderChart({ animate: Boolean(options.animateChart) });
}

function setActiveIndex(index, options = {}) {
  state.activeIndex = (index + state.assets.length) % state.assets.length;
  document.body.classList.remove('asset-enter');
  void document.body.offsetWidth;
  document.body.classList.add('asset-enter');
  render({ animateChart: true });

  if (!options.skipRefresh) {
    refreshAsset(activeAsset()?.id);
  }
}

async function refreshAsset(assetId) {
  if (!assetId || !state.hasApiKey) {
    return;
  }

  try {
    state.errors[assetId] = null;
    render();
    const data = await window.stockDisplay.fetchAsset(assetId);
    state.data[assetId] = data;
  } catch (error) {
    state.errors[assetId] = error.message || 'Market data unavailable';
  } finally {
    render();
  }
}

async function refreshAll() {
  const active = activeAsset();
  const ordered = [
    active,
    ...state.assets.filter((asset) => asset.id !== active?.id)
  ].filter(Boolean);

  for (const asset of ordered) {
    await refreshAsset(asset.id);
  }
}

function bindInput() {
  window.addEventListener('resize', render);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      setActiveIndex(state.activeIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      setActiveIndex(state.activeIndex - 1);
    }
  });
}

function startAutoRotate() {
  if (state.rotateTimer) {
    clearInterval(state.rotateTimer);
  }

  state.rotateTimer = setInterval(() => {
    if (state.assets.length > 1) {
      setActiveIndex(state.activeIndex + 1);
    }
  }, Math.max(5, state.rotateSeconds || 30) * 1000);
}

async function boot() {
  bindInput();
  const initial = await window.stockDisplay.getInitialState();
  state.assets = initial.assets;
  state.refreshSeconds = initial.refreshSeconds;
  state.rotateSeconds = initial.rotateSeconds;
  state.hasApiKey = initial.hasApiKey;
  state.data = initial.cache || {};

  render({ animateChart: true });
  startAutoRotate();

  setTimeout(refreshAll, 150);
  state.refreshTimer = setInterval(refreshAll, state.refreshSeconds * 1000);
}

boot().catch((error) => {
  elements.status.textContent = error.message || 'Startup failed';
  drawChart();
});
