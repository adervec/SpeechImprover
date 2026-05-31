// Thin, robust wrapper around the Web Speech API (SpeechSynthesis) for reading
// arbitrary text aloud in a chosen voice + prosody. Handles async voice loading
// and chunks long text into contiguous pieces (working around the Chrome bug
// that truncates long single utterances) while keeping exact character offsets
// so callers can highlight the word being spoken.

export function isTTSSupported() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  );
}

// Collapse whitespace to a single canonical string (what we actually speak and,
// for callers, what they should render when highlighting by char offset).
export function prepareText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

// Split clean text into contiguous chunks (<= ~MAX chars), preferring sentence
// then word boundaries. Each chunk carries its exact start offset in the input.
export function chunkText(clean, max = 220) {
  const parts = [];
  const N = clean.length;
  let i = 0;
  while (i < N) {
    let end = Math.min(N, i + max);
    if (end < N) {
      const slice = clean.slice(i, end);
      const sentence = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
      if (sentence > 40) {
        end = i + sentence + 1;
      } else {
        const sp = slice.lastIndexOf(' ');
        if (sp > 40) end = i + sp + 1;
      }
    }
    parts.push({ text: clean.slice(i, end), start: i });
    i = end;
  }
  return parts;
}

export function loadVoices() {
  return new Promise((resolve) => {
    if (!isTTSSupported()) return resolve([]);
    const synth = window.speechSynthesis;
    const have = synth.getVoices();
    if (have && have.length) return resolve(have);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(synth.getVoices() || []);
    };
    synth.addEventListener?.('voiceschanged', finish, { once: true });
    // Fallback: some browsers never fire the event.
    setTimeout(finish, 1200);
  });
}

function pickVoice(voices, voiceURI) {
  return (
    voices.find((v) => v.voiceURI === voiceURI) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0] ||
    null
  );
}

export function cancelTTS() {
  if (isTTSSupported()) window.speechSynthesis.cancel();
}

// Speak `text`. opts: { voiceURI, pitch, rate, volume, onStart, onBoundary({charIndex}), onEnd }.
export function speak(text, opts = {}) {
  const { voiceURI, pitch = 1, rate = 1, volume = 1, onStart, onBoundary, onEnd } = opts;
  if (!isTTSSupported()) {
    onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const clean = prepareText(text);
  if (!clean) {
    onEnd?.();
    return;
  }
  const voices = synth.getVoices();
  const voice = pickVoice(voices, voiceURI);
  const chunks = chunkText(clean);
  let started = false;
  chunks.forEach((chunk, idx) => {
    const u = new window.SpeechSynthesisUtterance(chunk.text);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    u.pitch = Math.max(0, Math.min(2, pitch));
    u.rate = Math.max(0.1, Math.min(3, rate));
    u.volume = Math.max(0, Math.min(1, volume));
    u.onstart = () => {
      if (!started) {
        started = true;
        onStart?.();
      }
    };
    if (onBoundary) {
      u.onboundary = (e) => {
        if (e.charIndex != null) onBoundary({ charIndex: chunk.start + e.charIndex });
      };
    }
    if (idx === chunks.length - 1) {
      u.onend = () => onEnd?.();
      u.onerror = () => onEnd?.();
    }
    synth.speak(u);
  });
}
