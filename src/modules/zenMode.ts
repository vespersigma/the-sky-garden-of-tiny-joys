import { log } from './utils';

export function createZenExitButton(): void {
    const exitBtn = document.createElement('button');
    exitBtn.id = 'zen-exit';
    exitBtn.innerHTML = '✕';
    exitBtn.title = 'Exit Zen Mode (Esc)';
    exitBtn.onclick = () => toggleZenMode();
    document.body.appendChild(exitBtn);
}

export function toggleZenMode(): void {
    document.body.classList.toggle('zen-mode');
    const isZen = document.body.classList.contains('zen-mode');

    if (isZen) {
        log('ZEN', 'Entering tranquility...');
        window.scrollBy(0, -50);
    } else {
        log('ZEN', 'Returning to reality.');
    }

    localStorage.setItem('vesper-zen', isZen ? 'on' : 'off');
}

export function applySavedZenMode(): void {
    const savedZen = localStorage.getItem('vesper-zen');
    if (savedZen === 'on') {
        document.body.classList.add('zen-mode');
    }
}

export function isZenMode(): boolean {
    return document.body.classList.contains('zen-mode');
}
