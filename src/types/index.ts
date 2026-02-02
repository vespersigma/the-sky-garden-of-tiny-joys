// Manifest types
export interface Chapter {
    id: string;
    name: string;
}

export interface Arc {
    number: number;
    name: string;
    chapters: Chapter[];
}

export interface Manifest {
    title: string;
    author?: string;
    status?: 'ongoing' | 'completed' | 'hiatus';
    arcs: Arc[];
}

// App state types
export interface AppState {
    manifest: Manifest | null;
    currentArcIdx: number;
    loadedChapters: LoadedChapter[];
    isLoadingChapter: boolean;
    isLoading: boolean;
}

export interface LoadedChapter {
    arcIdx: number;
    chapterIdx: number;
}

// DOM elements map
export interface ElementsMap {
    content: HTMLElement | null;
    chapterInfo: HTMLElement | null;
    prevChapter: HTMLButtonElement | null;
    nextChapter: HTMLButtonElement | null;
    menuToggle: HTMLButtonElement | null;
    closeMenu: HTMLButtonElement | null;
    sidebar: HTMLElement | null;
    overlay: HTMLElement | null;
    themeToggle: HTMLButtonElement | null;
    chapterList: HTMLElement | null;
    loadingOverlay: HTMLElement | null;
    loadingStatus: HTMLElement | null;
    progressBar: HTMLElement | null;
    zenToggle: HTMLButtonElement | null;
    settingsToggle: HTMLButtonElement | null;
}

// Giscus config
export interface GiscusConfig {
    repo: string;
    repoId: string;
    category: string;
    categoryId: string;
}
