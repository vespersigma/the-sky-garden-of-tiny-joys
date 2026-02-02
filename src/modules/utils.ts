// Simple logging utilities
// Logs only show in development (localhost)

const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export function log(module: string, message: string, data: unknown = ''): void {
    if (isDev) {
        console.log(`[VESPER_${module}] ${message}`, data);
    }
}

export function error(module: string, message: string, err: Error): void {
    // Always log errors
    console.error(`[VESPER_${module}_ERROR] ${message}`, err);
}

export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
