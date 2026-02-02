/**
 * Vesper Novel Reader v3.0
 * TypeScript + Vite Edition
 */

import './styles/index.css';
import { elements, state } from './modules/state';
import { log, error as logError, escapeHtml } from './modules/utils';
import {
    toggleTheme,
    applySavedTheme,
    updateProgressBar
} from './modules/theme';
import { toggleZenMode, createZenExitButton, isZenMode } from './modules/zenMode';
import { toggleMenu, renderSidebar } from './modules/navigation';
import { setupInfiniteScroll, navigateToArc, syncProgress } from './modules/infiniteScroll';
import { initSettings, toggleSettingsPanel } from './modules/settings';
import type { Manifest } from './types';

// Map DOM elements to state
function mapElements(): void {
    const ids = [
        'content', 'chapter-info', 'prev-chapter', 'next-chapter',
        'menu-toggle', 'close-menu', 'sidebar', 'overlay',
        'theme-toggle', 'chapter-list', 'loading-overlay', 'loading-status',
        'progress-bar', 'zen-toggle', 'settings-toggle'
    ] as const;

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) console.warn(`[VESPER_BOOT_WARN] Element missing: ${id}`);
        const camelId = id.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
        (elements as unknown as Record<string, HTMLElement | null>)[camelId] = el;
    });

    // Attach listeners
    if (elements.menuToggle) elements.menuToggle.onclick = () => toggleMenu(true);
    if (elements.closeMenu) elements.closeMenu.onclick = () => toggleMenu(false);
    if (elements.overlay) elements.overlay.onclick = () => toggleMenu(false);
    if (elements.themeToggle) elements.themeToggle.onclick = () => toggleTheme();
    if (elements.prevChapter) elements.prevChapter.onclick = () => navigateToArc(state.currentArcIdx - 1);
    if (elements.nextChapter) elements.nextChapter.onclick = () => navigateToArc(state.currentArcIdx + 1);

    // Settings panel
    const settingsToggle = document.getElementById('settings-toggle');
    if (settingsToggle) settingsToggle.onclick = () => toggleSettingsPanel();

    // Zen mode
    if (elements.zenToggle) elements.zenToggle.onclick = () => toggleZenMode();
    createZenExitButton();

    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboard);

    // Scroll progress, nav visibility, save progress & virtualization
    let lastScrollY = 0;
    let saveTimeout: number | null = null;

    window.addEventListener('scroll', () => {
        updateProgressBar();
        handleNavVisibility(lastScrollY);
        lastScrollY = window.scrollY;

        // Debounced actions after user stops scrolling
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = window.setTimeout(() => {
            import('./modules/infiniteScroll').then(m => {
                m.saveProgress();
                m.scheduleVirtualization();
            });
            // Auto-expand comments for current chapter
            import('./modules/comments').then(m => m.autoExpandCurrentChapterComments());
            // Start read timer for current chapter
            startReadTimerForCurrentChapter();
        }, 800);
    });
}

/**
 * Find the current chapter and start its read timer
 */
function startReadTimerForCurrentChapter(): void {
    const chapters = document.querySelectorAll('.chapter-section');
    const viewportCenter = window.innerHeight / 2;

    for (const ch of chapters) {
        const rect = ch.getBoundingClientRect();
        if (rect.top < viewportCenter && rect.bottom > viewportCenter / 2) {
            const match = ch.id.match(/chapter-(\d+)-(\d+)/);
            if (match) {
                import('./modules/navigation').then(m => {
                    m.startChapterReadTimer(parseInt(match[1]), parseInt(match[2]));
                });
            }
            break;
        }
    }
}

function handleNavVisibility(lastScrollY: number): void {
    const nav = document.getElementById('top-nav');
    if (!nav) return;

    const currentScrollY = window.scrollY;
    const isScrollingDown = currentScrollY > lastScrollY;
    const isNearTop = currentScrollY < 100;

    // Always show near top, hide on scroll down, show on scroll up
    if (isNearTop || !isScrollingDown) {
        nav.classList.remove('nav-hidden');
    } else if (isScrollingDown && currentScrollY > 200) {
        nav.classList.add('nav-hidden');
    }
}

function handleKeyboard(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key) {
        case 'ArrowLeft':
            navigateToArc(state.currentArcIdx - 1);
            break;
        case 'ArrowRight':
            navigateToArc(state.currentArcIdx + 1);
            break;
        case 'Escape':
            if (isZenMode()) {
                toggleZenMode();
            } else {
                toggleMenu(false);
            }
            break;
        case 'z':
        case 'Z':
            toggleZenMode();
            break;
    }
}

function updateLoading(status: string): void {
    if (elements.loadingStatus) {
        elements.loadingStatus.textContent = status;
    }
}

function showErrorScreen(msg: string): void {
    if (elements.content) {
        elements.content.innerHTML = `
      <div class="error-card">
        <h3>Critical Logic Drift</h3>
        <p>${escapeHtml(msg)}</p>
        <button onclick="location.reload()" style="margin-top:15px; color:var(--accent-color); font-weight:bold;">Retry Synchronization</button>
      </div>
    `;
    }
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.display = 'none';
    }
}

// Main initialization
async function init(): Promise<void> {
    log('BOOT', 'Igniting Neural Substrate v3.0...');

    // 1. Map Elements
    mapElements();

    try {
        // 2. Load Manifest
        updateLoading('Fetching Manifest...');
        const response = await fetch('./manifest.json?t=' + Date.now());

        if (!response.ok) {
            throw new Error(`Connection Lost (HTTP ${response.status})`);
        }

        state.manifest = await response.json() as Manifest;
        log('INIT', 'Ledger Synchronized.');

        // 3. Setup UI
        renderSidebar();
        applySavedTheme();
        initSettings();

        // 4. Setup Infinite Scroll (must be before syncProgress)
        setupInfiniteScroll();

        // 5. Restore Context
        await syncProgress();

        // 6. Clear Overlay
        if (elements.loadingOverlay) {
            elements.loadingOverlay.classList.add('hidden');
        }
        state.isLoading = false;
        log('INIT', 'System Nominal.');

    } catch (err) {
        logError('INIT', 'Sync Failure', err as Error);
        showErrorScreen(`Sync Failure. Status: ${(err as Error).message}`);
    }
}

// Start the application
window.addEventListener('DOMContentLoaded', init);
