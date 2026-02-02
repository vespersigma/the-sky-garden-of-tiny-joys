import { marked } from 'marked';
import {
    elements,
    state,
    scrollObserver,
    scrollSentinel,
    setScrollObserver,
    setScrollSentinel
} from './state';
import { log, error as logError } from './utils';
import { createCommentPreview } from './comments';
import { updateNavButtons } from './navigation';
import { applySettings } from './settings';

// Virtualization: Keep only N chapters rendered at a time
const VIRTUAL_WINDOW_SIZE = 5; // Chapters to keep in DOM around current position
const chapterHeights: Map<string, number> = new Map(); // Store heights for placeholders
const chapterContent: Map<string, string> = new Map(); // Cache chapter HTML

export function setupInfiniteScroll(): void {
    // Create sentinel element at bottom of content
    const sentinel = document.createElement('div');
    sentinel.id = 'scroll-sentinel';
    sentinel.style.height = '1px';

    if (elements.content) {
        elements.content.appendChild(sentinel);
    }
    setScrollSentinel(sentinel);

    // Intersection Observer to detect when user nears bottom
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !state.isLoadingChapter) {
                loadNextChapterInArc();
            }
        });
    }, {
        rootMargin: '200px'
    });

    observer.observe(sentinel);
    setScrollObserver(observer);
}

async function loadNextChapterInArc(): Promise<void> {
    if (state.isLoadingChapter || !state.manifest) return;

    const arc = state.manifest.arcs[state.currentArcIdx];
    const lastLoaded = state.loadedChapters[state.loadedChapters.length - 1];

    if (!lastLoaded) return;

    const nextChapterIdx = lastLoaded.chapterIdx + 1;

    // Check if we've reached end of arc
    if (nextChapterIdx >= arc.chapters.length) {
        return;
    }

    await appendChapter(state.currentArcIdx, nextChapterIdx);
}

export async function appendChapter(arcIdx: number, chapterIdx: number): Promise<void> {
    if (state.isLoadingChapter || !state.manifest) return;
    state.isLoadingChapter = true;

    const arc = state.manifest.arcs[arcIdx];
    const ch = arc?.chapters[chapterIdx];

    if (!arc || !ch) {
        state.isLoadingChapter = false;
        return;
    }

    try {
        const path = `./chapters/arc_${String(arc.number).padStart(2, '0')}/chapter_${ch.id}.md?v=${Date.now()}`;
        const response = await fetch(path);

        if (!response.ok) throw new Error(`Chapter Fragment missing (HTTP ${response.status})`);

        const text = await response.text();

        // Filter metadata headers
        const lines = text.split('\n').filter(line =>
            !line.startsWith('Arc ') && !line.startsWith('Chapter ')
        );

        // Create chapter container
        const chapterDiv = document.createElement('div');
        chapterDiv.className = 'chapter-section';
        chapterDiv.id = `chapter-${arcIdx}-${chapterIdx}`;

        // Chapter header
        const header = document.createElement('div');
        header.className = 'chapter-header';
        header.innerHTML = `<span class="chapter-label">Chapter ${ch.id}</span><h2 class="chapter-title">${ch.name}</h2>`;
        chapterDiv.appendChild(header);

        // Chapter content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'chapter-content';
        contentDiv.innerHTML = marked.parse(lines.join('\n')) as string;
        chapterDiv.appendChild(contentDiv);

        // Comment preview
        const commentPreview = createCommentPreview(arcIdx, chapterIdx, ch);
        chapterDiv.appendChild(commentPreview);

        // Check if this is the last chapter in arc
        const isLastInArc = chapterIdx === arc.chapters.length - 1;
        if (isLastInArc) {
            const arcEndCard = createArcEndCard(arcIdx);
            chapterDiv.appendChild(arcEndCard);
        } else {
            // Add chapter divider
            const divider = document.createElement('div');
            divider.className = 'chapter-divider';
            chapterDiv.appendChild(divider);
        }

        // Insert before sentinel
        if (scrollSentinel && scrollSentinel.parentNode) {
            scrollSentinel.parentNode.insertBefore(chapterDiv, scrollSentinel);
        }

        // Track loaded chapter
        state.loadedChapters.push({ arcIdx, chapterIdx });
        saveProgress();

        // Apply settings to newly loaded content
        applySettings();

        log('SCROLL', `Loaded Chapter ${ch.id}: ${ch.name}`);

    } catch (err) {
        logError('SCROLL', 'Failed to load chapter', err as Error);
    } finally {
        state.isLoadingChapter = false;
    }
}

