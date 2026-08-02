# SpeechImprover

> Assess your English speech and practice targeted exercises to improve it — entirely in your browser.

**SpeechImprover** is a free, open-source, **client-side** web app. Record a reading passage, an
improv prompt, or your own text; it analyzes ten speaking attributes locally, scores you against
desirable / undesirable reference patterns, and tracks your progress over time. No account and no
backend of its own — nothing leaves your device unless you turn on the **optional** Google Drive
sync, which syncs into **your own** Drive (audio excluded).

- 🔗 **Live app:** https://adervec.github.io/SpeechImprover/
- 📂 **The app lives in [`speechimprover/`](speechimprover/)** — see its [README](speechimprover/README.md) to run it locally.
- 🏗️ **Architecture & analysis design:** [`design.md`](design.md)

---

## ⚠️ Important — please read first

- **This is not professional advice.** SpeechImprover is an experimental, educational tool built by a
  software developer — **not a doctor, speech-language pathologist, therapist, voice coach, or lawyer.**
  Its analysis is heuristic and **not clinically validated.** For any speech, voice, language, or hearing
  concern, consult a qualified professional. → **[Full disclaimer](DISCLAIMER.md)**
- **Privacy.** Your recordings, analysis, and history stay in your browser; the project has no servers of its
  own and collects nothing. Two opt-in caveats: live transcription uses your browser's Web Speech API (which in
  Chrome/Edge may send audio to Google for processing), and the optional Google Drive sync writes your
  sessions/profile/settings — never audio — into a private folder in **your own** Drive. → **[Privacy notes](PRIVACY.md)**

## Features

- 🎙️ Record & analyze reading passages, free / improv speech, articulation drills, or your own text.
- 📊 Ten attributes scored 0–100 (pace, clarity, filler economy, richness, resonant depth, expressiveness, non-nasal tone, no-uptalk, projection, breath & pausing).
- 🎯 Target-vs-anti-pattern "alignment" scoring against reference profiles.
- 🎭 Free-speaking with a chosen **target tone/emotion**; a review step (submit / restart / abandon) with transcript before analysis.
- 📁 **Projects** — group recordings toward a goal, e.g. read a whole book **passage by passage** with tracked position.
- 🧠 Targeted practice programs generated from your weakest attributes.
- 📈 Trends, a GitHub-style **activity heatmap**, 🕘 full recordings/history with A/B compare, repeat & per-clip download.
- 🤝 **AI-coach export** (a machine-readable progress summary), 🔁 JSON import/export, and 🎨 themes.
- ☁️ **Optional** Google Drive sync (into your own Drive; audio excluded) · 📱 installable **PWA** (works offline).

## Run it locally

```bash
cd speechimprover
npm install
npm run dev      # dev server
npm run build    # production build to dist/
```

Full instructions and browser notes are in [`speechimprover/README.md`](speechimprover/README.md).

## Tech & CI/CD

React 19 + Vite, a pure client-side SPA. Continuous integration (lint + build) and deployment to
GitHub Pages run via GitHub Actions (see [`.github/workflows/`](.github/workflows/)).

## Acknowledgments

- Reading passages are excerpts from **public-domain** works via
  [Project Gutenberg](https://www.gutenberg.org/) (Austen, Dickens, Tolstoy, and others).
- The "Baseline guide" of speaking principles was generated for this project.
- Built with [React](https://react.dev/) and [Vite](https://vite.dev/) (both MIT-licensed); all
  dependencies are permissive-licensed (MIT/Apache-2.0/ISC/BSD).

## License

[MIT](LICENSE) © 2026 Adam Eryavec. Provided "as is", without warranty of any kind — see the
[disclaimer](DISCLAIMER.md).
