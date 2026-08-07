// "Endgame" — an advanced vocal-techniques mastery track that sits on top of the
// everyday speech work. Techniques are arranged in tiers (each gated by the
// previous), every technique has staged drills, and — wherever the local
// analysis engine can measure it — drills are scored against a *target vocal
// profile* (pitch, range, steadiness, pace, projection…). Where audio can't
// verify the skill (e.g. lip stillness for ventriloquism) drills are logged on
// completion with coaching and self-assessment.

import { clamp } from './format.js';

export const TIERS = [
  { key: 'foundation', label: 'Foundation', blurb: 'Independent control of pitch, resonance and articulation — the raw material every advanced trick is built from.' },
  { key: 'intermediate', label: 'Intermediate', blurb: 'Shaping that control into dynamics and expressive prosody.' },
  { key: 'advanced', label: 'Advanced', blurb: 'Bending your voice into other voices: mimicry, accents and characters.' },
  { key: 'master', label: 'Master', blurb: 'Illusion and performance — ventriloquism and the full vocal-actor toolkit.' },
];

// Gender-relative pitch centre (Hz) so range targets adapt to the speaker.
function pitchCenter(profile) {
  const g = (profile?.gender || '').toLowerCase();
  if (g.startsWith('m')) return 115;
  if (g.startsWith('f') || g.startsWith('w')) return 200;
  return 155;
}

// Band scorers → 0..100.
function scoreBand(v, band) {
  if (v == null || !Number.isFinite(v)) return null;
  if (band.type === 'range') {
    const span = band.hi - band.lo || 1;
    const fadeLo = band.fadeLo ?? band.lo - span;
    const fadeHi = band.fadeHi ?? band.hi + span;
    if (v >= band.lo && v <= band.hi) return 100;
    if (v < band.lo) return clamp(((v - fadeLo) / (band.lo - fadeLo)) * 100, 0, 100);
    return clamp(((fadeHi - v) / (fadeHi - band.hi)) * 100, 0, 100);
  }
  if (band.type === 'min') return clamp(((v - band.at) / (band.full - band.at)) * 100, 0, 100); // higher better
  if (band.type === 'max') return clamp(((band.at - v) / (band.at - band.full)) * 100, 0, 100); // lower better
  return null;
}

function fmtMeasured(key, from, v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (from === 'score') return `${Math.round(v)}/100`;
  switch (key) {
    case 'medianF0Hz': return `${Math.round(v)} Hz`;
    case 'f0StdSemitones': return `${v.toFixed(1)} st`;
    case 'wpm': return `${Math.round(v)} wpm`;
    case 'silenceRatio':
    case 'trailingRatio':
    case 'voicedRatio':
    case 'recognitionConfidence': return `${Math.round(v * 100)}%`;
    case 'terminalSlope': return `${v >= 0 ? '+' : ''}${v.toFixed(1)} st/s`;
    default: return typeof v === 'number' ? v.toFixed(2) : String(v);
  }
}

// ---- target builders (kept terse; bands tuned for coaching, not clinical use) ----
const goLow = (p) => ({ key: 'medianF0Hz', label: 'How low you got', band: { type: 'max', at: pitchCenter(p) * 0.98, full: pitchCenter(p) * 0.72 }, hint: 'Aim well below your everyday pitch.' });
const goHigh = (p) => ({ key: 'medianF0Hz', label: 'How high you got', band: { type: 'min', at: pitchCenter(p) * 1.05, full: pitchCenter(p) * 1.5 }, hint: 'Aim well above your everyday pitch.' });
const steady = { key: 'f0StdSemitones', label: 'Pitch steadiness', band: { type: 'max', at: 2.6, full: 0.7 }, hint: 'Hold one rock-steady pitch (low wobble).' };
const lively = { key: 'f0StdSemitones', label: 'Pitch variation', band: { type: 'min', at: 2, full: 6 }, hint: 'Big, deliberate melodic swings.' };
const clarityHi = { key: 'clarity', from: 'score', label: 'Clarity held', band: { type: 'min', at: 55, full: 88 }, hint: 'Keep every consonant crisp.' };
const projectionHi = { key: 'projection', from: 'score', label: 'Projection', band: { type: 'min', at: 55, full: 86 }, hint: 'Stay supported; don’t trail off.' };
const noTrailing = { key: 'trailingRatio', label: 'Held to the end', band: { type: 'min', at: 0.5, full: 0.85 }, hint: 'Keep energy up through the last word.' };
const fallingEnds = { key: 'terminalSlope', label: 'Falling endings', band: { type: 'max', at: 1.5, full: -2 }, hint: 'Let statements drop, not rise.' };
const paceBand = (lo, hi) => ({ key: 'wpm', label: 'Pace', band: { type: 'range', lo, hi }, hint: `Land around ${lo}–${hi} wpm.` });

