import { defineConfig } from 'vite';
import plugin from '@vitejs/plugin-react';

// https://vitejs.dev/config/
// On GitHub Pages the app is served from https://<user>.github.io/SpeechImprover/,
// so the deploy workflow sets GITHUB_PAGES=true to build with that base path.
// Local dev/build and other hosts stay at the root ("/").
export default defineConfig({
    base: process.env.GITHUB_PAGES ? '/SpeechImprover/' : '/',
    plugins: [
        plugin(),
        // The CSP meta (index.html) is for the built site; Vite's dev server injects an
        // inline React-refresh script it would block, so drop the tag only when serving dev.
        { name: 'dev-without-csp', apply: 'serve', transformIndexHtml: (html) => html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/, '') },
    ],
    server: {
        port: 53134,
    }
})