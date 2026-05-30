# SpeechImprover — Design

A client-side React (Vite) web app that assesses English speech, generates targeted
practice exercises, and tracks progress over time. **English only** for now. Everything
runs in the browser — no backend, no network calls — so all audio and analysis stay on the
user's machine.

This document is kept up to date as code is generated (per `specs.txt`).

---

## 1. Goals → Features map

| Spec requirement | Where it lives |
| --- | --- |
| React project | Vite + React 19 (`speechimprover/`) |
| Assess speech + provide improvement exercises | `lib/analysis/*`, `lib/exercises.js`, `views/Practice.jsx`, `views/Exercises.jsx` |
| Structured exercises for trouble areas | `lib/exercises.js` `generateProgram()` (targets weakest attributes); the active program is **persisted** in the store with **per-step completion + progress**, resumable across visits |
| Read provided text OR free speaking (improv/unseen) | Practice modes: `read`, `free`, `twister`, `breath` |
| Load historical speaking patterns from old dates | `lib/sampleData.js` seeds dated sessions; import also adds history |
| Target desirable / undesirable patterns + "distance" | `lib/analysis/attributes.js` reference profiles + `distanceTo()`; `views/References.jsx` |
| Analyze all relevant attributes (deepness, richness, non-repetition, non-nasal, non-mumbling, non-uptalk, …) | `lib/analysis/attributes.js` (10 scored attributes) |
| Trend progress overall or for coherent subsets | `views/Trends.jsx` with subset filters (mode/exercise/attribute) |
| Historize everything by default; allow purging (incl. bulky audio only) | IndexedDB `sessions` + `audio` stores; `views/History.jsx` + `views/Settings.jsx` purge controls |
| Data import / export | `lib/exportImport.js`, `views/Settings.jsx` |
| User profile (age, gender, native language, country of birth, …) | `lib/store.js` profile + `views/Profile.jsx` |
| Multiple stylish modern themes | `styles/themes.js` + `hooks/useTheme.js` |
| Session debrief on exit | `views/SessionDebrief` modal at end of a practice session |
| Baseline Ref principles | `Baseline Ref/speech-improvement-guide.html` distilled into exercises + reference profiles; original copied to `public/baseline-guide.html` |
| Detailed help + view underlying HTML guide | `views/Help.jsx` (full docs) + guide rendered in `views/References.jsx` (embedded) and openable in a new tab (`/baseline-guide.html`) |
| Always show input/output devices + mic input indicator | `components/layout/DeviceBar.jsx` + `MicLevelMeter.jsx` (persistent) |
| Always be very clear when recording | Global `components/layout/RecordingIndicator.jsx` (fixed banner + pulsing dot) |
| Repeat & compare completed exercises | `views/History.jsx` "Repeat" action; `views/Compare.jsx` A/B |

---

## 2. Tech & dependency choices

- **React 19 + Vite 8** (existing scaffold). JSX, no TypeScript (matches scaffold).
- **Zero added npm dependencies.** Routing, charts, storage, and DSP are implemented
  in-house to guarantee a clean `npm install` / `npm run build` and avoid React-19
  peer-dependency friction.
- **Browser APIs used:**
  - `navigator.mediaDevices.getUserMedia` + `enumerateDevices` — recording & device list.
  - `MediaRecorder` — capture audio to a `Blob`.
  - `AudioContext` + `AnalyserNode` — live mic level meter.
  - `AudioContext.decodeAudioData` — decode recording for offline DSP analysis.
  - `SpeechRecognition` / `webkitSpeechRecognition` — live English transcript
    (Chrome/Edge). Gracefully degrades: if unavailable, transcript-based metrics are
    skipped and the user can paste/type a transcript.
  - `HTMLMediaElement.setSinkId` — route playback to the chosen output device (where supported).

---

## 3. Data model

### IndexedDB (`speechimprover` database)

- **`sessions`** (keyPath `id`): one record per recorded attempt.
  ```
  {
    id, createdAt (ISO), type ('baseline'|'practice'|'free'|'read'|'twister'|'breath'),
    mode, exerciseId, exerciseTitle, prompt, targetAttributes: [key],
    durationSec, transcript, recognitionConfidence, recognitionSupported,
    metrics: { wpm, fillersPerMin, fillerCounts, typeTokenRatio, medianF0Hz,
               f0StdSemitones, meanRms, terminalSlope, pauseStats, spectral… },
    assessment: 'full' | 'completion',
    // 'full' sessions:
    scores: { <attrKey>: 0..100 }, overall: 0..100,
    distances: { desirable, undesirable, alignment },
    // 'completion' sessions (warm-ups) instead carry scores/overall/distances = null and:
    completion: { completed, quality, note, durationSec, soundRatio },
    audioId | null (ref into audio store; null after audio purge),
    audioMime, audioBytes, notes, debrief, seed: bool
  }
  ```