// ---- the technique catalog ----
export const TECHNIQUES = [
  // ---------------- FOUNDATION ----------------
  {
    id: 'pitch-control',
    name: 'Pitch & Range Mastery',
    icon: '🎚️',
    tier: 'foundation',
    tagline: 'Own every note from your basement to your attic.',
    skills: ['resonantDepth', 'expressiveness'],
    overview: 'Independent, deliberate control of pitch is the foundation of every character, impression and song. You will learn to hold a target pitch dead steady, glide smoothly between registers, and extend both the bottom and top of your range.',
    science: 'Pitch is set by vocal-fold tension and length. Training the cricothyroid/thyroarytenoid balance widens usable range; holding a steady pitch trains fine motor control over fold tension.',
    tips: ['Yawn-sigh to find your lowest relaxed notes.', 'Sirens (low→high→low) on “ng” build smooth register transitions.', 'Never push the very top — extend gently over weeks.'],
    prerequisites: [],
    stages: [
      { id: 'hold', title: 'The steady tone', mode: 'sustain', durationSec: 16, minSec: 8,
        prompt: 'Hold a single steady “ahh” on a comfortable pitch — as flat and unwavering as you can.',
        instructions: 'One breath, one pitch. Imagine a laser-flat line. Steadiness beats length.',
        target: () => [steady], passScore: 65,
        coach: 'A steady tone means you control fold tension. Wobble = let the breath, not the pitch, do the work.' },
      { id: 'go-low', title: 'Descend to the cellar', mode: 'sustain', durationSec: 16, minSec: 8,
        prompt: 'Glide down and settle on the lowest comfortable note you can sustain — a relaxed “awww”.',
        instructions: 'Drop the jaw, relax the throat, think “down”. Don’t force a growl.',
        target: (p) => [goLow(p)], passScore: 60,
        coach: 'Low notes power authoritative narrators, giants and calm gravitas.' },
      { id: 'go-high', title: 'Reach the rafters', mode: 'sustain', durationSec: 16, minSec: 8,
        prompt: 'Glide up to a clear, light, high note and sustain it — an easy “eee”.',
        instructions: 'Stay light and forward, never strained. Think “small and bright”.',
        target: (p) => [goHigh(p)], passScore: 55,
        coach: 'High, light tone powers sprites, children and excitable characters.' },
    ],
  },
  {
    id: 'resonance',
    name: 'Resonant Placement',
    icon: '🔊',
    tier: 'foundation',
    tagline: 'Move your voice from your chest to your mask at will.',
    skills: ['resonantDepth', 'nonNasal', 'projection'],
    overview: 'Two voices at the same pitch can sound completely different depending on where they resonate. Learn to place your tone in the chest (warm, full), the “mask” (bright, forward, carrying) and to control nasality.',
    science: 'Resonance is shaped by the vocal tract above the folds. Lowering the larynx and opening the pharynx darkens tone (chest); forward placement raises spectral energy (mask/ring) and helps projection without strain.',
    tips: ['Hum and feel where it buzzes — move the buzz from chest to lips to nose.', '“Mmm-mah” opens chest resonance.', 'A bright “nyah” finds forward/mask placement.'],
    prerequisites: [],
    stages: [
      { id: 'chest', title: 'Chest resonance', mode: 'sustain', durationSec: 14, minSec: 7,
        prompt: 'Speak-sing a low, warm “maaah” and feel it buzz in your chest.',
        instructions: 'Low larynx, open throat, dark and round. Hand on chest to feel the buzz.',
        target: () => [{ key: 'resonantDepth', from: 'score', label: 'Depth / warmth', band: { type: 'min', at: 45, full: 80 }, hint: 'Darker, lower-placed tone.' }], passScore: 55,
        coach: 'Chest resonance reads as warmth, calm and authority.' },
      { id: 'open', title: 'Open, non-nasal tone', mode: 'read', durationSec: 22, minSec: 8,
        prompt: 'Read warmly and openly: “The wide hall echoed with a low, round, golden tone.”',
        instructions: 'Yawn-space at the back of the mouth; keep the soft palate lifted so air doesn’t leak nasally.',
        target: () => [{ key: 'nonNasal', from: 'score', label: 'Open (non-nasal) tone', band: { type: 'min', at: 45, full: 85 }, hint: 'Lifted soft palate, open throat.' }], passScore: 55,
        coach: 'Open resonance projects further with less effort and avoids a pinched, nasal sound.' },
    ],
  },
  {
    id: 'articulation-pro',
    name: 'Articulatory Independence',
    icon: '👅',
    tier: 'foundation',
    tagline: 'Crisp consonants at speed — and the tongue/jaw independence ventriloquism needs.',
    skills: ['clarity', 'pace'],
    overview: 'Advanced voice work demands a tongue that moves independently of the jaw and lips. You will drill precision at speed and learn to keep articulation crisp even with a relaxed, near-still jaw.',
    science: 'Most “mumbling” is a lazy jaw and tongue root. Isolating tongue-tip movement from jaw movement is exactly the control ventriloquism and rapid articulation require.',
    tips: ['Over-articulate slowly first, then add speed.', 'Practice tongue-twisters with a finger lightly holding the jaw still.', 'Finish every word ending (-t, -d, -ing).'],
    prerequisites: [],
    stages: [
      { id: 'precision', title: 'Precision at speed', mode: 'twister', durationSec: 30, minSec: 8,
        prompt: 'Red leather, yellow leather. Round the rugged rocks the ragged rascal ran.',
        instructions: 'Slow and perfect first, then faster — never sacrificing a single consonant.',
        target: () => [clarityHi, paceBand(120, 190)], passScore: 65,
        coach: 'Clarity at speed proves your tongue is doing the work, not your jaw.' },
      { id: 'still-jaw', title: 'The near-still jaw', mode: 'read', durationSec: 24, minSec: 8,
        prompt: 'With your teeth lightly together, read: “The little kitten licked the silly trinket till it glittered.”',
        instructions: 'Hold the jaw almost closed and let only the tongue tip move. This is the gateway to ventriloquism.',
        target: () => [clarityHi], passScore: 55,
        coach: 'Keeping clarity with a closed jaw isolates the tongue — the core ventriloquism skill.' },
    ],
  },

  // ---------------- INTERMEDIATE ----------------
  {
    id: 'dynamics',
    name: 'Dynamic & Projection Control',
    icon: '📢',
    tier: 'intermediate',
    tagline: 'Whisper to roar, and carry a room without shouting.',
    skills: ['projection', 'breath'],
    overview: 'Control of loudness — supported projection, smooth swells, and not fading at the ends of phrases — is what separates a stage voice from a conversational one.',
    science: 'Loudness comes from breath support and efficient fold closure, not throat force. Maintaining subglottal pressure to the end of a phrase prevents the energy trailing-off that reads as low confidence.',
    tips: ['Project to the back wall, not by straining the throat.', 'Support every phrase from the belly to its last word.', 'Practice swells: start soft, grow, return — on one breath.'],
    prerequisites: ['resonance'],
    stages: [
      { id: 'project', title: 'Fill the room', mode: 'read', durationSec: 26, minSec: 8,
        prompt: 'Project to an imagined back row: “Friends — gather close, and hear what I have come a long way to tell you.”',
        instructions: 'Supported, open, and loud without shouting. Imagine the back wall.',
        target: () => [projectionHi, noTrailing], passScore: 65,
        coach: 'Projection is breath support plus resonance — never throat strain.' },
      { id: 'sustain-end', title: 'Hold it to the last word', mode: 'read', durationSec: 26, minSec: 8,
        prompt: 'Read these three sentences, keeping full energy through every final word. “It was over. We had won. Nothing would be the same again.”',
        instructions: 'The very last word of each sentence should be as supported as the first.',
        target: () => [noTrailing, fallingEnds], passScore: 60,
        coach: 'Trailing off at phrase ends is the most common confidence-killer; fix it here.' },
    ],
  },
  {
    id: 'prosody',
    name: 'Prosody & Expressiveness',
    icon: '🎶',
    tier: 'intermediate',
    tagline: 'Melody, emphasis and intention — kill the monotone.',
    skills: ['expressiveness', 'noUptalk'],
    overview: 'Prosody is the music of speech: pitch movement, stress and timing that carry meaning and emotion. You will widen your expressive range and learn to land statements with authority rather than uptalk.',
    science: 'Listeners read wide, intentional pitch movement as confidence and warmth; flat pitch reads as disengagement, and rising terminal pitch on statements (“uptalk”) reads as uncertainty.',
    tips: ['Read children’s stories wildly over-the-top to stretch your range.', 'Mark the one word in each sentence that carries the meaning, and lean on it.', 'End statements with a downward step.'],
    prerequisites: ['pitch-control'],
    stages: [
      { id: 'range', title: 'Maximum expression', mode: 'read', durationSec: 26, minSec: 8,
        prompt: 'Read as if to a delighted child: “And then — would you believe it?! — the tiny dragon SNEEZED, and the WHOLE castle turned BRIGHT purple!”',
        instructions: 'Enormous, theatrical pitch swings. Overdo it.',
        target: () => [lively], passScore: 60,
        coach: 'A wide, intentional melodic range is the raw material for every character and emotion.' },
      { id: 'land-it', title: 'Land the statement', mode: 'read', durationSec: 24, minSec: 8,
        prompt: 'Make each a firm statement, not a question: “This is the plan. We leave at dawn. I am certain it will work.”',
        instructions: 'Step the pitch DOWN at the end of every line. Confident, not questioning.',
        target: () => [fallingEnds], passScore: 60,
        coach: 'Downward terminal pitch = authority. Rising = uptalk and doubt.' },
    ],
  },

  // ---------------- ADVANCED ----------------
  {
    id: 'mimicry',
    name: 'Mimicry & Impressions',
    icon: '🎭',
    tier: 'advanced',
    tagline: 'Become another voice by matching its pitch, pace and melody.',
    skills: ['resonantDepth', 'expressiveness', 'pace'],
    overview: 'Impressions are built from measurable ingredients: pitch level, speaking rate, pitch variation and rhythm. You will hit defined “target voices” by reshaping those ingredients — the analytical core of all mimicry.',
    science: 'Identity in voice is carried largely by mean pitch, articulation rate, and prosodic contour. Match those and add a signature resonance/quirk, and the brain fills in the rest.',
    tips: ['Pick ONE feature first (pitch OR pace), nail it, then layer the next.', 'Loop a 3-second target clip and shadow it.', 'Exaggerate the signature feature 20% past reality.'],
    prerequisites: ['pitch-control', 'prosody'],
    stages: [
      { id: 'slow-low', title: 'The wise mentor', mode: 'read', durationSec: 28, minSec: 9,
        prompt: 'In a slow, low, measured voice: “Patience, young one. The path you seek has been walked before — and it is longer than you think.”',
        instructions: 'Target: low pitch, slow deliberate pace, gentle gravity.',
        target: (p) => [goLow(p), paceBand(80, 110)], passScore: 62,
        coach: 'Mentor/narrator voices = low pitch + slow pace + steadiness.' },
      { id: 'fast-bright', title: 'The excitable host', mode: 'read', durationSec: 26, minSec: 9,
        prompt: 'Bright, fast and buzzing with energy: “Welcome BACK, everybody — have we got a show for YOU tonight, oh you are going to LOVE this!”',
        instructions: 'Target: higher pitch, quick pace, big pitch swings.',
        target: (p) => [goHigh(p), paceBand(165, 230), lively], passScore: 60,
        coach: 'Host/announcer voices = brighter pitch + fast pace + wide melody.' },
      { id: 'free-impression', title: 'Hold an impression', mode: 'free', durationSec: 45, minSec: 15,
        prompt: 'Pick anyone — a celebrity, relative or cartoon — and talk for 30–45s fully in their voice about your day.',
        instructions: 'Commit completely and stay in character the whole time. Consistency sells it.',
        coach: 'Sustaining a voice unscripted is the real test — consistency beats a one-line gag.' },
    ],
  },
  {
    id: 'accents',
    name: 'Accent & Dialect',
    icon: '🗺️',
    tier: 'advanced',
    tagline: 'Reshape rhythm, vowels and melody into another dialect.',
    skills: ['expressiveness', 'pace', 'clarity'],
    overview: 'An accent is a system: characteristic vowel shapes, rhythm (stress- vs syllable-timed), and intonation melody. You will practise the musical contour and timing that make an accent convincing — the parts that matter more than any single sound.',
    science: 'Listeners identify accents more from prosody (rhythm and intonation) than from individual phonemes. Get the music and timing right and the vowels follow.',
    tips: ['Learn the melody before the sounds — hum the accent first.', 'Find the signature vowel shift and the rhythm (even vs punchy).', 'Shadow native speakers in short loops.'],
    prerequisites: ['prosody', 'articulation-pro'],
    stages: [
      { id: 'lilt', title: 'A lilting, musical accent', mode: 'read', durationSec: 26, minSec: 9,
        prompt: 'With a sing-song, wide-melody lilt: “Ah now, would you look at that — it’s a grand soft day altogether, so it is.”',
        instructions: 'Target: lots of musical pitch movement and an even rhythm.',
        target: () => [lively], passScore: 58,
        coach: 'Many lilting accents live in their wide, rolling intonation.' },
      { id: 'crisp', title: 'A crisp, clipped accent', mode: 'read', durationSec: 24, minSec: 9,
        prompt: 'Crisp and precise, slightly clipped: “I should think it perfectly obvious that the matter is entirely settled.”',
        instructions: 'Target: very crisp consonants, controlled, measured pace.',
        target: () => [clarityHi, paceBand(110, 160)], passScore: 60,
        coach: 'Clipped accents rely on precise articulation and controlled rhythm.' },
    ],
  },
  {
    id: 'character-voices',
    name: 'Character Voices',
    icon: '🐉',
    tier: 'advanced',
    tagline: 'Build distinct personas: the giant, the sprite, the villain.',
    skills: ['resonantDepth', 'expressiveness', 'nonNasal'],
    overview: 'Characters combine pitch, resonance, pace and a signature quirk into a voice an audience instantly recognises. You will construct and sustain contrasting personas on demand.',
    science: 'A believable character holds a consistent set of vocal parameters (pitch centre, resonance, tempo) plus one or two exaggerated signatures — the brain locks onto the consistency.',
    tips: ['Anchor each character to a body posture and face.', 'Give each one ONE signature (a growl, a giggle, a drawl).', 'Contrast is everything — make two characters as different as possible.'],
    prerequisites: ['pitch-control', 'resonance'],
    stages: [
      { id: 'giant', title: 'The towering giant', mode: 'read', durationSec: 24, minSec: 9,
        prompt: 'Huge, slow, and rumbling: “WHO… dares… to enter… MY mountain?”',
        instructions: 'Target: lowest chest resonance, very slow, massive weight.',
        target: (p) => [goLow(p), paceBand(60, 100)], passScore: 60,
        coach: 'Big characters = low pitch + dark chest resonance + slow tempo.' },
      { id: 'sprite', title: 'The flighty sprite', mode: 'read', durationSec: 22, minSec: 8,
        prompt: 'Tiny, quick, and gleeful: “Oh hello hello hello! Come along, come along, there’s simply NO time to waste!”',
        instructions: 'Target: high bright pitch, fast pace, bubbly pitch swings.',
        target: (p) => [goHigh(p), paceBand(180, 250), lively], passScore: 58,
        coach: 'Small/fae characters = high light pitch + quick tempo + bright placement.' },
    ],
  },

  // ---------------- MASTER ----------------
  {
    id: 'ventriloquism',
    name: 'Ventriloquism',
    icon: '🪆',
    tier: 'master',
    tagline: 'Speak clearly without moving your lips — and throw the voice.',
    skills: ['clarity', 'resonantDepth'],
    overview: 'The art of the “distant voice”: keeping a relaxed, near-still smile while the tongue does all the work, substituting the lip-sounds (b, p, m, f, v, w) with clever near-equivalents, and using dynamics + tone to create the illusion of a voice coming from elsewhere.',
    science: 'Lip sounds (bilabials/labiodentals) are the only ones that visibly require the lips. By substituting them (b→d/g blend, p→t/k, m→n/ng, f→th) and isolating the tongue, the mouth can stay still. The “throw” is an auditory illusion built from muffling, distance cues and audience misdirection — sound isn’t actually relocated.',
    tips: ['Hold a relaxed, slightly parted smile — teeth together, lips soft and still.', 'Master the substitution alphabet before whole sentences.', 'A softer, slightly muffled “far” voice + looking toward the “source” sells the throw.'],
    prerequisites: ['articulation-pro', 'mimicry'],
    stages: [
      { id: 'no-labials', title: 'The lip-free line', mode: 'read', durationSec: 22, minSec: 8,
        prompt: 'Teeth lightly together, lips still, read: “Tall trees stand silent; the night air is still and clear.”',
        instructions: 'This line has NO lip sounds — so you can keep your lips perfectly still. Let only the tongue move and keep it crisp.',
        target: () => [clarityHi], passScore: 60,
        coach: 'No bilabials means a still mouth is achievable — prove your tongue can carry the line alone.' },
      { id: 'substitution', title: 'The substitution alphabet', mode: 'read', durationSec: 26, minSec: 8,
        prompt: 'Lips still, substitute the lip-sounds (b→d, p→t, m→n, f→th): “My brave puppy bumped the big blue lamp.”',
        instructions: 'Say it so it still sounds right while your lips barely move. b/p→tongue stops, m→“n/ng”, f/v→soft “th”. Use a mirror.',
        target: () => [clarityHi], passScore: 55,
        coach: 'Substitution is the heart of the craft — the listener’s brain restores the intended word.' },
      { id: 'distant-voice', title: 'The distant voice', mode: 'free', durationSec: 40, minSec: 12,
        prompt: 'Create a second, “far away” character voice — slightly muffled and smaller — and hold a short two-voice exchange between “you” and “it”.',
        instructions: 'Switch between your normal voice and a softer, more muffled, distant one. Stillness + the contrast creates the illusion.',
        coach: 'The “throw” is misdirection + a muffled, distance-cued tone — not actual relocation of sound. Sell it with contrast and stillness.' },
    ],
  },
  {
    id: 'vocal-actor',
    name: 'The Complete Vocal Actor',
    icon: '🏆',
    tier: 'master',
    tagline: 'Capstone — combine everything into a living performance.',
    skills: ['expressiveness', 'clarity', 'projection'],
    overview: 'The endgame: switch fluidly between distinct voices, sustain them under the pressure of performance, and combine range, resonance, prosody and articulation into a single believable scene.',
    science: 'Mastery is fluency — recalling and switching whole vocal “presets” instantly while staying intelligible and expressive. This is the integration of every prior tier.',
    tips: ['Rehearse switching between two characters mid-sentence.', 'Record, listen back ruthlessly, and refine one detail at a time.', 'Perform for someone — pressure reveals what isn’t yet automatic.'],
    prerequisites: ['mimicry', 'character-voices', 'ventriloquism'],
    stages: [
      { id: 'two-hander', title: 'The two-hander scene', mode: 'free', durationSec: 60, minSec: 20,
        prompt: 'Perform a 45–60s scene between TWO distinct characters (e.g. the giant and the sprite). Switch cleanly between them.',
        instructions: 'Make the two voices unmistakably different and switch instantly. Keep both intelligible and expressive.',
        coach: 'Clean, instant switching between fully-formed voices is the hallmark of a complete vocal actor.' },
      { id: 'showcase', title: 'The showcase', mode: 'free', durationSec: 75, minSec: 25,
        prompt: 'Deliver a 60–75s performance that shows off your range: shift pitch, resonance, accent and character — and project it.',
        instructions: 'Bring it all together: range, dynamics, prosody, a character or two, crisp articulation, full projection.',
        target: () => [lively, clarityHi, projectionHi], passScore: 65,
        coach: 'The capstone: expressive, clear and projected — your whole toolkit in one take.' },
    ],
  },
];

