// Orchestrates the full analysis of one recording into scores + distances.

import { analyzeAudioBuffer, decodeBlob } from './audioAnalysis.js';
import { analyzeTranscript } from './speechMetrics.js';
import {
  ATTRIBUTES,
  computeDistances,
  overallScore,
} from './attributes.js';

// Combine raw audio + transcript metrics, then derive scores.
export function scoreFromMetrics(metrics, profile) {
  const hasTranscript = metrics.wordCount > 0;
  const scores = {};
  for (const attr of ATTRIBUTES) {
    if (attr.requiresTranscript && !hasTranscript) {
      scores[attr.key] = null;
      continue;
    }
    const s = attr.score(metrics, profile);
    scores[attr.key] = Number.isFinite(s) ? Math.round(s) : null;
  }
  const overall = overallScore(scores);
  const distances = computeDistances(scores);
  return { scores, overall, distances };
}

// Full pipeline: decode + analyze audio, fold in transcript, produce scores.
export async function analyzeRecording({
  blob,
  durationSec,
  transcript,
  recognitionConfidence = 0,
  recognitionSupported = false,
  profile = {},
}) {
  let audioMetrics;
  try {
    const buffer = await decodeBlob(blob);
    audioMetrics = analyzeAudioBuffer(buffer);
    if (!durationSec) durationSec = audioMetrics.durationSec;
  } catch {
    // Decoding failed (unsupported codec); fall back to silence-like metrics.
    audioMetrics = analyzeAudioBuffer({
      sampleRate: 48000,
      numberOfChannels: 1,
      length: 0,
      getChannelData: () => new Float32Array(0),
    });
  }

  const transcriptMetrics = analyzeTranscript(transcript || '', durationSec || 1);

  const metrics = {
    ...audioMetrics,
    ...transcriptMetrics,
    durationSec: durationSec || audioMetrics.durationSec,
    recognitionConfidence,
    recognitionSupported,
  };

  const { scores, overall, distances } = scoreFromMetrics(metrics, profile);
  return { metrics, scores, overall, distances };
}

// Re-score an existing session's stored metrics (used after profile changes /
// for seed data). Avoids needing the original audio.
export function rescore(metrics, profile) {
  return scoreFromMetrics(metrics, profile);
}

// Warm-up activities (breathing exhales, humming, lip trills) aren't graded on the
// full attribute scale — they're assessed simply for completion: did you record a
// reasonable length and actually make sound?
export function assessCompletion(metrics) {
  const durationSec = metrics.durationSec || 0;
  const soundRatio = Math.max(0, Math.min(1, 1 - (metrics.silenceRatio ?? 1)));
  const completed = durationSec >= 4 && soundRatio > 0.05;

  let quality;
  let note;
  if (!completed) {
    quality = 'incomplete';
    note =
      durationSec < 4
        ? 'Very short — hold the exercise a little longer next time.'
        : 'Almost no sound was detected — check your microphone and try again.';
  } else if (durationSec < 8) {
    quality = 'brief';
    note = 'Done — a touch brief. Aim for the suggested length to get the full benefit.';
  } else if (soundRatio < 0.2) {
    quality = 'gentle';
    note = 'Done — nice and gentle. Make sure the mic is catching your breath or hum.';
  } else {
    quality = 'good';
    note = 'Nicely done — steady sound throughout. Keep the streak going!';
  }

  return { completed, quality, note, durationSec, soundRatio };
}
