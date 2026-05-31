// Voice Lab — read arbitrary text aloud (TTS) in a chosen voice profile:
// your own measured voice, an "improved" version of it, or target/character
// profiles. Shapes pitch, pace and delivery via the Web Speech API.

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { listProfiles, personalProfile, PROFILE_GROUPS } from '../lib/voiceProfiles.js';
import { isTTSSupported, loadVoices, speak, cancelTTS, prepareText } from '../lib/tts.js';
import { READING_LIBRARY } from '../lib/exercises.js';

const SLIDERS = [
  { key: 'pitch', label: 'Pitch', min: 0.4, max: 2, step: 0.05 },
  { key: 'rate', label: 'Pace', min: 0.5, max: 1.8, step: 0.05 },
  { key: 'volume', label: 'Volume', min: 0, max: 1, step: 0.05 },
];

export default function VoiceLab() {
  const { sessions, profile } = useStore();
  const supported = isTTSSupported();

  const profiles = useMemo(() => listProfiles(sessions, profile), [sessions, profile]);
  const [profileId, setProfileId] = useState('personal');
  const [params, setParams] = useState(() => personalProfile(sessions, profile).params);
  const [text, setText] = useState('Type anything here, pick a voice profile, and press play to hear it read aloud.');
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [mark, setMark] = useState(-1);

  const selected = profiles.find((p) => p.id === profileId) || profiles[0];
  const clean = prepareText(text);

  useEffect(() => {
    let active = true;
    loadVoices().then((vs) => {
      if (!active) return;
      setVoices(vs);
      setVoiceURI((cur) => cur || (vs.find((v) => /^en/i.test(v.lang)) || vs[0])?.voiceURI || '');
    });
    return () => { active = false; };
  }, []);

  // Stop any speech if we leave the page.
  useEffect(() => () => cancelTTS(), []);

  function chooseProfile(p) {
    setProfileId(p.id);
    setParams({ ...p.params });
  }

  function handleSpeak() {
    if (!clean) return;
    setMark(-1);
    speak(text, {
      voiceURI,
      pitch: params.pitch,
      rate: params.rate,
      volume: params.volume,
      onStart: () => setSpeaking(true),
      onBoundary: ({ charIndex }) => setMark(charIndex),
      onEnd: () => { setSpeaking(false); setMark(-1); },
    });
  }

  function handleStop() {
    cancelTTS();
    setSpeaking(false);
    setMark(-1);
  }

  function spokenWithHighlight() {
    if (mark < 0 || mark >= clean.length) return clean;
    let end = mark;
    while (end < clean.length && clean[end] !== ' ') end += 1;
    return (
      <>
        {clean.slice(0, mark)}
        <span className="tts-word">{clean.slice(mark, end)}</span>
        {clean.slice(end)}
      </>
    );
  }

  return (
    <div className="stack">
      <div className="card" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-2) 16%, var(--surface)), var(--surface))' }}>
        <div className="tag">Voice lab</div>
        <h2 style={{ margin: '2px 0 6px' }}>Hear any text in a voice profile</h2>
        <p className="muted small">
          Read arbitrary text aloud as your own voice, an improved version of it, or a target/character
          profile. Profiles shape pitch, pace and delivery; the timbre comes from your chosen system voice.
        </p>
      </div>

      {!supported && (
        <div className="card" style={{ borderColor: 'var(--warn)' }}>
          <p className="small">⚠️ This browser doesn’t support speech synthesis. Try Chrome, Edge or Safari.</p>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>Text to read</h3>
          <button className="btn ghost sm" onClick={() => setText(READING_LIBRARY[Math.floor(Math.random() * READING_LIBRARY.length)].text)}>
            🎲 Sample passage
          </button>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Paste or type any text…" />
        {speaking && (
          <div className="card tight" style={{ marginTop: 12, background: 'var(--bg-2)' }}>
            <div className="tag" style={{ marginBottom: 6 }}>Now reading</div>
            <p style={{ lineHeight: 1.8 }}>{spokenWithHighlight()}</p>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h3>Voice profile</h3></div>
        {PROFILE_GROUPS.map((g) => {
          const items = profiles.filter((p) => p.group === g.key);
          if (!items.length) return null;
          return (
            <div key={g.key} style={{ marginBottom: 12 }}>
              <div className="tiny muted" style={{ marginBottom: 6 }}>{g.label}</div>
              <div className="pill-group">
                {items.map((p) => (
                  <button key={p.id} className={`pill ${profileId === p.id ? 'active' : ''}`} onClick={() => chooseProfile(p)}>
                    {p.emoji} {p.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <p className="small muted" style={{ marginTop: 4 }}>{selected?.desc}</p>
      </div>

      <div className="card">
        <div className="card-head"><h3>Fine-tune</h3><span className="tiny muted">changes apply on the next play</span></div>
        <label className="field" style={{ marginBottom: 12 }}>
          System voice (timbre)
          <select value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)} disabled={!voices.length}>
            {voices.length === 0 && <option value="">Default voice</option>}
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang}){v.default ? ' — default' : ''}</option>
            ))}
          </select>
        </label>
        {!voices.length && (
          <p className="tiny muted" style={{ marginTop: -4, marginBottom: 12 }}>
            No selectable system voices detected — your browser will use its built-in default.
          </p>
        )}
        <div className="grid cols-3">
          {SLIDERS.map((s) => (
            <label key={s.key} className="field">
              {s.label} <span className="mono tiny muted">{params[s.key].toFixed(2)}</span>
              <input
                type="range" min={s.min} max={s.max} step={s.step} value={params[s.key]}
                onChange={(e) => setParams((prev) => ({ ...prev, [s.key]: Number(e.target.value) }))}
              />
            </label>
          ))}
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          {!speaking ? (
            <button className="btn primary lg" onClick={handleSpeak} disabled={!supported || !clean}>▶ Play</button>
          ) : (
            <button className="btn lg" onClick={handleStop}>■ Stop</button>
          )}
          <span className="small muted">
            {selected?.emoji} {selected?.label} · pitch {params.pitch.toFixed(2)} · pace {params.rate.toFixed(2)}×
          </span>
        </div>
      </div>

      <p className="tiny muted">
        Voice profiles shape pitch, pace and delivery — they are not voice clones; timbre comes from the system
        voice. For true DSP-enhanced projection of your <i>actual</i> recorded voice, use “Hear an improved version
        of your voice” on a session.
      </p>
    </div>
  );
}
