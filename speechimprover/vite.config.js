import { defineConfig } from 'vite';
import plugin from '@vitejs/plugin-react';

// https://vitejs.dev/config/
// On GitHub Pages the app is served from https://<user>.github.io/SpeechImprover/,
// so the deploy workflow sets GITHUB_PAGES=true to build with that base path.
// Local dev/build and other hosts stay at the root ("/").
export default defineConfig({
    base: process.env.GITHUB_PAGES ? '/SpeechImprover/' : '/',
    plugins: [plugin()],
    server: {
        port: 53134,
    }
})