# Privacy

SpeechImprover is built to be **local-first**. This document explains, plainly, what happens to
your data. It is informational and is **not legal advice**.

## Short version

- Your **recordings, transcripts, analysis results, history, and profile** are stored **on your
  own device**, in your browser's **IndexedDB**.
- The project has **no backend and no servers of its own**. It does **not** collect, transmit,
  sell, or share your data, and there is **no account, no analytics, no advertising, and no
  tracking cookies.**
- **Two features can send data off your device, both under your control:**
  - *Live transcription* relies on your **browser's Web Speech API**, which in some browsers sends
    audio off your device for processing (see below).
  - *Optional Google Drive sync* (**off by default**) copies your sessions, profile and settings —
    **not your audio** — into a private per-app folder in **your own** Google Drive, so you can sync
    across devices (see below). It only ever goes to your Drive, never to the project.
- You can **export, import, or delete** your data at any time, including deleting just the bulky
  audio while keeping your scores.

## The Web Speech API caveat (important)

Live transcription (used for pace, filler, and vocabulary scoring) uses the browser's built-in
[Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API). In
**Chromium-based browsers (Google Chrome, Microsoft Edge)** this typically streams your audio to
**the browser vendor's servers (e.g. Google)** to perform the recognition. That processing is
governed by **the browser vendor's privacy policy, not this project's** — SpeechImprover never
receives that audio and has no control over it.

If you do not want any audio leaving your device:

- **Don't use live transcription** — you can **paste a transcript** instead, and pitch, energy,
  and articulation are still analyzed locally; **or**
- use a browser that performs speech recognition on-device or doesn't support the Web Speech API
  (in which case transcription is simply unavailable and the rest still works).

Everything else — recording, acoustic/spectral analysis, scoring, and storage — happens
**entirely in your browser.**

## Optional Google Drive sync (off by default)

SpeechImprover can optionally sync across your devices using **your own Google Drive**. It is
**opt-in**: nothing syncs unless you open **Settings → Cloud sync** and connect your Google
account, and the feature only appears at all if the build was configured with a Google OAuth
client ID.

When enabled:

- Your **sessions, profile, and settings** are written to a **hidden per-app folder**
  (`appDataFolder`) in **your** Google Drive — a private area only this app can access. **Audio
  recordings are never uploaded**; they stay on the device.
- Data travels **directly between your browser and Google's Drive API** using an access token you
  grant. It **never passes through any server owned by this project** — there is none. What Google
  does with data stored in your Drive is governed by **Google's privacy policy**, not this project's.
- The app requests only the narrow **`drive.appdata`** scope, so it **cannot see the rest of your
  Drive** — only the private folder it created.
- You can **disconnect at any time** (Settings → Cloud sync → Disconnect), which revokes the token.
  Deleting the synced data itself is done from your Google account / Drive.

## What is stored, and where

| Data | Where | Notes |
|------|-------|-------|
| Audio recordings | Your browser (IndexedDB) | Optional to keep; can be purged separately; **never** synced to Drive |
| Transcripts & analysis | Your browser (IndexedDB) | Computed locally |
| Session history & trends | Your browser (IndexedDB) | |
| Profile (date of birth, gender, native language, country) | Your browser (local storage) | Used only as a local analysis reference |
| Projects & settings | Your browser (local storage) | |
| Sessions, profile & settings | Your Google Drive (private app folder) | **Only if** you turn on Cloud sync; opt-in; audio excluded |

Clearing your browser's site data, or using the in-app **purge** controls, removes the local copy;
if you used Drive sync, remove the app folder from your Google Drive as well.

## Microphone

The app requests **microphone permission** only to record while you are actively recording. You
grant and revoke this permission through your browser/OS, and a live indicator makes it obvious
whenever recording is active.

## Hosting

The public build is served as **static files via GitHub Pages**. As with any website, the host
(GitHub) may log standard technical request data such as your IP address and user-agent; this is
governed by [GitHub's Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).
The application itself sends no data to the author.

## Changes

This policy may change as the app evolves; material changes will be reflected in this file's
history in the repository.
