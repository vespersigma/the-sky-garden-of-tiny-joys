import { giscusConfig } from './state';
import type { Chapter } from '../types';
import { log } from './utils';

// Track which chapter has expanded comments
let currentExpandedChapterId: string | null = null;

export function createCommentPreview(arcIdx: number, chapterIdx: number, chapter: Chapter): HTMLElement {
  const container = document.createElement('div');
  container.className = 'comment-preview';
  container.dataset.arcIdx = arcIdx.toString();
  container.dataset.chapterIdx = chapterIdx.toString();
  container.dataset.chapterId = `arc-${arcIdx + 1}-chapter-${chapter.id}`;

  container.innerHTML = `
    <div class="comment-preview-header">
      <span class="comment-icon">💬</span>
      <span class="comment-text">Readers shared their thoughts on this chapter...</span>
    </div>
    <div class="comment-preview-hint">Click to join the discussion</div>
  `;

  container.onclick = () => toggleComments(container);

  return container;
}

export function toggleComments(container: HTMLElement): void {
  if (container.classList.contains('expanded')) {
    collapseComments(container);
  } else {
    expandComments(container);
  }
}

export function collapseComments(container: HTMLElement): void {
  container.classList.remove('expanded');
  const giscusFrame = container.querySelector('.giscus-frame');
  if (giscusFrame) giscusFrame.remove();

  if (currentExpandedChapterId === container.dataset.chapterId) {
    currentExpandedChapterId = null;
  }
}

export function expandComments(container: HTMLElement): void {
  // Collapse any currently expanded comments first
  if (currentExpandedChapterId && currentExpandedChapterId !== container.dataset.chapterId) {
    const currentExpanded = document.querySelector(`.comment-preview[data-chapter-id="${currentExpandedChapterId}"]`);
    if (currentExpanded) {
      collapseComments(currentExpanded as HTMLElement);
    }
  }

  // If already expanded, don't re-expand
  if (container.classList.contains('expanded')) return;

  container.classList.add('expanded');
  currentExpandedChapterId = container.dataset.chapterId || null;

  // Create Giscus container
  const giscusDiv = document.createElement('div');
  giscusDiv.className = 'giscus-frame';

  // Create Giscus script
  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.dataset.repo = giscusConfig.repo;
  script.dataset.repoId = giscusConfig.repoId;
  script.dataset.category = giscusConfig.category;
  script.dataset.categoryId = giscusConfig.categoryId;
  script.dataset.mapping = 'specific';
  script.dataset.term = container.dataset.chapterId || '';
  script.dataset.strict = '1';
  script.dataset.reactionsEnabled = '1';
  script.dataset.emitMetadata = '0';
  script.dataset.inputPosition = 'bottom';
  script.dataset.theme = document.body.classList.contains('silver-breath') ? 'dark' : 'light';
  script.dataset.lang = 'en';
  script.dataset.loading = 'lazy';
  script.crossOrigin = 'anonymous';
  script.async = true;

  giscusDiv.appendChild(script);
  container.appendChild(giscusDiv);

  log('COMMENTS', `Expanded comments for ${container.dataset.chapterId}`);
}

/**
 * Auto-expand comments for the chapter currently in viewport
 * Called periodically when user stops scrolling
 */
export function autoExpandCurrentChapterComments(): void {
  const chapters = document.querySelectorAll('.chapter-section');
  const viewportCenter = window.innerHeight / 2;

  let currentChapter: Element | null = null;

  for (const ch of chapters) {
    const rect = ch.getBoundingClientRect();
    // Check if chapter header is in upper portion of viewport
    if (rect.top < viewportCenter && rect.bottom > viewportCenter / 2) {
      currentChapter = ch;
    }
  }

  if (!currentChapter) return;

  const commentPreview = currentChapter.querySelector('.comment-preview') as HTMLElement;
  if (!commentPreview) return;

  // Only auto-expand if not already expanded
  if (!commentPreview.classList.contains('expanded')) {
    expandComments(commentPreview);
  }
}