function createArcEndCard(arcIdx: number): HTMLElement {
    if (!state.manifest) {
        const placeholder = document.createElement('div');
        return placeholder;
    }

    const arc = state.manifest.arcs[arcIdx];
    const hasNextArc = arcIdx < state.manifest.arcs.length - 1;
    const nextArc = hasNextArc ? state.manifest.arcs[arcIdx + 1] : null;
    const isOngoing = state.manifest.status === 'ongoing';
    const isHiatus = state.manifest.status === 'hiatus';

    const card = document.createElement('div');
    card.className = 'arc-end-card';

    // Build arc navigation HTML
    const hasPrevArc = arcIdx > 0;
    const prevArc = hasPrevArc ? state.manifest.arcs[arcIdx - 1] : null;
    const arcNavHtml = `
        <div class="arc-navigation">
            <button class="arc-nav-btn prev-arc" ${!hasPrevArc ? 'disabled' : ''}>
                ${hasPrevArc ? `← Arc ${prevArc!.number}` : '← Prev'}
            </button>
            <div class="arc-nav-title">
                <span class="arc-label">Arc ${arc.number}</span>
                <span class="arc-name">${arc.name}</span>
            </div>
            <button class="arc-nav-btn next-arc" ${!hasNextArc ? 'disabled' : ''}>
                ${hasNextArc ? `Arc ${nextArc!.number} →` : 'Next →'}
            </button>
        </div>
    `;

    if (hasNextArc && nextArc) {
        // More arcs available
        card.innerHTML = `
      <div class="arc-end-decoration">✨</div>
      <h3 class="arc-end-title">End of Arc ${arc.number}</h3>
      <p class="arc-end-subtitle">${arc.name}</p>
      <div class="arc-end-divider"></div>
      <p class="arc-end-next">Continue to</p>
      <p class="arc-end-next-title">Arc ${nextArc.number}: ${nextArc.name}</p>
      <button class="arc-continue-btn" data-next-arc="${arcIdx + 1}">
        Continue Reading →
      </button>
      ${arcNavHtml}
    `;

        // Attach event listener
        const btn = card.querySelector('.arc-continue-btn');
        btn?.addEventListener('click', () => navigateToArc(arcIdx + 1));
    } else if (isOngoing) {
        // Story is ongoing - more to come
        card.innerHTML = `
      <div class="arc-end-decoration">📖</div>
      <h3 class="arc-end-title">You're All Caught Up!</h3>
      <p class="arc-end-subtitle">End of Arc ${arc.number}: ${arc.name}</p>
      <div class="arc-end-divider"></div>
      <p class="arc-end-ongoing">This story is still being written.</p>
      <p class="arc-end-thanks">More chapters coming soon! ✨</p>
      ${arcNavHtml}
    `;
    } else if (isHiatus) {
        // Story is on hiatus
        card.innerHTML = `
      <div class="arc-end-decoration">⏸️</div>
      <h3 class="arc-end-title">Story on Hiatus</h3>
      <p class="arc-end-subtitle">End of Arc ${arc.number}: ${arc.name}</p>
      <div class="arc-end-divider"></div>
      <p class="arc-end-ongoing">This story is currently on hiatus.</p>
      <p class="arc-end-thanks">Thank you for reading!</p>
      ${arcNavHtml}
    `;
    } else {
        // Story is completed
        card.innerHTML = `
      <div class="arc-end-decoration">🌟</div>
      <h3 class="arc-end-title">The End</h3>
      <p class="arc-end-subtitle">${arc.name}</p>
      <p class="arc-end-thanks">Thank you for reading!</p>
      ${arcNavHtml}
    `;
    }

    // Attach navigation handlers
    card.querySelector('.prev-arc')?.addEventListener('click', () => navigateToArc(arcIdx - 1));
    card.querySelector('.next-arc')?.addEventListener('click', () => navigateToArc(arcIdx + 1));

    return card;
}

export async function navigateToArc(arcIdx: number): Promise<void> {
    if (!state.manifest || arcIdx < 0 || arcIdx >= state.manifest.arcs.length) return;

    // Clear content and reset state
    state.currentArcIdx = arcIdx;
    state.loadedChapters = [];

    if (elements.content) {
        elements.content.innerHTML = '';

        // Re-add sentinel
        const sentinel = document.createElement('div');
        sentinel.id = 'scroll-sentinel';
        sentinel.style.height = '1px';
        elements.content.appendChild(sentinel);
        setScrollSentinel(sentinel);

        if (scrollObserver) {
            scrollObserver.observe(sentinel);
        }
    }

    // Get arc info
    const arc = state.manifest.arcs[arcIdx];

    // Update hidden nav info for compatibility
    if (elements.chapterInfo) {
        elements.chapterInfo.textContent = `Arc ${arc.number}: ${arc.name}`;
    }

    // Load first chapter
    await appendChapter(arcIdx, 0);

    window.scrollTo(0, 0);
    updateNavButtons();
    saveProgress();
}

