import { elements } from './state';
import { log } from './utils';

export function toggleTheme(): void {
    document.body.classList.toggle('daylight');
    document.body.classList.toggle('silver-breath');

    const isDaylight = document.body.classList.contains('daylight');

    if (elements.themeToggle) {
        elements.themeToggle.textContent = isDaylight ? '🌙' : '☀️';
    }

    localStorage.setItem('vesper-theme', isDaylight ? 'daylight' : 'silver');

    // Update Giscus theme if loaded
    document.querySelectorAll<HTMLIFrameElement>('iframe.giscus-frame').forEach(iframe => {
        iframe.contentWindow?.postMessage({
            giscus: { setConfig: { theme: isDaylight ? 'light' : 'dark' } }
        }, 'https://giscus.app');
    });
}

export function applySavedTheme(): void {
    const savedTheme = localStorage.getItem('vesper-theme');
    if (savedTheme === 'silver') {
        document.body.classList.remove('daylight');
        document.body.classList.add('silver-breath');
        if (elements.themeToggle) {
            elements.themeToggle.textContent = '☀️';
        }
    }
}

export function adjustFontSize(delta: number): void {
    let currentSize = parseFloat(localStorage.getItem('vesper-font-size') || '1.15');
    currentSize = Math.max(0.9, Math.min(1.6, currentSize + (delta * 0.1)));

    document.documentElement.style.setProperty('--content-font-size', currentSize + 'rem');
    localStorage.setItem('vesper-font-size', currentSize.toString());
    log('UI', `Font size: ${currentSize.toFixed(2)}rem`);
}

export function applySavedFontSize(): void {
    const savedSize = localStorage.getItem('vesper-font-size');
    if (savedSize) {
        document.documentElement.style.setProperty('--content-font-size', savedSize + 'rem');
    }
}

export function updateProgressBar(): void {
    if (!elements.progressBar) return;

    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

    elements.progressBar.style.width = progress + '%';
}
