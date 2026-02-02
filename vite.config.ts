import { defineConfig } from 'vite'

export default defineConfig({
    base: '/the-sky-garden-of-tiny-joys/',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
    },
    publicDir: 'public',
})