export function saveProgress(): void {
    // Find the chapter that's currently most visible in viewport
    const chapters = document.querySelectorAll('[id^="chapter-"]');
    let visibleChapter: { arcIdx: number; chapterIdx: number } | null = null;

    for (const ch of chapters) {
        const rect = ch.getBoundingClientRect();
        // Check if chapter header is in upper half of viewport
        if (rect.top < window.innerHeight / 2 && rect.bottom > 0) {
            const match = ch.id.match(/chapter-(\d+)-(\d+)/);
            if (match) {
                visibleChapter = {
                    arcIdx: parseInt(match[1]),
                    chapterIdx: parseInt(match[2])
                };
            }
        }
    }

    // Fall back to last loaded chapter if no visible chapter found
    if (!visibleChapter) {
        const lastChapter = state.loadedChapters[state.loadedChapters.length - 1];
        visibleChapter = lastChapter || { arcIdx: state.currentArcIdx, chapterIdx: 0 };
    }

    const progress = {
        arc: visibleChapter.arcIdx,
        chapter: visibleChapter.chapterIdx
    };
    localStorage.setItem('vesper-progress', JSON.stringify(progress));
}

export async function syncProgress(): Promise<void> {
    const saved = localStorage.getItem('vesper-progress');
    if (saved) {
        try {
            const { arc, chapter } = JSON.parse(saved);
            if (state.manifest?.arcs[arc]) {
                await navigateToArc(arc);

                // Load chapters up to saved position
                if (chapter && chapter > 0) {
                    for (let i = 1; i <= chapter; i++) {
                        await appendChapter(arc, i);
                    }

                    // Scroll to the last loaded chapter
                    setTimeout(() => {
                        const lastChapterEl = document.getElementById(`chapter-${arc}-${chapter}`);
                        if (lastChapterEl) {
                            lastChapterEl.scrollIntoView({ behavior: 'instant', block: 'start' });
                            window.scrollBy(0, -80); // Account for fixed nav
                        }
                    }, 100);
                }
                return;
            }
        } catch {
            localStorage.removeItem('vesper-progress');
        }
    }
    await navigateToArc(0);
}

/**
 * Virtualize chapters - remove DOM content from distant chapters to save memory
 * Keeps placeholder with correct height so scroll position is preserved
 */
export function virtualizeChapters(): void {
    const chapters = document.querySelectorAll<HTMLElement>('.chapter-section');
    if (chapters.length <= VIRTUAL_WINDOW_SIZE) return;

    // Find current chapter (one in viewport)
    let currentIdx = 0;
    const viewportCenter = window.innerHeight / 2 + window.scrollY;

    chapters.forEach((ch, idx) => {
        const rect = ch.getBoundingClientRect();
        const chapterCenter = rect.top + window.scrollY + rect.height / 2;
        if (Math.abs(chapterCenter - viewportCenter) < Math.abs(chapters[currentIdx].getBoundingClientRect().top + window.scrollY + chapters[currentIdx].getBoundingClientRect().height / 2 - viewportCenter)) {
            currentIdx = idx;
        }
    });

    // Determine which chapters to keep (window around current)
    const halfWindow = Math.floor(VIRTUAL_WINDOW_SIZE / 2);
    const keepStart = Math.max(0, currentIdx - halfWindow);
    const keepEnd = Math.min(chapters.length - 1, currentIdx + halfWindow);

    chapters.forEach((ch, idx) => {
        const chapterId = ch.id;

        if (idx < keepStart || idx > keepEnd) {
            // Chapter is outside window - virtualize it
            if (!ch.dataset.virtualized) {
                // Store height and content before removing
                const height = ch.offsetHeight;
                chapterHeights.set(chapterId, height);

                // Store inner HTML for restoration
                chapterContent.set(chapterId, ch.innerHTML);

                // Replace with placeholder
                ch.innerHTML = '';
                ch.style.height = `${height}px`;
                ch.dataset.virtualized = 'true';

                log('VIRTUAL', `Virtualized ${chapterId} (height: ${height}px)`);
            }
        } else {
            // Chapter is in window - restore if virtualized
            if (ch.dataset.virtualized) {
                const cachedContent = chapterContent.get(chapterId);
                if (cachedContent) {
                    ch.innerHTML = cachedContent;
                    ch.style.height = '';
                    delete ch.dataset.virtualized;

                    // Re-apply settings to restored content
                    applySettings();

                    log('VIRTUAL', `Restored ${chapterId}`);
                }
            }
        }
    });
}

// Debounced virtualization on scroll
let virtualizeTimeout: number | null = null;
export function scheduleVirtualization(): void {
    if (virtualizeTimeout) clearTimeout(virtualizeTimeout);
    virtualizeTimeout = window.setTimeout(() => {
        virtualizeChapters();
    }, 200);
}
