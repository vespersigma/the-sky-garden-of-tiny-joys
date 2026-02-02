const contentEl = document.getElementById('content');
const chapterInfoEl = document.getElementById('chapter-info');
const prevBtn = document.getElementById('prev-chapter');
const nextBtn = document.getElementById('next-chapter');
const menuToggle = document.getElementById('menu-toggle');
const closeMenu = document.getElementById('close-menu');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const themeToggle = document.getElementById('theme-toggle');
const chapterListEl = document.getElementById('chapter-list');

let manifest = null;
let currentArcIdx = 0;
let currentChapterIdx = 0;

async function init() {
    try {
        const response = await fetch('manifest.json');
        manifest = await response.json();
        renderSidebar();
        checkProgress();
    } catch (err) {
        console.error('Failed to load manifest:', err);
        contentEl.innerHTML = '<p>Error loading story data. Please try again later.</p>';
    }
}

function renderSidebar() {
    chapterListEl.innerHTML = '';
    manifest.arcs.forEach((arc, aIdx) => {
        const title = document.createElement('div');
        title.className = 'arc-title';
        title.textContent = `Arc ${arc.number}: ${arc.name}`;
        chapterListEl.appendChild(title);

        arc.chapters.forEach((ch, cIdx) => {
            const item = document.createElement('a');
            item.className = 'chapter-item';
            item.href = '#';
            item.textContent = `Chapter ${ch.id}: ${ch.name}`;
            item.onclick = (e) => {
                e.preventDefault();
                loadChapter(aIdx, cIdx);
                toggleMenu(false);
            };
            chapterListEl.appendChild(item);
        });
    });
}

async function loadChapter(aIdx, cIdx) {
    if (!manifest) return;
    const arc = manifest.arcs[aIdx];
    const ch = arc.chapters[cIdx];
    
    currentArcIdx = aIdx;
    currentChapterIdx = cIdx;

    try {
        const path = `chapters/arc_${String(arc.number).padStart(2, '0')}/chapter_${ch.id}.md`;
        const response = await fetch(path);
        if (!response.ok) throw new Error('File not found');
        const text = await response.text();
        
        // Remove metadata lines
        const lines = text.split('\n').filter(line => !line.startsWith('Arc ') && !line.startsWith('Chapter '));
        
        contentEl.innerHTML = marked.parse(lines.join('\n'));
        chapterInfoEl.textContent = `Arc ${arc.number} • Chapter ${ch.id}`;
        
        window.scrollTo(0, 0);
        updateNavButtons();
        saveProgress();
    } catch (err) {
        console.error('Failed to load chapter:', err);
        contentEl.innerHTML = `<p>Error loading chapter content: ${err.message}</p>`;
    }
}

function updateNavButtons() {
    const isFirst = currentArcIdx === 0 && currentChapterIdx === 0;
    const isLast = currentArcIdx === manifest.arcs.length - 1 && 
                   currentChapterIdx === manifest.arcs[currentArcIdx].chapters.length - 1;

    prevBtn.disabled = isFirst;
    nextBtn.disabled = isLast;
}

prevBtn.onclick = () => {
    if (currentChapterIdx > 0) {
        loadChapter(currentArcIdx, currentChapterIdx - 1);
    } else if (currentArcIdx > 0) {
        const prevArcIdx = currentArcIdx - 1;
        loadChapter(prevArcIdx, manifest.arcs[prevArcIdx].chapters.length - 1);
    }
};

nextBtn.onclick = () => {
    const arc = manifest.arcs[currentArcIdx];
    if (currentChapterIdx < arc.chapters.length - 1) {
        loadChapter(currentArcIdx, currentChapterIdx + 1);
    } else if (currentArcIdx < manifest.arcs.length - 1) {
        loadChapter(currentArcIdx + 1, 0);
    }
};

function toggleMenu(show) {
    sidebar.classList.toggle('hidden', !show);
    overlay.classList.toggle('hidden', !show);
}

menuToggle.onclick = () => toggleMenu(true);
closeMenu.onclick = () => toggleMenu(false);
overlay.onclick = () => toggleMenu(false);

themeToggle.onclick = () => {
    document.body.classList.toggle('daylight');
    document.body.classList.toggle('silver-breath');
    themeToggle.textContent = document.body.classList.contains('daylight') ? '🌙' : '☀️';
    localStorage.setItem('vesper-theme', document.body.classList.contains('daylight') ? 'daylight' : 'silver');
};

function saveProgress() {
    const progress = { a: currentArcIdx, c: currentChapterIdx };
    localStorage.setItem('vesper-progress', JSON.stringify(progress));
}

function checkProgress() {
    const saved = localStorage.getItem('vesper-progress');
    const savedTheme = localStorage.getItem('vesper-theme');

    if (savedTheme === 'silver') {
        document.body.classList.remove('daylight');
        document.body.classList.add('silver-breath');
        themeToggle.textContent = '☀️';
    }

    if (saved) {
        const { a, c } = JSON.parse(saved);
        // Ensure indices are still valid in manifest
        if (manifest.arcs[a] && manifest.arcs[a].chapters[c]) {
            loadChapter(a, c);
        } else {
            loadChapter(0, 0);
        }
    } else {
        loadChapter(0, 0);
    }
}

init();
