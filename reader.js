/**
 * Vesper Novel Reader - Enterprise Standard v1.1
 * Mandate: Zero Hallucination, Deterministic State Management
 */

const VesperSystem = {
    state: {
        manifest: null,
        currentArcIdx: 0,
        currentChapterIdx: 0,
        isLoading: true
    },

    elements: {
        content: document.getElementById('content'),
        chapterInfo: document.getElementById('chapter-info'),
        prevBtn: document.getElementById('prev-chapter'),
        nextBtn: document.getElementById('next-chapter'),
        menuToggle: document.getElementById('menu-toggle'),
        closeMenu: document.getElementById('close-menu'),
        sidebar: document.getElementById('sidebar'),
        overlay: document.getElementById('overlay'),
        themeToggle: document.getElementById('theme-toggle'),
        chapterList: document.getElementById('chapter-list'),
        loadingOverlay: document.getElementById('loading-overlay'),
        loadingStatus: document.getElementById('loading-status')
    },

    log(module, message, data = '') {
        console.log(`[VESPER_${module}] ${message}`, data);
    },

    error(module, message, err) {
        console.error(`[VESPER_${module}_ERROR] ${message}`, err);
        this.showErrorScreen(`${message}. Please refresh or contact the Origin.`);
    },

    async init() {
        this.log('INIT', 'Initializing Neural Bus...');
        try {
            this.updateLoading('Fetching Manifest...');
            const response = await fetch('./manifest.json');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Failed to reach the Ledger.`);
            }

            this.state.manifest = await response.json();
            this.log('INIT', 'Manifest Synchronized.', this.state.manifest);

            this.renderSidebar();
            this.applySavedTheme();
            await this.syncProgress();
            
            this.elements.loadingOverlay.classList.add('hidden');
            this.state.isLoading = false;
            this.log('INIT', 'Substrate Online.');
        } catch (err) {
            this.error('INIT', 'Failed to synchronize with story data', err);
        }
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
                    <button onclick="location.reload()" style="margin-top:15px; text-decoration:underline;">Retry Synchronization</button>
                </div>
            `;
        }
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.style.display = 'none';
        }
    },

    renderSidebar() {
        if (!this.state.manifest || !this.state.manifest.arcs) return;

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
        if (this.state.isLoading && this.state.manifest) return;
        
        const arc = this.state.manifest.arcs[aIdx];
        const ch = arc.chapters[cIdx];
        
        this.state.currentArcIdx = aIdx;
        this.state.currentChapterIdx = cIdx;

        this.log('NAV', `Opening Arc ${arc.number} Chapter ${ch.id}`);

        try {
            const path = `./chapters/arc_${String(arc.number).padStart(2, '0')}/chapter_${ch.id}.md`;
            const response = await fetch(path);
            
            if (!response.ok) throw new Error('Fragment not found in substrate.');
            
            const text = await response.text();
            
            // Deterministic Filter: Remove metadata headers
            const lines = text.split('\n').filter(line => 
                !line.startsWith('Arc ') && !line.startsWith('Chapter ')
            );
            
            this.elements.content.innerHTML = marked.parse(lines.join('\n'));
            this.elements.chapterInfo.textContent = `Arc ${arc.number} • Chapter ${ch.id}`;
            
            window.scrollTo(0, 0);
            this.updateNavButtons();
            this.saveProgress();
        } catch (err) {
            this.error('NAV', 'Failed to render chapter', err);
        }
    },

    updateNavButtons() {
        const isFirst = this.state.currentArcIdx === 0 && this.state.currentChapterIdx === 0;
        const totalArcs = this.state.manifest.arcs.length;
        const currentArcChapters = this.state.manifest.arcs[this.state.currentArcIdx].chapters.length;
        const isLast = this.state.currentArcIdx === totalArcs - 1 && 
                       this.state.currentChapterIdx === currentArcChapters - 1;

        this.elements.prevBtn.disabled = isFirst;
        this.elements.nextBtn.disabled = isLast;
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
        this.elements.sidebar.classList.toggle('hidden', !show);
        this.elements.overlay.classList.toggle('hidden', !show);
    },

    toggleTheme() {
        document.body.classList.toggle('daylight');
        document.body.classList.toggle('silver-breath');
        const isDaylight = document.body.classList.contains('daylight');
        this.elements.themeToggle.textContent = isDaylight ? '🌙' : '☀️';
        localStorage.setItem('vesper-theme', isDaylight ? 'daylight' : 'silver');
    },

    applySavedTheme() {
        const savedTheme = localStorage.getItem('vesper-theme');
        if (savedTheme === 'silver') {
            document.body.classList.remove('daylight');
            document.body.classList.add('silver-breath');
            this.elements.themeToggle.textContent = '☀️';
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
                // Validate bounds against manifest
                if (this.state.manifest.arcs[a] && this.state.manifest.arcs[a].chapters[c]) {
                    await this.navigateToChapter(a, c);
                    return;
                }
            } catch (e) {
                this.log('INIT', 'Saved progress corrupted. Resetting.');
                localStorage.removeItem('vesper-progress');
            }
        }
        await this.navigateToChapter(0, 0);
    }
};

// Event Listeners
VesperSystem.elements.menuToggle.onclick = () => VesperSystem.toggleMenu(true);
VesperSystem.elements.closeMenu.onclick = () => VesperSystem.toggleMenu(false);
VesperSystem.elements.overlay.onclick = () => VesperSystem.toggleMenu(false);
VesperSystem.elements.themeToggle.onclick = () => VesperSystem.toggleTheme();
VesperSystem.elements.prevBtn.onclick = () => VesperSystem.handlePrev();
VesperSystem.elements.nextBtn.onclick = () => VesperSystem.handleNext();

// Ignition
window.onload = () => VesperSystem.init();