export const TECHNIQUE_MAP = Object.fromEntries(TECHNIQUES.map((t) => [t.id, t]));
export const getTechnique = (id) => TECHNIQUE_MAP[id] || null;

const MODE_DUR = { sustain: 16, read: 26, twister: 30, free: 60 };

// Build a Practice-ready exercise object for a technique stage.
export function getTechniqueExercise(techId, stageRef) {
  const tech = TECHNIQUE_MAP[techId];
  if (!tech) return null;
  const idx = typeof stageRef === 'number'
    ? stageRef
    : Math.max(0, tech.stages.findIndex((s) => s.id === stageRef));
  const stage = tech.stages[idx];
  if (!stage) return null;
  return {
    id: `tech-${tech.id}-${stage.id}`,
    title: `${tech.name} — ${stage.title}`,
    category: 'Mastery',
    mode: stage.mode,
    durationSec: stage.durationSec || MODE_DUR[stage.mode] || 30,
    targetAttributes: tech.skills || [],
    guideSection: `Mastery · ${tech.name}`,
    instructions: stage.instructions,
    prompt: stage.prompt,
    type: 'technique',
    technique: { id: tech.id, name: tech.name, tier: tech.tier, icon: tech.icon, stageId: stage.id, stageTitle: stage.title, stageIndex: idx, stageCount: tech.stages.length },
    stage,
  };
}

