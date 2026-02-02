// Settings state
export interface Settings {
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  lineSpacing: 'compact' | 'comfortable' | 'relaxed';
  contentWidth: 'narrow' | 'medium' | 'wide';
  autoHideComments: boolean;
  showProgressBar: boolean;
}

const defaultSettings: Settings = {
  fontSize: 'medium',
  lineSpacing: 'comfortable',
  contentWidth: 'medium',
  autoHideComments: false,
  showProgressBar: true,
};

let currentSettings: Settings = { ...defaultSettings };
let settingsPanel: HTMLElement | null = null;

const fontSizeMap = {
  small: '1rem',
  medium: '1.15rem',
  large: '1.3rem',
  xlarge: '1.5rem',
};

const lineSpacingMap = {
  compact: '1.6',
  comfortable: '1.9',
  relaxed: '2.2',
};

const contentWidthMap = {
  narrow: '600px',
  medium: '750px',
  wide: '900px',
};

export function loadSettings(): Settings {
  const saved = localStorage.getItem('vesper-settings');
  if (saved) {
    try {
      currentSettings = { ...defaultSettings, ...JSON.parse(saved) };
    } catch {
      currentSettings = { ...defaultSettings };
    }
  }
  return currentSettings;
}

export function saveSettings(): void {
  localStorage.setItem('vesper-settings', JSON.stringify(currentSettings));
}

export function getSettings(): Settings {
  return currentSettings;
}

export function applySettings(): void {
  const root = document.documentElement;

  const fontSize = fontSizeMap[currentSettings.fontSize];
  const lineHeight = lineSpacingMap[currentSettings.lineSpacing];
  const maxWidth = contentWidthMap[currentSettings.contentWidth];

  // Set CSS variables
  root.style.setProperty('--content-font-size', fontSize);
  root.style.setProperty('--content-line-height', lineHeight);
  root.style.setProperty('--content-max-width', maxWidth);

  // Apply directly to all chapter content elements (for dynamically loaded content)
  document.querySelectorAll<HTMLElement>('.chapter-content').forEach(el => {
    el.style.fontSize = fontSize;
    el.style.lineHeight = lineHeight;
  });

  // Apply content width to #app
  const app = document.getElementById('app');
  if (app) {
    app.style.maxWidth = maxWidth;
  }

  // Auto-hide comments
  document.body.classList.toggle('hide-comments', currentSettings.autoHideComments);

  // Progress bar
  const progressBar = document.getElementById('progress-bar');
  if (progressBar) {
    progressBar.style.display = currentSettings.showProgressBar ? 'block' : 'none';
  }
}

export function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  currentSettings[key] = value;
  saveSettings();
  applySettings();
  updatePanelUI();
}

export function createSettingsPanel(): void {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'settings-overlay';
  overlay.className = 'hidden';
  overlay.onclick = () => toggleSettingsPanel(false);
  document.body.appendChild(overlay);

  // Create panel
  const panel = document.createElement('div');
  panel.id = 'settings-panel';
  panel.className = 'hidden';
  panel.innerHTML = `
    <div class="settings-header">
      <h2>⚙️ Settings</h2>
      <button id="close-settings" aria-label="Close Settings">×</button>
    </div>
    
    <div class="settings-content">
      <div class="settings-section">
        <h3>Reading</h3>
        
        <div class="setting-item">
          <label>Font Size</label>
          <div class="setting-options" data-setting="fontSize">
            <button data-value="small">S</button>
            <button data-value="medium">M</button>
            <button data-value="large">L</button>
            <button data-value="xlarge">XL</button>
          </div>
        </div>
        
        <div class="setting-item">
          <label>Line Spacing</label>
          <div class="setting-options" data-setting="lineSpacing">
            <button data-value="compact">Compact</button>
            <button data-value="comfortable">Comfortable</button>
            <button data-value="relaxed">Relaxed</button>
          </div>
        </div>
        
        <div class="setting-item">
          <label>Content Width</label>
          <div class="setting-options" data-setting="contentWidth">
            <button data-value="narrow">Narrow</button>
            <button data-value="medium">Medium</button>
            <button data-value="wide">Wide</button>
          </div>
        </div>
      </div>
      
      <div class="settings-section">
        <h3>Display</h3>
        
        <div class="setting-item toggle-item">
          <label>Auto-hide Comments</label>
          <button class="toggle-btn" data-setting="autoHideComments">
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </button>
        </div>
        
        <div class="setting-item toggle-item">
          <label>Show Progress Bar</label>
          <button class="toggle-btn" data-setting="showProgressBar">
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </button>
        </div>
      </div>
    </div>
    
    <div class="settings-footer">
      <button id="reset-settings">Reset to Defaults</button>
    </div>
  `;

  document.body.appendChild(panel);
  settingsPanel = panel;

  // Attach event listeners
  panel.querySelector('#close-settings')?.addEventListener('click', () => toggleSettingsPanel(false));
  panel.querySelector('#reset-settings')?.addEventListener('click', resetSettings);

  // Option buttons
  panel.querySelectorAll<HTMLButtonElement>('.setting-options button').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.parentElement as HTMLElement;
      const setting = parent?.dataset.setting as keyof Settings;
      const value = btn.dataset.value as Settings[typeof setting];
      if (setting && value) {
        updateSetting(setting, value);
      }
    });
  });

  // Toggle buttons
  panel.querySelectorAll<HTMLButtonElement>('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const setting = btn.dataset.setting as keyof Settings;
      if (setting && typeof currentSettings[setting] === 'boolean') {
        updateSetting(setting, !currentSettings[setting] as Settings[typeof setting]);
      }
    });
  });

  updatePanelUI();
}

function updatePanelUI(): void {
  if (!settingsPanel) return;

  // Update option buttons
  settingsPanel.querySelectorAll<HTMLElement>('.setting-options').forEach(group => {
    const setting = group.dataset.setting as keyof Settings;
    const currentValue = currentSettings[setting];

    group.querySelectorAll<HTMLButtonElement>('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === currentValue);
    });
  });

  // Update toggle buttons
  settingsPanel.querySelectorAll<HTMLButtonElement>('.toggle-btn').forEach(btn => {
    const setting = btn.dataset.setting as keyof Settings;
    const isOn = currentSettings[setting] === true;
    btn.classList.toggle('active', isOn);
  });
}

export function toggleSettingsPanel(show?: boolean): void {
  const panel = document.getElementById('settings-panel');
  const overlay = document.getElementById('settings-overlay');

  if (!panel || !overlay) return;

  const shouldShow = show ?? panel.classList.contains('hidden');

  panel.classList.toggle('hidden', !shouldShow);
  overlay.classList.toggle('hidden', !shouldShow);

  if (shouldShow) {
    updatePanelUI();
  }
}

function resetSettings(): void {
  currentSettings = { ...defaultSettings };
  saveSettings();
  applySettings();
  updatePanelUI();

}

export function initSettings(): void {
  loadSettings();
  createSettingsPanel();
  applySettings();
}
