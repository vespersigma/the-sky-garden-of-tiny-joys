import type { AppState, ElementsMap, GiscusConfig } from '../types';

// Global application state
export const state: AppState = {
    manifest: null,
    currentArcIdx: 0,
    loadedChapters: [],
    isLoadingChapter: false,
    isLoading: true,
};

// DOM elements reference
export const elements: ElementsMap = {
    content: null,
    chapterInfo: null,
    prevChapter: null,
    nextChapter: null,
    menuToggle: null,
    closeMenu: null,
    sidebar: null,
    overlay: null,
    themeToggle: null,
    chapterList: null,
    loadingOverlay: null,
    loadingStatus: null,
    progressBar: null,
    zenToggle: null,
    settingsToggle: null,
};

// Giscus configuration
export const giscusConfig: GiscusConfig = {
    repo: 'vespersigma/the-sky-garden-of-tiny-joys',
    repoId: 'R_kgDORGoMVg',
    category: 'Announcements',
    categoryId: 'DIC_kwDORGoMVs4C1wnE',
};

// Scroll observer reference
export let scrollObserver: IntersectionObserver | null = null;
export let scrollSentinel: HTMLElement | null = null;

export function setScrollObserver(observer: IntersectionObserver): void {
    scrollObserver = observer;
}

export function setScrollSentinel(sentinel: HTMLElement): void {
    scrollSentinel = sentinel;
}