// Evaluate a finished technique attempt against its stage target(s).
export function evaluateStage(stage, metrics = {}, scores = {}, profile = {}) {
  const targets = typeof stage.target === 'function' ? stage.target(profile) : stage.target;
  if (!targets || !targets.length) {
    const dur = metrics.durationSec || 0;
    const sound = 1 - (metrics.silenceRatio ?? 1);
    const matched = dur >= (stage.minSec || 6) && sound > 0.05;
    return {
      kind: 'completion',
      score: null,
      matched,
      breakdown: [],
      headline: matched ? 'Drill logged ✓' : 'Too short — give it a full attempt',
      note: stage.coach || '',
    };
  }
  const breakdown = targets.map((t) => {
    const v = t.from === 'score' ? scores?.[t.key] : metrics?.[t.key];
    const sc = scoreBand(v, t.band);
    return { label: t.label, score: sc, measured: fmtMeasured(t.key, t.from, v), hint: t.hint, ok: sc != null && sc >= 70 };
  });
  const valid = breakdown.filter((b) => b.score != null);
  const score = valid.length ? Math.round(valid.reduce((a, b) => a + b.score, 0) / valid.length) : null;
  const pass = stage.passScore ?? 70;
  const matched = score != null && score >= pass;
  return {
    kind: 'target',
    score,
    matched,
    breakdown,
    headline: matched ? 'Target hit! 🎯' : score != null ? 'Close — keep refining' : 'Recorded',
    note: stage.coach || '',
  };
}

