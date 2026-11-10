// Self-check: node scripts/check-transcript.mjs
import assert from 'node:assert/strict';
import { annotateTranscript } from '../src/lib/analysis/transcriptAnnotate.js';
import { paceTimeline } from '../src/lib/analysis/speechMetrics.js';

const free = annotateTranscript({ transcript: 'I think we should maybe ship it', mode: 'free' });
assert.equal(free.stats.hedges, 3); // i, think, maybe
assert.equal(free.stats.wcpm, null);

const read = annotateTranscript({ transcript: 'the cat sat on mat', prompt: 'The cat sat on the mat.', mode: 'read', durationSec: 30 });
assert.equal(read.stats.wcpm, 10); // 5 matches in half a minute
assert.equal(read.stats.hedges, 0);

assert.equal(paceTimeline([{ t: 2, words: 5 }]), null);
const p = paceTimeline([{ t: 1, words: 3 }, { t: 4, words: 7 }, { t: 10, words: 12 }]);
assert.deepEqual(p.points, [{ t: 4, wpm: 150 }, { t: 10, wpm: 120 }]); // first two merged
assert.equal(p.variation, 11);
console.log('transcript checks ok');

import { splitTake, splitsFor, holdGrade } from '../src/lib/analysis/takeSplits.js';
assert.deepEqual(splitsFor(40), [2]);
assert.deepEqual(splitsFor(60), [2, 3, 4]);
// 60 s take: 130 words in the first 30 s, 100 in the second → halves 260/200 wpm.
const sp = splitTake([{ t: 30, words: 130, fillers: 2 }, { t: 60, words: 100, fillers: 0 }], 60, 2);
assert.deepEqual(sp.parts.map((p) => [p.wpm, p.fillers]), [[260, 2], [200, 0]]);
assert.equal(sp.diffPct, -23);
assert.equal(sp.diffGrade, 'D');
// Interpolates inside a segment: quarter 1 = half of the first segment.
assert.equal(splitTake([{ t: 30, words: 60 }, { t: 60, words: 60 }], 60, 4).parts[0].wpm, 120);
assert.equal(holdGrade(+4), 'A');
assert.equal(holdGrade(+25), 'D'); // rushing counts too
console.log('split checks ok');
