/**
 * Vesper Novel Reader - Enterprise Standard v2.0
 * Infinite Scroll Edition with Giscus Comments
 */

const VesperSystem = {
    state: {
        manifest: null,
        currentArcIdx: 0,
        loadedChapters: [], // Array of {arcIdx, chapterIdx} that are in DOM
        isLoadingChapter: false,
        isLoading: true
    },

    // Selected on init
    elements: {},

    // Giscus config
    giscusConfig: {
        repo: 'vespersigma/the-sky-garden-of-tiny-joys',
        repoId: 'R_kgDORGoMVg',
        category: 'Announcements',
        categoryId: 'DIC_kwDORGoMVs4C1wnE'
    },

    log(module, message, data = '') {
        console.log(`[VESPER_${module}] ${message}`, data);
    },

    error(module, message, err) {
        console.error(`[VESPER_${module}_ERROR] ${message}`, err);
        this.showErrorScreen(`${message}. Status: ${err.message}`);
    },

    async init() {
        this.log('BOOT', 'Igniting Neural Substrate v2.0...');

        // 1. Map Elements with Null Checks
        this.mapElements();

        try {
            // 2. Load Data
            this.updateLoading('Fetching Manifest...');
            const response = await fetch('./manifest.json?t=' + Date.now());

            if (!response.ok) {
                throw new Error(`Connection Lost (HTTP ${response.status})`);
            }

            this.state.manifest = await response.json();
            this.log('INIT', 'Ledger Synchronized.');

            // 3. Setup UI
            this.renderSidebar();
            this.applySavedTheme();
            this.applySavedFontSize();

            // 4. Restore Context or start fresh
            await this.syncProgress();

            // 5. Setup Infinite Scroll
            this.setupInfiniteScroll();

            // 6. Clear Overlay
            if (this.elements.loadingOverlay) {
                this.elements.loadingOverlay.classList.add('hidden');
            }
            this.state.isLoading = false;
            this.log('INIT', 'System Nominal.');
        } catch (err) {
            this.error('INIT', 'Sync Failure', err);
        }
    },

    mapElements() {
        const ids = [
            'content', 'chapter-info', 'prev-chapter', 'next-chapter',
            'menu-toggle', 'close-menu', 'sidebar', 'overlay',
            'theme-toggle', 'chapter-list', 'loading-overlay', 'loading-status',
            'progress-bar', 'font-increase', 'font-decrease'
        ];

        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) console.warn(`[VESPER_BOOT_WARN] Element missing: ${id}`);
            const camelId = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
            this.elements[camelId] = el;
        });

        // Attach listeners
        if (this.elements.menuToggle) this.elements.menuToggle.onclick = () => this.toggleMenu(true);
        if (this.elements.closeMenu) this.elements.closeMenu.onclick = () => this.toggleMenu(false);
        if (this.elements.overlay) this.elements.overlay.onclick = () => this.toggleMenu(false);
        if (this.elements.themeToggle) this.elements.themeToggle.onclick = () => this.toggleTheme();
        if (this.elements.prevChapter) this.elements.prevChapter.onclick = () => this.navigateToArc(this.state.currentArcIdx - 1);
        if (this.elements.nextChapter) this.elements.nextChapter.onclick = () => this.navigateToArc(this.state.currentArcIdx + 1);

        // Font size controls
        if (this.elements.fontIncrease) this.elements.fontIncrease.onclick = () => this.adjustFontSize(1);
        if (this.elements.fontDecrease) this.elements.fontDecrease.onclick = () => this.adjustFontSize(-1);

        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Scroll progress
        window.addEventListener('scroll', () => this.updateProgressBar());
    },

    // === INFINITE SCROLL ===

    setupInfiniteScroll() {
        // Create sentinel element at bottom of content
        this.scrollSentinel = document.createElement('div');
        this.scrollSentinel.id = 'scroll-sentinel';
        this.scrollSentinel.style.height = '1px';
        if (this.elements.content) {
            this.elements.content.appendChild(this.scrollSentinel);
        }

        // Intersection Observer to detect when user nears bottom
        this.scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.state.isLoadingChapter) {
                    this.loadNextChapterInArc();
                }
            });
        }, {
            rootMargin: '200px' // Load when 200px from bottom
        });

        this.scrollObserver.observe(this.scrollSentinel);
    },

    async loadNextChapterInArc() {
        if (this.state.isLoadingChapter) return;

        const arc = this.state.manifest.arcs[this.state.currentArcIdx];
        const lastLoaded = this.state.loadedChapters[this.state.loadedChapters.length - 1];

        if (!lastLoaded) return;

        const nextChapterIdx = lastLoaded.chapterIdx + 1;

        // Check if we've reached end of arc
        if (nextChapterIdx >= arc.chapters.length) {
            // Don't auto-load, arc end card handles navigation
            return;
        }

        await this.appendChapter(this.state.currentArcIdx, nextChapterIdx);
    },

    async appendChapter(arcIdx, chapterIdx) {
        if (this.state.isLoadingChapter) return;
        this.state.isLoadingChapter = true;

        const arc = this.state.manifest.arcs[arcIdx];
        const ch = arc.chapters[chapterIdx];

        if (!arc || !ch) {
            this.state.isLoadingChapter = false;
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
            contentDiv.innerHTML = marked.parse(lines.join('\n'));
            chapterDiv.appendChild(contentDiv);

            // Comment preview
            const commentPreview = this.createCommentPreview(arcIdx, chapterIdx, ch);
            chapterDiv.appendChild(commentPreview);

            // Check if this is the last chapter in arc
            const isLastInArc = chapterIdx === arc.chapters.length - 1;
            if (isLastInArc) {
                const arcEndCard = this.createArcEndCard(arcIdx);
                chapterDiv.appendChild(arcEndCard);
            } else {
                // Add chapter divider
                const divider = document.createElement('div');
                divider.className = 'chapter-divider';
                chapterDiv.appendChild(divider);
            }

            // Insert before sentinel
            if (this.scrollSentinel && this.scrollSentinel.parentNode) {
                this.scrollSentinel.parentNode.insertBefore(chapterDiv, this.scrollSentinel);
            }

            // Track loaded chapter
            this.state.loadedChapters.push({ arcIdx, chapterIdx });
            this.saveProgress();
            this.log('SCROLL', `Loaded Chapter ${ch.id}: ${ch.name}`);

        } catch (err) {
            this.error('SCROLL', 'Failed to load chapter', err);
        } finally {
            this.state.isLoadingChapter = false;
        }
    },

    createCommentPreview(arcIdx, chapterIdx, chapter) {
        const container = document.createElement('div');
        container.className = 'comment-preview';
        container.dataset.arcIdx = arcIdx;
        container.dataset.chapterIdx = chapterIdx;
        container.dataset.chapterId = `arc-${arcIdx + 1}-chapter-${chapter.id}`;

        container.innerHTML = `
            <div class="comment-preview-header">
                <span class="comment-icon">💬</span>
                <span class="comment-text">Readers shared their thoughts on this chapter...</span>
            </div>
            <div class="comment-preview-hint">Click to join the discussion</div>
        `;

        container.onclick = () => this.expandComments(container);

        return container;
    },

    expandComments(container) {
        // If already expanded, collapse
        if (container.classList.contains('expanded')) {
            container.classList.remove('expanded');
            const giscusFrame = container.querySelector('.giscus-frame');
            if (giscusFrame) giscusFrame.remove();
            return;
        }

        container.classList.add('expanded');

        // Create Giscus container
        const giscusDiv = document.createElement('div');
        giscusDiv.className = 'giscus-frame';

        // Create Giscus script
        const script = document.createElement('script');
        script.src = 'https://giscus.app/client.js';
        script.dataset.repo = this.giscusConfig.repo;
        script.dataset.repoId = this.giscusConfig.repoId || '';
        script.dataset.category = this.giscusConfig.category;
        script.dataset.categoryId = this.giscusConfig.categoryId || '';
        script.dataset.mapping = 'specific';
        script.dataset.term = container.dataset.chapterId;
        script.dataset.strict = '0';
        script.dataset.reactionsEnabled = '1';
        script.dataset.emitMetadata = '0';
        script.dataset.inputPosition = 'bottom';
        script.dataset.theme = document.body.classList.contains('silver-breath') ? 'dark' : 'light';
        script.dataset.lang = 'en';
        script.crossOrigin = 'anonymous';
        script.async = true;

        giscusDiv.appendChild(script);
        container.appendChild(giscusDiv);
    },

    createArcEndCard(arcIdx) {
        const arc = this.state.manifest.arcs[arcIdx];
        const hasNextArc = arcIdx < this.state.manifest.arcs.length - 1;
        const nextArc = hasNextArc ? this.state.manifest.arcs[arcIdx + 1] : null;

        const card = document.createElement('div');
        card.className = 'arc-end-card';

        if (hasNextArc) {
            card.innerHTML = `
                <div class="arc-end-decoration">✨</div>
                <h3 class="arc-end-title">End of Arc ${arc.number}</h3>
                <p class="arc-end-subtitle">${arc.name}</p>
                <div class="arc-end-divider"></div>
                <p class="arc-end-next">Continue to</p>
                <p class="arc-end-next-title">Arc ${nextArc.number}: ${nextArc.name}</p>
                <button class="arc-continue-btn" onclick="VesperSystem.navigateToArc(${arcIdx + 1})">
                    Continue Reading →
                </button>
            `;
        } else {
            card.innerHTML = `
                <div class="arc-end-decoration">🌟</div>
                <h3 class="arc-end-title">The End</h3>
                <p class="arc-end-subtitle">${arc.name}</p>
                <p class="arc-end-thanks">Thank you for reading!</p>
            `;
        }

        return card;
    },

    // === NAVIGATION ===

    async navigateToArc(arcIdx) {
        if (arcIdx < 0 || arcIdx >= this.state.manifest.arcs.length) return;

        // Clear content and reset state
        this.state.currentArcIdx = arcIdx;
        this.state.loadedChapters = [];

        if (this.elements.content) {
            this.elements.content.innerHTML = '';
            // Re-add sentinel
            this.scrollSentinel = document.createElement('div');
            this.scrollSentinel.id = 'scroll-sentinel';
            this.scrollSentinel.style.height = '1px';
            this.elements.content.appendChild(this.scrollSentinel);
            this.scrollObserver.observe(this.scrollSentinel);
        }

        // Update nav info
        const arc = this.state.manifest.arcs[arcIdx];
        if (this.elements.chapterInfo) {
            this.elements.chapterInfo.textContent = `Arc ${arc.number}: ${arc.name}`;
        }

        // Load first chapter
        await this.appendChapter(arcIdx, 0);

        window.scrollTo(0, 0);
        this.updateNavButtons();
        this.saveProgress();
    },

    updateNavButtons() {
        if (!this.elements.prevChapter || !this.elements.nextChapter) return;

        this.elements.prevChapter.disabled = this.state.currentArcIdx === 0;
        this.elements.prevChapter.textContent = 'Prev Arc';

        this.elements.nextChapter.disabled = this.state.currentArcIdx >= this.state.manifest.arcs.length - 1;
        this.elements.nextChapter.textContent = 'Next Arc';
    },

    // === UI HELPERS ===

    updateLoading(status) {
        if (this.elements.loadingStatus) {
            this.elements.loadingStatus.textContent = status;
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    showErrorScreen(msg) {
        if (this.elements.content) {
            this.elements.content.innerHTML = `
                <div class="error-card">
                    <h3>Critical Logic Drift</h3>
                    <p>${this.escapeHtml(msg)}</p>
                    <button onclick="location.reload()" style="margin-top:15px; color:var(--accent-color); font-weight:bold;">Retry Synchronization</button>
                </div>
            `;
        }
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.style.display = 'none';
        }
    },

    renderSidebar() {
        if (!this.state.manifest || !this.state.manifest.arcs || !this.elements.chapterList) return;

        this.elements.chapterList.innerHTML = '';
        this.state.manifest.arcs.forEach((arc, aIdx) => {
            const title = document.createElement('div');
            title.className = 'arc-title';
            title.textContent = `Arc ${arc.number}: ${arc.name}`;
            this.elements.chapterList.appendChild(title);

            // Make arc title clickable
            const arcLink = document.createElement('a');
            arcLink.className = 'chapter-item arc-link';
            arcLink.href = '#';
            arcLink.textContent = `📖 Start Arc ${arc.number}`;
            arcLink.onclick = (e) => {
                e.preventDefault();
                this.navigateToArc(aIdx);
                this.toggleMenu(false);
            };
            this.elements.chapterList.appendChild(arcLink);
        });
    },

    toggleMenu(show) {
        if (this.elements.sidebar && this.elements.overlay) {
            this.elements.sidebar.classList.toggle('hidden', !show);
            this.elements.overlay.classList.toggle('hidden', !show);
        }
    },

    toggleTheme() {
        document.body.classList.toggle('daylight');
        document.body.classList.toggle('silver-breath');
        const isDaylight = document.body.classList.contains('daylight');
        if (this.elements.themeToggle) {
            this.elements.themeToggle.textContent = isDaylight ? '🌙' : '☀️';
        }
        localStorage.setItem('vesper-theme', isDaylight ? 'daylight' : 'silver');

        // Update Giscus theme if any are loaded
        document.querySelectorAll('iframe.giscus-frame').forEach(iframe => {
            iframe.contentWindow.postMessage({
                giscus: { setConfig: { theme: isDaylight ? 'light' : 'dark' } }
            }, 'https://giscus.app');
        });
    },

    applySavedTheme() {
        const savedTheme = localStorage.getItem('vesper-theme');
        if (savedTheme === 'silver') {
            document.body.classList.remove('daylight');
            document.body.classList.add('silver-breath');
            if (this.elements.themeToggle) this.elements.themeToggle.textContent = '☀️';
        }
    },

    saveProgress() {
        const progress = { arc: this.state.currentArcIdx };
        localStorage.setItem('vesper-progress', JSON.stringify(progress));
    },

    async syncProgress() {
        const saved = localStorage.getItem('vesper-progress');
        if (saved) {
            try {
                const { arc } = JSON.parse(saved);
                if (this.state.manifest.arcs[arc]) {
                    await this.navigateToArc(arc);
                    return;
                }
            } catch (e) {
                localStorage.removeItem('vesper-progress');
            }
        }
        await this.navigateToArc(0);
    },

    // === FEATURES ===

    updateProgressBar() {
        if (!this.elements.progressBar) return;
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        this.elements.progressBar.style.width = progress + '%';
    },

    adjustFontSize(delta) {
        const content = this.elements.content;
        if (!content) return;

        let currentSize = parseFloat(localStorage.getItem('vesper-font-size')) || 1.15;
        currentSize = Math.max(0.9, Math.min(1.6, currentSize + (delta * 0.1)));

        content.style.fontSize = currentSize + 'rem';
        localStorage.setItem('vesper-font-size', currentSize);
        this.log('UI', `Font size: ${currentSize.toFixed(2)}rem`);
    },

    applySavedFontSize() {
        const savedSize = localStorage.getItem('vesper-font-size');
        if (savedSize && this.elements.content) {
            this.elements.content.style.fontSize = savedSize + 'rem';
        }
    },

    handleKeyboard(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key) {
            case 'ArrowLeft':
                this.navigateToArc(this.state.currentArcIdx - 1);
                break;
            case 'ArrowRight':
                this.navigateToArc(this.state.currentArcIdx + 1);
                break;
            case 'Escape':
                this.toggleMenu(false);
                break;
        }
    }
};

// Ignition
window.onload = () => VesperSystem.init();
