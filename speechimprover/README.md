# SpeechImprover

A client-side React app that **assesses your English speech and gives you targeted
exercises to improve it**. Record a reading passage, an improv prompt, or your own
unseen text; the app analyzes ten speaking attributes locally, scores you against
desirable / undesirable reference patterns, and tracks your progress over time.

Everything runs in your browser — **no backend, no uploads**. Audio and analysis stay
on your device (IndexedDB), and you can export, import, or purge it at any time.

> See [`../design.md`](../design.md) for the full architecture and analysis design,
> and `Baseline Ref/speech-improvement-guide.html` for the underlying principles.

## Features

- 🎙️ **Record & analyze** reading passages, free / improv speech, articulation drills, or your own text.
- 📊 **Ten attributes** scored 0–100: pace, clarity (no mumbling), filler economy, non-repetition/richness,
  resonant depth, expressiveness, non-nasal tone, no-uptalk, projection, breath & pausing.
- 🎯 **Target vs. anti-pattern distance** — every session is measured against desirable and undesirable
  reference profiles, with an "alignment" score.
- 🧠 **Targeted programs** generated from your weakest attributes, shaped like the guide's daily routine.
- 📈 **Trends** overall or for any coherent subset (by mode, type, or exercise).
- 🕘 **History of everything** with repeat, A/B compare, audio playback, and **purge** (delete, or drop
  just the bulky audio to save space).
- 🔁 **Import / export** all data as JSON (optionally including audio).
- 👤 **Profile** (age, gender, native language, country of birth) used as analysis reference.
- 🎨 **Six modern themes**, light and dark.
- 🔴 **Safety-first UX**: input/output devices and a live mic-level meter are always visible, and an
  unmissable banner makes it obvious whenever recording is live. A debrief appears at the end of each session.

## Run

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build to dist/
npm run lint     # eslint
npm run preview  # serve the production build
```

## Browser notes

- Best in **Chrome / Edge**, which support the Web Speech API used for live transcription
  (needed for pace, filler, and vocabulary scoring). In other browsers, pitch / energy /
  articulation are still analyzed and you can paste a transcript.
- Microphone permission is required to record; grant it when prompted (or via Settings).
- **English only** for now.