- **`audio`** (keyPath `id`): `{ id, blob, mime, bytes }`. Stored separately so audio can
  be purged independently of metrics ("purge just bulky audio files").

### localStorage

- `si.profile` — `{ name, age, gender, nativeLanguage, countryOfBirth, targets: [attrKey], notes }`.
- `si.settings` — `{ theme, inputDeviceId, outputDeviceId, recognitionEnabled, … }`.
- `si.program` — the active daily program: `{ id, createdAt, targets, steps: [{ exercise, status:'pending'|'done', sessionId }] }`. Persisted so progress survives navigation; Practice marks the step done (linking the saved `sessionId`) and offers "Next step".

All writes are historized by default; deletion is explicit (per-session, audio-only, seed
data, or full reset).

---

## 4. Speech analysis engine (`lib/analysis/`)

All analysis is **heuristic and fully local** — no ML model is downloaded. Each metric maps
to a 0–100 attribute score with a transparent rationale shown in the UI. These are honest
approximations, not clinical measurements; the UI labels them as estimates.

### `recorder` / `useRecorder`
getUserMedia → MediaRecorder (blob) + AnalyserNode (live level) + SpeechRecognition (transcript),
tracking duration. Emits the blob, duration, transcript, and confidence on stop.

### `audioAnalysis.js` (offline DSP on the decoded buffer)
Frame-based (≈40 ms window, 20 ms hop), mono downmix:
- **RMS energy** per frame → mean level, and **trailing-off** (energy in last 20 % of each
  utterance vs. its body) → *projection*.
- **Voicing** via energy + zero-crossing-rate gate.
- **Pitch (F0)** via normalized autocorrelation on voiced frames (search 70–400 Hz) →
  **median F0** (*resonant depth*) and **F0 std-dev in semitones** (*expressiveness*).
- **Utterance segmentation** by silence gaps → **terminal pitch slope** over each
  utterance's tail (rising = uptalk) → *no-uptalk*; **pause statistics** (count, mean,
  longest, % silence) → *breath/pacing*.
- **Spectral metrics** via an in-house radix-2 FFT: high-frequency energy ratio
  (2–6 kHz) during voiced speech → *clarity / non-mumbling*; mid-band concentration &
  spectral tilt heuristic → *non-nasal*.

### `speechMetrics.js` (transcript)
- **WPM** = words / minutes → *pace* (ideal band ≈ 110–150 wpm).
- **Filler economy**: counts of `um, uh, er, like, you know, so, actually, basically,
  literally, …` → fillers/min → *fillers*.
- **Non-repetition / richness**: type-token ratio + repeated-bigram and over-used-word
  penalty → *non-repetition*.

### `attributes.js` — the 10 scored attributes
`pace, clarity, fillers, nonRepetition, resonantDepth, expressiveness, nonNasal, noUptalk,
projection, breath`. Each: `{ key, label, blurb, weight, measure, guideSection }`.

Covers every spec-named attribute: deepness=`resonantDepth`, richness=`expressiveness`
+`nonRepetition`, non-repetition=`nonRepetition`, lack of nasal=`nonNasal`,
lack of mumbling=`clarity`, lack of uptalk=`noUptalk`, plus guide-derived pace/fillers/
projection/breath.

### Reference profiles & distance
Two reference attribute vectors: **`desirable`** (clear, varied, well-paced, low filler) and
**`undesirable`** (mumbly, monotone, filler-heavy, uptalk, nasal). `distanceTo(vector, ref)`
= weighted Euclidean distance over normalized 0–1 attributes. The session reports
`distanceToDesirable`, `distanceToUndesirable`, and an `alignment` (how much closer to
desirable than undesirable, 0–100).

### `index.js` `analyzeRecording(...)` / `assessCompletion(...)`
`analyzeRecording` orchestrates audio + transcript metrics → scores → overall (weighted
mean) → distances. **Warm-ups** (`breath` mode: breathing, humming, lip trills) are *not*
graded on the attribute scale — Practice instead stores `assessment:'completion'` with
`assessCompletion(metrics)` (a simple completed / quality judgement from duration + how much
sound was detected). Completion sessions have `null` scores/overall/distances, so they're
automatically excluded from scored trends, averages and weakest-attribute calculations, and
they render a simplified report/debrief plus a "✓ done" badge in History/Dashboard.

---

## 5. Exercises (`lib/exercises.js`)

Catalog distilled from the Baseline Ref guide, grouped by category:
- **Warm-up** (breathing, humming, lip trills) — guide §3.
- **Articulation** (tongue twisters by target sound, over-articulation) — guide §3.
- **Core drills** (read-then-unscripted applying a target technique) — guide §3/§4.
- **Reading passages** (neutral provided text) and **Free / improv prompts** and
  **interview/high-pressure prompts** — guide §2.
