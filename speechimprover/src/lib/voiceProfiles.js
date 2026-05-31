// Voice profiles for the Voice Lab TTS: map a "voice identity" to Web Speech
// prosody (pitch / rate / volume). Profiles come in three groups:
//   you       — your own measured voice, and an "improved" version of it
//   target    — the desirable reference delivery
//   character — the mastery-track character/mimicry targets (hear them spoken)
//
// These shape pitch, pace and projection-of-delivery. They are NOT voice clones:
// timbre comes from the chosen system voice. For true DSP-enhanced projection on
// your *actual* voice, use the "improved version" feature on a recording.

import { clamp } from './format.js';

function pitchCenter(profile) {
  const g = (profile?.gender || '').toLowerCase();
  if (g.startsWith('m')) return 115;
  if (g.startsWith('f') || g.startsWith('w')) return 200;
  return 155;
}

function median(arr) {
  const a = arr.filter((v) => Number.isFinite(v) && v > 0);
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// SpeechSynthesis rate≈1 is roughly ~165 wpm for typical English voices.
const wpmToRate = (wpm) => clamp(wpm / 165, 0.55, 1.7);
const IDEAL_WPM = 135;

// Build the personal profile from the user's recent measured sessions.
export function personalProfile(sessions = [], profile = {}) {
  const scored = sessions.filter((s) => s.metrics && s.metrics.medianF0Hz > 0);
  const center = pitchCenter(profile);
  const f0 = median(scored.map((s) => s.metrics.medianF0Hz)) || center;
  const wpm = median(scored.map((s) => s.metrics.wpm)) || 150;
  const personalised = scored.length > 0;
  return {
    id: 'personal',
    group: 'you',
    emoji: '🪞',
    label: 'You (personal)',
    desc: personalised
      ? `Modelled on your measured voice — about ${Math.round(f0)} Hz pitch at ${Math.round(wpm)} wpm.`
      : 'Neutral defaults — record a few sessions and this adapts to your measured pitch & pace.',
    params: { pitch: clamp(f0 / center, 0.6, 1.6), rate: wpmToRate(wpm), volume: 1 },
  };
}

// Your pitch, delivered the "improved" way: ideal pace, steady, full projection.
export function improvedProfile(sessions = [], profile = {}) {
  const base = personalProfile(sessions, profile);
  return {
    id: 'personal-improved',
    group: 'you',
    emoji: '✨',
    label: 'You, improved',
    desc: 'Your pitch, delivered at an ideal pace with full, steady projection.',
    params: { pitch: base.params.pitch, rate: wpmToRate(IDEAL_WPM), volume: 1 },
  };
}

// Static target + character profiles. Character params mirror the mastery-track
// targets so you can hear what you're aiming to mimic.
export const TARGET_PROFILES = [
  { id: 'desirable', group: 'target', emoji: '🎯', label: 'Clear & confident (target)', desc: 'The desirable reference: clear, grounded, well-paced.', params: { pitch: 1.0, rate: wpmToRate(IDEAL_WPM), volume: 1 } },
  { id: 'narrator', group: 'target', emoji: '🎬', label: 'Warm narrator', desc: 'Low, smooth and unhurried — audiobook calm.', params: { pitch: 0.85, rate: 0.82, volume: 1 } },
  { id: 'mentor', group: 'character', emoji: '🧙', label: 'The wise mentor', desc: 'Low, slow, measured gravity.', params: { pitch: 0.78, rate: 0.78, volume: 1 } },
  { id: 'host', group: 'character', emoji: '🎙️', label: 'The excitable host', desc: 'Bright, fast and high-energy.', params: { pitch: 1.3, rate: 1.35, volume: 1 } },
  { id: 'giant', group: 'character', emoji: '🗿', label: 'The towering giant', desc: 'Deep, slow and rumbling.', params: { pitch: 0.5, rate: 0.7, volume: 1 } },
  { id: 'sprite', group: 'character', emoji: '🧚', label: 'The flighty sprite', desc: 'Tiny, quick and gleeful.', params: { pitch: 1.85, rate: 1.4, volume: 1 } },
  { id: 'villain', group: 'character', emoji: '🦹', label: 'The cold villain', desc: 'Low, deliberate and menacing.', params: { pitch: 0.62, rate: 0.82, volume: 1 } },
];

export const PROFILE_GROUPS = [
  { key: 'you', label: 'Your voice' },
  { key: 'target', label: 'Target deliveries' },
  { key: 'character', label: 'Character voices' },
];

export function listProfiles(sessions = [], profile = {}) {
  return [personalProfile(sessions, profile), improvedProfile(sessions, profile), ...TARGET_PROFILES];
}
