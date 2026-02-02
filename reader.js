/**
 * Vesper Novel Reader - Enterprise Standard v1.2
 * Mandate: Absolute Resilience, Cache Resilience, Deterministic State
 */

const VesperSystem = {
    state: {
        manifest: null,
        currentArcIdx: 0,
        currentChapterIdx: 0,
        isLoading: true
    },

    // Selected on init
    elements: {},

    log(module, message, data = '') {
        console.log(`[VESPER_${module}] ${message}`, data);
    },

    error(module, message, err) {
        console.error(`[VESPER_${module}_ERROR] ${message}`, err);
        this.showErrorScreen(`${message}. Status: ${err.message}`);
    },

    async init() {
        this.log('BOOT', 'Igniting Neural Substrate...');
        
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
            
            // 4. Restore Context
            await this.syncProgress();
            
            // 5. Clear Overlay
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
            'theme-toggle', 'chapter-list', 'loading-overlay', 'loading-status'
        ];
        
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) console.warn(`[VESPER_BOOT_WARN] Element missing: ${id}`);
            // Map hyphenated ID to camelCase for the system
            const camelId = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
            this.elements[camelId] = el;
        });

        // Attach listeners if elements exist
        if (this.elements.menuToggle) this.elements.menuToggle.onclick = () => this.toggleMenu(true);
        if (this.elements.closeMenu) this.elements.closeMenu.onclick = () => this.toggleMenu(false);
        if (this.elements.overlay) this.elements.overlay.onclick = () => this.toggleMenu(false);
        if (this.elements.themeToggle) this.elements.themeToggle.onclick = () => this.toggleTheme();
        if (this.elements.prevChapter) this.elements.prevChapter.onclick = () => this.handlePrev();
        if (this.elements.nextChapter) this.elements.nextChapter.onclick = () => this.handleNext();
    },

    updateLoading(status) {
        if (this.elements.loadingStatus) {
            this.elements.loadingStatus.textContent = status;
        }
    },

    showErrorScreen(msg) {
        if (this.elements.content) {
            this.elements.content.innerHTML = `
                <div class="error-card">
                    <h3>Critical Logic Drift</h3>
                    <p>${msg}</p>
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

            arc.chapters.forEach((ch, cIdx) => {
                const item = document.createElement('a');
                item.className = 'chapter-item';
                item.href = '#';
                item.textContent = `Chapter ${ch.id}: ${ch.name}`;
                item.onclick = (e) => {
                    e.preventDefault();
                    this.navigateToChapter(aIdx, cIdx);
                    this.toggleMenu(false);
                };
                this.elements.chapterList.appendChild(item);
            });
        });
    },

    async navigateToChapter(aIdx, cIdx) {
        if (!this.state.manifest) return;
        
        const arc = this.state.manifest.arcs[aIdx];
        const ch = arc.chapters[cIdx];
        
        if (!arc || !ch) return;

        this.state.currentArcIdx = aIdx;
        this.state.currentChapterIdx = cIdx;

        try {
            const path = `./chapters/arc_${String(arc.number).padStart(2, '0')}/chapter_${ch.id}.md?v=${Date.now()}`;
            const response = await fetch(path);
            
            if (!response.ok) throw new Error(`Chapter Fragment missing (HTTP ${response.status})`);
            
            const text = await response.text();
            
            // Deterministic Filter: Remove metadata headers
            const lines = text.split('\n').filter(line => 
                !line.startsWith('Arc ') && !line.startsWith('Chapter ')
            );
            
            if (this.elements.content) {
                this.elements.content.innerHTML = marked.parse(lines.join('\n'));
            }
            
            if (this.elements.chapterInfo) {
                this.elements.chapterInfo.textContent = `Arc ${arc.number} • Chapter ${ch.id}`;
            }
            
            window.scrollTo(0, 0);
            this.updateNavButtons();
            this.saveProgress();
        } catch (err) {
            this.error('NAV', 'Failed to render chapter', err);
        }
    },

    updateNavButtons() {
        if (!this.elements.prevChapter || !this.elements.nextChapter) return;

        const isFirst = this.state.currentArcIdx === 0 && this.state.currentChapterIdx === 0;
        const totalArcs = this.state.manifest.arcs.length;
        const currentArcChapters = this.state.manifest.arcs[this.state.currentArcIdx].chapters.length;
        const isLast = this.state.currentArcIdx === totalArcs - 1 && 
                       this.state.currentChapterIdx === currentArcChapters - 1;

        this.elements.prevChapter.disabled = isFirst;
        this.elements.nextChapter.disabled = isLast;
    },

    handlePrev() {
        if (this.state.currentChapterIdx > 0) {
            this.navigateToChapter(this.state.currentArcIdx, this.state.currentChapterIdx - 1);
        } else if (this.state.currentArcIdx > 0) {
            const prevArcIdx = this.state.currentArcIdx - 1;
            const prevArcChapters = this.state.manifest.arcs[prevArcIdx].chapters.length;
            this.navigateToChapter(prevArcIdx, prevArcChapters - 1);
        }
    },

    handleNext() {
        const arc = this.state.manifest.arcs[this.state.currentArcIdx];
        if (this.state.currentChapterIdx < arc.chapters.length - 1) {
            this.navigateToChapter(this.state.currentArcIdx, this.state.currentChapterIdx + 1);
        } else if (this.state.currentArcIdx < this.state.manifest.arcs.length - 1) {
            this.navigateToChapter(this.state.currentArcIdx + 1, 0);
        }
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
        const progress = { a: this.state.currentArcIdx, c: this.state.currentChapterIdx };
        localStorage.setItem('vesper-progress', JSON.stringify(progress));
    },

    async syncProgress() {
        const saved = localStorage.getItem('vesper-progress');
        if (saved) {
            try {
                const { a, c } = JSON.parse(saved);
                if (this.state.manifest.arcs[a] && this.state.manifest.arcs[a].chapters[c]) {
                    await this.navigateToChapter(a, c);
                    return;
                }
            } catch (e) {
                localStorage.removeItem('vesper-progress');
            }
        }
        await this.navigateToChapter(0, 0);
    }
};

// Ignition
window.onload = () => VesperSystem.init();
