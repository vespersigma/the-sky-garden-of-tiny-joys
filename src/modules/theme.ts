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

    if (savedTheme === 'daylight') {
        document.body.classList.add('daylight');
        document.body.classList.remove('silver-breath');
        if (elements.themeToggle) {
            elements.themeToggle.textContent = '🌙';
        }
    } else {
        // Default to dark/silver theme
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

    // Find current chapter in viewport
    const chapters = document.querySelectorAll<HTMLElement>('.chapter-section');
    let currentChapter: HTMLElement | null = null;

    for (const ch of chapters) {
        const rect = ch.getBoundingClientRect();
        // Chapter is in viewport if its top is above viewport center
        if (rect.top < window.innerHeight / 2 && rect.bottom > 0) {
            currentChapter = ch;
        }
    }

    if (!currentChapter) {
        elements.progressBar.style.width = '0%';
        return;
    }

    // Calculate progress within current chapter
    const rect = currentChapter.getBoundingClientRect();
    const chapterHeight = currentChapter.offsetHeight;
    const scrolledInChapter = -rect.top; // How far we've scrolled past the top
    const viewableChapter = chapterHeight - window.innerHeight; // Total scrollable distance in chapter

    let progress = 0;
    if (viewableChapter > 0) {
        progress = Math.min(100, Math.max(0, (scrolledInChapter / viewableChapter) * 100));
    } else {
        // Chapter is shorter than viewport, consider it 100% read
        progress = 100;
    }

    elements.progressBar.style.width = progress + '%';
}
