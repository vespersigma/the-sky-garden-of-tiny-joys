import fs from 'fs';
import path from 'path';

const CHAPTERS_DIR = './public/chapters';
const MANIFEST_PATH = './public/manifest.json';

// Story metadata (edit these)
const STORY_META = {
    title: 'The Sky-Garden of Tiny Joys',
    author: 'Anonymous',
    status: 'ongoing' as const, // 'ongoing' | 'completed' | 'hiatus'
};

interface Chapter {
    id: string;
    name: string;
}

interface Arc {
    number: number;
    name: string;
    chapters: Chapter[];
}

interface Manifest {
    title: string;
    author: string;
    status: 'ongoing' | 'completed' | 'hiatus';
    arcs: Arc[];
}

function extractChapterName(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Look for first heading or first non-empty line
    for (const line of lines) {
        const trimmed = line.trim();
        // Skip metadata lines like "Arc 1" or "Chapter 01"
        if (trimmed.startsWith('Arc ') || trimmed.startsWith('Chapter ')) continue;
        // Use markdown heading
        if (trimmed.startsWith('# ')) {
            return trimmed.replace(/^#+\s*/, '');
        }
    }

    // Fallback: use filename
    return path.basename(filePath, '.md').replace(/_/g, ' ');
}

function extractArcName(arcDir: string): string {
    // Check if there's an arc_info.txt or similar
    const infoPath = path.join(arcDir, 'arc_info.txt');
    if (fs.existsSync(infoPath)) {
        return fs.readFileSync(infoPath, 'utf-8').trim();
    }

    // Try to get name from first chapter's metadata
    const chapters = fs.readdirSync(arcDir).filter(f => f.endsWith('.md')).sort();
    if (chapters.length > 0) {
        const content = fs.readFileSync(path.join(arcDir, chapters[0]), 'utf-8');
        const arcMatch = content.match(/^Arc \d+[:\s]+(.+)$/m);
        if (arcMatch) {
            return arcMatch[1].trim();
        }
    }

    // Fallback: use folder name
    const match = arcDir.match(/arc_(\d+)/);
    return match ? `Arc ${parseInt(match[1])}` : 'Unknown Arc';
}

function generateManifest(): void {
    console.log('🔍 Scanning chapters directory...');

    if (!fs.existsSync(CHAPTERS_DIR)) {
        console.error(`❌ Chapters directory not found: ${CHAPTERS_DIR}`);
        process.exit(1);
    }

    const arcDirs = fs.readdirSync(CHAPTERS_DIR)
        .filter(f => f.startsWith('arc_'))
        .sort();

    const arcs: Arc[] = [];

    for (const arcDir of arcDirs) {
        const arcPath = path.join(CHAPTERS_DIR, arcDir);
        const arcNumber = parseInt(arcDir.replace('arc_', ''));

        console.log(`  📁 Found ${arcDir}`);

        const chapterFiles = fs.readdirSync(arcPath)
            .filter(f => f.startsWith('chapter_') && f.endsWith('.md'))
            .sort();

        const chapters: Chapter[] = [];

        for (const chapterFile of chapterFiles) {
            const chapterPath = path.join(arcPath, chapterFile);
            const chapterId = chapterFile.replace('chapter_', '').replace('.md', '');
            const chapterName = extractChapterName(chapterPath);

            console.log(`    📄 ${chapterId}: ${chapterName}`);

            chapters.push({
                id: chapterId,
                name: chapterName,
            });
        }

        arcs.push({
            number: arcNumber,
            name: extractArcName(arcPath),
            chapters,
        });
    }

    const manifest: Manifest = {
        ...STORY_META,
        arcs,
    };

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 4));
    console.log(`\n✅ Generated manifest with ${arcs.length} arc(s), ${arcs.reduce((sum, a) => sum + a.chapters.length, 0)} chapter(s)`);
    console.log(`   Written to: ${MANIFEST_PATH}`);
}

generateManifest();
