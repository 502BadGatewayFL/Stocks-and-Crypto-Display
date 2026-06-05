const elements = {
  status: document.getElementById('status'),
  saveButton: document.getElementById('saveButton'),
  addAssetButton: document.getElementById('addAssetButton'),
  assetList: document.getElementById('assetList'),
  assetTemplate: document.getElementById('assetTemplate'),
  apiKey: document.getElementById('apiKey'),
  baseUrl: document.getElementById('baseUrl'),
  targetDisplay: document.getElementById('targetDisplay'),
  refreshSeconds: document.getElementById('refreshSeconds'),
  rotateSeconds: document.getElementById('rotateSeconds')
};

const defaultAsset = {
  id: '',
  symbol: 'POND/USD',
  label: 'Marlin',
  shortLabel: 'POND',
  kind: 'crypto',
  accent: '#24c7d3'
};

let settings = null;

function makeId(asset, index) {
  const source = asset.shortLabel || asset.symbol || asset.label || `asset-${index + 1}`;
  return source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `asset-${index + 1}`;
}

function setStatus(message) {
  elements.status.textContent = message;
}

function renderAssets() {
  elements.assetList.innerHTML = '';

  settings.assets.forEach((asset, index) => {
    const row = elements.assetTemplate.content.firstElementChild.cloneNode(true);
    const title = row.querySelector('.asset-title');
    title.textContent = asset.label || asset.symbol || `Asset ${index + 1}`;

    row.querySelectorAll('[data-field]').forEach((input) => {
      const field = input.dataset.field;
      input.value = asset[field] || '';
      input.addEventListener('input', () => {
        asset[field] = input.value;
        if (field === 'label' || field === 'symbol' || field === 'shortLabel') {
          title.textContent = asset.label || asset.symbol || `Asset ${index + 1}`;
        }
      });
    });

    row.querySelector('.remove-asset').addEventListener('click', () => {
      settings.assets.splice(index, 1);
      renderAssets();
    });

    elements.assetList.appendChild(row);
  });
}

function readForm() {
  return {
    apiKey: elements.apiKey.value.trim(),
    baseUrl: elements.baseUrl.value.trim(),
    targetDisplay: elements.targetDisplay.value.trim(),
    refreshSeconds: Number.parseInt(elements.refreshSeconds.value, 10),
    rotateSeconds: Number.parseInt(elements.rotateSeconds.value, 10),
    assets: settings.assets.map((asset, index) => ({
      id: makeId(asset, index),
      symbol: String(asset.symbol || '').trim().toUpperCase(),
      label: String(asset.label || '').trim(),
      shortLabel: String(asset.shortLabel || '').trim().toUpperCase(),
      kind: asset.kind === 'stock' ? 'stock' : 'crypto',
      accent: asset.accent || '#37c3ff'
    })).filter((asset) => asset.symbol && asset.label)
  };
}

function writeForm(nextSettings) {
  settings = nextSettings;
  elements.apiKey.value = settings.apiKey || '';
  elements.baseUrl.value = settings.baseUrl || '';
  elements.targetDisplay.value = settings.targetDisplay || '';
  elements.refreshSeconds.value = settings.refreshSeconds || 600;
  elements.rotateSeconds.value = settings.rotateSeconds || 30;
  renderAssets();
}

async function saveSettings() {
  const nextSettings = readForm();

  if (!nextSettings.assets.length) {
    setStatus('Add at least one asset before saving');
    return;
  }

  elements.saveButton.disabled = true;
  setStatus('Saving settings');

  try {
    const saved = await window.stockDisplay.saveSettings(nextSettings);
    writeForm(saved);
    setStatus('Saved. Restart the display window to use these settings.');
  } catch (error) {
    setStatus(error.message || 'Could not save settings');
  } finally {
    elements.saveButton.disabled = false;
  }
}

async function boot() {
  const initial = await window.stockDisplay.getSettings();
  writeForm(initial);
  setStatus('Ready');

  elements.addAssetButton.addEventListener('click', () => {
    settings.assets.push({ ...defaultAsset, id: `asset-${settings.assets.length + 1}` });
    renderAssets();
  });

  elements.saveButton.addEventListener('click', saveSettings);
}

boot().catch((error) => {
  setStatus(error.message || 'Settings failed to start');
});
