import { elements, state } from './state';
import { log } from './utils';

// Track which chapters have been read (persisted to localStorage)
const READ_STORAGE_KEY = 'vesper-read-chapters';
let readChapters: Set<string> = new Set();

// Track current chapter time for 30-second read marking
let currentChapterTimer: number | null = null;
let currentChapterId: string | null = null;

export function loadReadChapters(): void {
    const saved = localStorage.getItem(READ_STORAGE_KEY);
    if (saved) {
        try {
            readChapters = new Set(JSON.parse(saved));
        } catch {
            readChapters = new Set();
        }
    }
}

export function saveReadChapters(): void {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...readChapters]));
}

export function markChapterAsRead(chapterId: string): void {
    if (!readChapters.has(chapterId)) {
        readChapters.add(chapterId);
        saveReadChapters();
        updateSidebarReadStatus();
        log('NAV', `Marked ${chapterId} as read`);
    }
}

export function isChapterRead(chapterId: string): boolean {
    return readChapters.has(chapterId);
}

/**
 * Start tracking time on a chapter. After 30 seconds, mark as read.
 */
export function startChapterReadTimer(arcIdx: number, chapterIdx: number): void {
    const chapterId = `${arcIdx}-${chapterIdx}`;

    // If same chapter, don't restart
    if (currentChapterId === chapterId) return;

    // Clear previous timer
    if (currentChapterTimer) {
        clearTimeout(currentChapterTimer);
    }

    currentChapterId = chapterId;

    // Don't start timer if already read
    if (readChapters.has(chapterId)) return;

    currentChapterTimer = window.setTimeout(() => {
        markChapterAsRead(chapterId);
    }, 30000); // 30 seconds

    log('NAV', `Started read timer for chapter ${chapterId}`);
}

export function toggleMenu(show: boolean): void {
    if (elements.sidebar && elements.overlay) {
        elements.sidebar.classList.toggle('hidden', !show);
        elements.overlay.classList.toggle('hidden', !show);
    }
}

export function renderSidebar(): void {
    if (!state.manifest || !state.manifest.arcs || !elements.chapterList) return;

    elements.chapterList.innerHTML = '';
    loadReadChapters();

    state.manifest.arcs.forEach((arc, arcIdx) => {
        // Arc title
        const title = document.createElement('div');
        title.className = 'arc-title';
        title.textContent = `Arc ${arc.number}: ${arc.name}`;
        elements.chapterList!.appendChild(title);

        // Individual chapters
        arc.chapters.forEach((chapter, chapterIdx) => {
            const chapterId = `${arcIdx}-${chapterIdx}`;
            const isRead = readChapters.has(chapterId);

            const chapterLink = document.createElement('a');
            chapterLink.className = `chapter-item${isRead ? ' read' : ''}`;
            chapterLink.href = '#';
            chapterLink.dataset.chapterId = chapterId;
            chapterLink.innerHTML = `
                <span class="chapter-number">${chapter.id}</span>
                <span class="chapter-name">${chapter.name}</span>
                ${isRead ? '<span class="read-indicator">✓</span>' : ''}
            `;

            chapterLink.onclick = (e) => {
                e.preventDefault();
                jumpToChapter(arcIdx, chapterIdx);
                toggleMenu(false);
            };

            elements.chapterList!.appendChild(chapterLink);
        });
    });
}

/**
 * Jump to a specific chapter
 */
async function jumpToChapter(arcIdx: number, chapterIdx: number): Promise<void> {
    // Check if chapter is already loaded
    const existingChapter = document.getElementById(`chapter-${arcIdx}-${chapterIdx}`);

    if (existingChapter) {
        // Chapter already in DOM, just scroll to it
        existingChapter.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => window.scrollBy(0, -80), 300); // Account for fixed nav
        return;
    }

    // Need to load the chapter - navigate to arc and load up to the chapter
    const { navigateToArc, appendChapter } = await import('./infiniteScroll');

    if (arcIdx !== state.currentArcIdx) {
        await navigateToArc(arcIdx);
    }

    // Load chapters up to the one we want
    for (let i = 0; i <= chapterIdx; i++) {
        const chapterExists = document.getElementById(`chapter-${arcIdx}-${i}`);
        if (!chapterExists) {
            await appendChapter(arcIdx, i);
        }
    }

    // Scroll to the chapter
    setTimeout(() => {
        const targetChapter = document.getElementById(`chapter-${arcIdx}-${chapterIdx}`);
        if (targetChapter) {
            targetChapter.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => window.scrollBy(0, -80), 300);
        }
    }, 100);
}

/**
 * Update sidebar to reflect current read status
 */
export function updateSidebarReadStatus(): void {
    const chapterLinks = document.querySelectorAll('.chapter-item[data-chapter-id]');
    chapterLinks.forEach(link => {
        const chapterId = (link as HTMLElement).dataset.chapterId;
        if (chapterId && readChapters.has(chapterId)) {
            link.classList.add('read');
            if (!link.querySelector('.read-indicator')) {
                const indicator = document.createElement('span');
                indicator.className = 'read-indicator';
                indicator.textContent = '✓';
                link.appendChild(indicator);
            }
        }
    });
}

export function updateNavButtons(): void {
    if (!elements.prevChapter || !elements.nextChapter || !state.manifest) return;

    elements.prevChapter.disabled = state.currentArcIdx === 0;
    elements.nextChapter.disabled = state.currentArcIdx >= state.manifest.arcs.length - 1;
}