// ---- progress / unlock / level helpers ----
const LEVELS = [
  { at: 0, title: 'Initiate' },
  { at: 3, title: 'Apprentice' },
  { at: 7, title: 'Practitioner' },
  { at: 12, title: 'Artisan' },
  { at: 18, title: 'Virtuoso' },
  { at: 25, title: 'Master of Voice' },
];

const TOTAL_STAGES = TECHNIQUES.reduce((n, t) => n + t.stages.length, 0);

export function techniqueProgress(progress, techId) {
  const tech = TECHNIQUE_MAP[techId];
  const rec = progress?.[techId]?.stages || {};
  const matched = tech.stages.filter((s) => rec[s.id]?.matched).length;
  const attempted = tech.stages.filter((s) => rec[s.id]?.attempts > 0).length;
  return { matched, attempted, total: tech.stages.length, complete: matched === tech.stages.length };
}

export function isTechniqueUnlocked(tech, progress) {
  if (!tech.prerequisites?.length) return true;
  return tech.prerequisites.every((pid) => techniqueProgress(progress, pid).complete);
}

export function masteryStatus(progress = {}) {
  let xp = 0;
  for (const t of TECHNIQUES) xp += techniqueProgress(progress, t.id).matched;
  let level = 0;
  let title = LEVELS[0].title;
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (xp >= LEVELS[i].at) { level = i; title = LEVELS[i].title; }
  }
  const nextAt = level + 1 < LEVELS.length ? LEVELS[level + 1].at : null;
  return { xp, totalStages: TOTAL_STAGES, level, title, nextAt, levelAt: LEVELS[level].at };
}