- **Baseline capture** (the 3 baseline samples) — guide §2.

Each exercise declares `targetAttributes`. `generateProgram(weakAttributes, profile)`
assembles a 12-minute-routine-shaped program (warm-up → articulation → core targeting the
two weakest attributes → capture), mirroring the guide's daily system.

---

## 6. UI structure

Hash router (in-house) over a sidebar layout shell.

- `#/` **Dashboard** — streak, quick stats, weakest attributes, recent sessions, mini trend, CTA.
- `#/practice` **Practice** — device check → record (big recording indicator + live mic
  meter + live transcript) → analyze → **debrief**.
- `#/exercises` **Exercises** — catalog + generated program; launch into Practice.
- `#/trends` **Trends** — overall & per-attribute line charts; subset filters.
- `#/history` **History** — list/filter; play; repeat; compare; delete; purge audio.
- `#/session/:id` **Session detail** — full breakdown, transcript w/ fillers highlighted, audio.
- `#/compare` **Compare** — side-by-side two sessions (radar + bars + A/B playback).
- `#/references` **References** — desirable vs undesirable radar + the Baseline guide (embedded + open-in-new-tab; `?tab=guide` deep link).
- `#/profile` **Profile** — age, gender, native language, country of birth, targets.
- `#/settings` **Settings** — theme picker, device selection, import/export, purge/reset.
- `#/help` **Help** — detailed in-app documentation: quick start, devices, results, the 10 attributes (measure + improve tips), exercises, trends, history, data/privacy, browser support, troubleshooting, and links to the Baseline guide.

### Always-visible safety/clarity affordances
- **DeviceBar**: shows the selected input + output device names and a live **MicLevelMeter**.
- **RecordingIndicator**: a global, unmissable red banner + pulsing dot whenever recording.

### Theming
`styles/themes.js` defines several modern themes (light/dark + accent palettes) as CSS
variable sets; `useTheme` applies them on `:root` and persists the choice.

---

## 7. File map

```
speechimprover/
  index.html                      app shell + title
  public/baseline-guide.html      the Baseline Ref guide (rendered in References)
  src/
    main.jsx, App.jsx             entry + router/layout shell
    index.css                     design system (theme variables)
    styles/themes.js              6 themes + applyTheme
    hooks/
      useRouter.js                hash router
      useMediaDevices.js          device enumeration
    lib/
      db.js                       IndexedDB (sessions + audio stores)
      store.jsx                   StoreProvider (sessions/profile/settings, seeding, purge)
      recorderContext.jsx         RecorderProvider (single mic stream, level, transcript)
      format.js, aggregate.js     helpers + streak/averages/trend/subset
      exercises.js                catalog + generateProgram
      sampleData.js               seed historical sessions
      exportImport.js             JSON export/import (optional audio)
      analysis/
        fft.js                    radix-2 FFT
        audioAnalysis.js          pitch/energy/spectral DSP
        speechMetrics.js          WPM/fillers/richness from transcript
        speechRecognition.js      Web Speech API wrapper
        attributes.js             10 attributes, scoring, reference profiles, distance
        index.js                  analyzeRecording / rescore orchestrator
    components/
      layout.jsx                  Sidebar, DeviceBar (+mic meter), RecordingIndicator
      ui.jsx                      ScoreBadge, AttributeBars, Modal, EmptyState, toast
      charts.jsx                  ScoreRing, Sparkline, LineChart, RadarChart (SVG)
      SessionReport.jsx           reusable full session breakdown
    views/
      Dashboard, Practice, Exercises, Trends, History,
      SessionDetail, Compare, References, Profile, Settings, Help
```

## 8. Status / changelog

- **v0 — complete.** Full build delivered: storage, local analysis engine (FFT pitch/energy/
  spectral + transcript metrics), 10-attribute scoring with desirable/undesirable distance,
  recorder context with always-visible devices + mic meter + global recording banner,
  exercise catalog & generated programs, dashboard, practice flow with session debrief,
  trends with subset filters, history with repeat / compare / per-session & audio-only purge,
  references (reference patterns + rendered Baseline guide), profile, settings (6 themes,
  device selection, JSON import/export, purge/reset), and seeded historical sample sessions.
- `npm run build` and `npm run lint` both pass clean.

### Notable design decisions / limitations
- **Zero added dependencies** — router, charts, storage and DSP are in-house.
- **Heuristic, fully-local analysis.** Nasality and mumbling are spectral approximations,
  not clinical measurements; the UI labels scores as estimates.
- **Transcription needs the Web Speech API** (Chrome/Edge). Without it, pace/filler/vocabulary
  are skipped (clearly indicated) while audio-based attributes still score.
- Resonant-depth scoring is reference-relative to the profile's gender (recalibrated on change).
