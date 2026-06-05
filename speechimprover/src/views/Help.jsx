import { ATTRIBUTES } from '../lib/analysis/attributes.js';

// How each attribute is measured + a concrete way to improve it (from the guide §3/§4).
const ATTR_HELP = {
  pace: { measure: 'Words per minute, from the live transcript.', tip: 'Pause at commas and periods; finish a thought, then breathe. Aim for ~110–150 wpm.' },
  clarity: { measure: 'High-frequency (consonant) energy + speech-recognition confidence.', tip: 'Open your jaw a little more than feels natural and finish word endings (-t, -d, -ing).' },
  fillers: { measure: 'Count of “um / uh / like / you know …” per minute.', tip: 'Replace a filler with a short silent pause — it feels longer to you than to listeners.' },
  nonRepetition: { measure: 'Type–token ratio plus penalties for repeated words and false starts.', tip: 'Vary your phrasing and slow down so your word choice can keep up with your mouth.' },
  resonantDepth: { measure: 'Median pitch (F0), scored relative to your profile.', tip: 'Breathe low and speak on a relaxed, supported tone. Never force a deeper voice — it strains.' },
  expressiveness: { measure: 'Pitch variation (in semitones) across the clip.', tip: 'Read a children’s story aloud with full expression to stretch your pitch range.' },
  nonNasal: { measure: 'Mid-band vs. high-band spectral balance (a rough estimate).', tip: 'Open the throat and mouth and let the sound resonate forward, rather than pinched.' },
  noUptalk: { measure: 'Pitch slope over the end of each utterance (rising = uptalk).', tip: 'Let statements fall at the end; save rising pitch for genuine questions.' },
  projection: { measure: 'Average energy and how well energy holds at phrase ends.', tip: 'Project from the breath, not the throat, and keep the volume up through the last word.' },
  breath: { measure: 'Share of silence and the number of pauses.', tip: 'Plan breath points in long sentences; aim for steady pauses — not gasping or run-ons.' },
};

const TOC = [
  ['start', 'Quick start'],
  ['recording', 'Recording & devices'],
  ['results', 'Understanding your results'],
  ['attributes', 'The 10 attributes'],
  ['exercises', 'Exercises & programs'],
  ['trends', 'Trends'],
  ['history', 'History, repeat & compare'],
  ['data', 'Data, privacy & purging'],
  ['profile', 'Profile & themes'],
  ['browser', 'Browser support'],
  ['trouble', 'Troubleshooting'],
  ['guide', 'The Baseline guide'],
];

function go(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function Section({ id, title, children }) {
  return (
    <div className="card" id={id} style={{ scrollMarginTop: 80 }}>
      <div className="card-head"><h2>{title}</h2><button className="btn ghost sm" onClick={() => go('top')}>↑ top</button></div>
      {children}
    </div>
  );
}

export default function Help({ navigate }) {
  return (
    <div className="stack" id="top">
      <div className="card" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, var(--surface)), var(--surface))' }}>
        <div className="tag">Help &amp; reference</div>
        <h1 style={{ margin: '4px 0 8px' }}>How SpeechImprover works</h1>
        <p className="muted" style={{ maxWidth: 680 }}>
          Record yourself speaking English, get a local analysis of ten speaking attributes, and practice
          targeted exercises to improve. Your recordings and analysis stay in your browser.
        </p>
        <div className="row wrap" style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={() => navigate('practice')}>● Start a session</button>
          <a className="btn" href={`${import.meta.env.BASE_URL}baseline-guide.html`} target="_blank" rel="noreferrer">📖 Open the Baseline guide ↗</a>
          <button className="btn" onClick={() => navigate('references')}>🎯 Reference patterns</button>
        </div>
      </div>

      <div className="card tight" style={{ borderColor: 'color-mix(in srgb, var(--warn) 55%, var(--border))', background: 'color-mix(in srgb, var(--warn) 8%, var(--surface))' }}>
        <b>⚠️ Not professional advice.</b>{' '}
        <span className="muted small">
          SpeechImprover is an experimental tool made by a software developer — not a doctor,
          speech-language pathologist, therapist, or coach, and its analysis is not clinically
          validated. For any speech, voice, or hearing concern, please consult a qualified professional.{' '}
          <a href="https://github.com/adervec/SpeechImprover/blob/main/DISCLAIMER.md" target="_blank" rel="noreferrer">Read the full disclaimer ↗</a>
        </span>
      </div>

      <div className="card">
        <div className="card-head"><h3>Contents</h3></div>
        <div className="pill-group">
          {TOC.map(([id, label]) => (
            <button key={id} className="pill" onClick={() => go(id)}>{label}</button>
          ))}
        </div>
      </div>

      <Section id="start" title="Quick start">
        <ol className="stack" style={{ gap: 8, paddingLeft: 20 }}>
          <li>Open <b>Practice</b> (or pick an exercise from <b>Exercises</b>).</li>
          <li>Check the <b>input device</b> and watch the <b>mic level meter</b> in the top bar respond to your voice. Use <b>Test mic</b> if it isn’t moving.</li>
          <li>Press <b>● Start recording</b>. A red banner makes it unmistakable that recording is live.</li>
          <li>Read the prompt or speak freely. Your <b>live transcript</b> appears as you talk (Chrome/Edge).</li>
          <li>Press <b>■ Stop &amp; analyze</b>. You’ll get a <b>session debrief</b> with one win and one thing to revisit.</li>
          <li>Repeat most days. Re-record the <b>Baseline</b> set monthly and use <b>Compare</b> for an A/B review.</li>
        </ol>
        <p className="muted small" style={{ marginTop: 12 }}>
          The guide’s core advice: pick just <b>two</b> attributes to focus on at a time, and aim for ~10 focused
          minutes most days rather than one long session.
        </p>
      </Section>

      <Section id="recording" title="Recording & devices">
        <p className="muted small">
          The <b>device bar</b> in the top bar is always visible. It shows your selected <b>🎤 input</b> and
          <b> 🔊 output</b> devices and a live microphone level meter, so you always know what’s being used and
          that input is being received.
        </p>
        <ul className="stack" style={{ gap: 6, paddingLeft: 20, marginTop: 10 }}>
          <li><b>Mic level meter</b> — fills as you speak; the dot turns green while monitoring and red while recording.</li>
          <li><b>Recording banner</b> — a fixed red “RECORDING — your microphone is live” bar appears whenever capture is on.</li>
          <li><b>Choose devices</b> in <b>Settings → Audio devices</b>. Grant microphone permission once to see device names.</li>
          <li><b>Test mic</b> opens the microphone without recording, just to confirm the level meter moves.</li>
        </ul>
      </Section>

      <Section id="results" title="Understanding your results">
        <div className="stack" style={{ gap: 10 }}>
          <p className="muted small"><b>Overall score (0–100)</b> — a weighted average of every attribute that could be measured.</p>
          <p className="muted small"><b>Alignment to target (%)</b> — how much closer your pattern sits to the <span style={{ color: 'var(--good)' }}>desirable</span> reference than the <span style={{ color: 'var(--bad)' }}>undesirable</span> one. Higher is better.</p>
          <p className="muted small"><b>Distance to desirable / undesirable</b> — the raw weighted distances behind the alignment figure (lower distance to desirable is the goal).</p>
          <p className="muted small"><b>Pattern map (radar)</b> — your session overlaid on both reference patterns at a glance.</p>
          <p className="muted small"><b>Transcript</b> — what was heard, with fillers <span className="highlight-filler">highlighted</span>.</p>
          <p className="muted small"><b>Measured signals</b> — the raw numbers (pace, pitch, pauses, etc.) the scores are derived from.</p>
        </div>
        <div className="card tight" style={{ marginTop: 12, background: 'var(--bg-2)' }}>
          <b className="small">A note on accuracy</b>
          <p className="tiny muted" style={{ marginTop: 4 }}>
            All analysis is heuristic and fully local — there is no cloud model. Nasality and mumbling in
            particular are spectral approximations, not clinical measurements. Treat the scores as a consistent
            yardstick for tracking <i>your own</i> change over time, not as an absolute verdict.
          </p>
        </div>
      </Section>

      <Section id="attributes" title="The 10 attributes">
        <p className="muted small" style={{ marginBottom: 12 }}>
          Each is scored 0–100 (higher is better). Pace, filler economy and non-repetition need the live
          transcript; the rest come from the audio itself.
        </p>
        <div className="stack" style={{ gap: 0 }}>
          {ATTRIBUTES.map((a) => (
            <div key={a.key} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="row spread">
                <b>{a.label}</b>
                <span className="tiny muted">{a.guideSection}</span>
              </div>
              <p className="small" style={{ margin: '4px 0' }}>{a.blurb}</p>
              <p className="tiny muted"><b>Measured:</b> {ATTR_HELP[a.key]?.measure}</p>
              <p className="tiny" style={{ color: 'var(--accent-2)' }}><b>Improve:</b> {ATTR_HELP[a.key]?.tip}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="exercises" title="Exercises & programs">
        <ul className="stack" style={{ gap: 6, paddingLeft: 20 }}>
          <li><b>Modes</b> — read a <b>provided passage</b>, paste your <b>own / unseen text</b>, speak to a <b>free / improv</b> prompt, run an <b>articulation</b> twister, or do a <b>warm-up</b>.</li>
          <li><b>Generated program</b> — a ~12-minute routine (warm-up → articulation → core drill → capture) automatically aimed at your two weakest attributes.</li>
          <li><b>Baseline set</b> — three samples (reading, free speech, high-pressure) that form your reference point. Re-record them monthly.</li>
          <li><b>Library</b> — filter every exercise by the attribute it trains.</li>
        </ul>
      </Section>

      <Section id="trends" title="Trends">
        <p className="muted small">
          Plot your <b>overall</b> score or any individual attribute over time (up to five at once). Use the
          <b> subset</b> filter to trend a coherent slice — e.g. only free-speaking sessions, or only repeats of one
          exercise — so you compare like with like. Click any point to jump to that session.
        </p>
      </Section>

      <Section id="history" title="History, repeat & compare">
        <ul className="stack" style={{ gap: 6, paddingLeft: 20 }}>
          <li>Everything you record is <b>kept by default</b> and searchable by title, notes or transcript.</li>
          <li><b>▶ Play</b> the recording inline, <b>Open</b> the full breakdown, or <b>Repeat</b> the same exercise.</li>
          <li><b>⇄ Compare</b> — select two sessions, then open an A/B view with a radar overlay and per-attribute deltas. Ideal for monthly baseline reviews.</li>
        </ul>
      </Section>

      <Section id="data" title="Data, privacy & purging">
        <ul className="stack" style={{ gap: 6, paddingLeft: 20 }}>
          <li><b>Local only</b> — sessions and audio live in this browser (IndexedDB); your profile and settings in local storage. Nothing is uploaded.</li>
          <li><b>Export / import</b> JSON from Settings, optionally including audio, to back up or move devices.</li>
          <li><b>Purge audio</b> — drop just the bulky recordings while keeping every score and trend (per session, or all at once).</li>
          <li><b>Delete / reset</b> — remove individual sessions or wipe everything. Only your own recordings are ever stored — there is no sample data. Export first.</li>
        </ul>
      </Section>

      <Section id="profile" title="Profile & themes">
        <p className="muted small">
          Your <b>profile</b> (age, gender, native language, country of birth) is reference context — for example,
          <b> resonant-depth</b> is scored relative to your profile, so changing gender recalibrates past sessions.
          Pick <b>focus targets</b> here too. Choose from six modern <b>themes</b> in Settings.
        </p>
      </Section>

      <Section id="browser" title="Browser support">
        <ul className="stack" style={{ gap: 6, paddingLeft: 20 }}>
          <li><b>Chrome or Edge</b> are recommended — they support the Web Speech API used for live transcription (needed for pace, filler and vocabulary scores).</li>
          <li>In other browsers (e.g. Firefox), pitch, energy and articulation are still analyzed; transcript-based scores are skipped and clearly marked.</li>
          <li><b>Microphone permission</b> is required to record. If you blocked it, re-enable it in the browser’s site settings.</li>
          <li>This app analyzes <b>English</b> speech only for now.</li>
        </ul>
      </Section>

      <Section id="trouble" title="Troubleshooting">
        <div className="stack" style={{ gap: 10 }}>
          <div><b className="small">Mic level meter isn’t moving</b><p className="tiny muted">Check the input device in Settings, click <b>Test mic</b>, and make sure the browser has microphone permission and your OS isn’t muting the mic.</p></div>
          <div><b className="small">No transcript / no pace &amp; filler scores</b><p className="tiny muted">Live transcription needs Chrome or Edge and an internet connection. Audio-based attributes still score. You can also enable/disable it in Settings.</p></div>
          <div><b className="small">Device names show as blank</b><p className="tiny muted">Browsers hide device labels until you grant mic access once. Use <b>Settings → Grant mic access</b>.</p></div>
          <div><b className="small">A score looks surprising</b><p className="tiny muted">Very short clips, background noise, or a distant mic skew the estimates. Record 30–90s in a quiet room, close to the mic.</p></div>
          <div><b className="small">History looks empty</b><p className="tiny muted">Private/incognito windows may block storage. The app shows a banner if storage is unavailable.</p></div>
        </div>
      </Section>

      <Section id="guide" title="The Baseline guide">
        <p className="muted small" style={{ marginBottom: 12 }}>
          The exercises, attributes and reference patterns here are distilled from <b>The Continuous Speech
          Improvement Guide</b>. You can read the original in full at any time.
        </p>
        <div className="row wrap">
          <a className="btn primary" href={`${import.meta.env.BASE_URL}baseline-guide.html`} target="_blank" rel="noreferrer">📖 Open the guide in a new tab ↗</a>
          <button className="btn" onClick={() => navigate('references', { query: { tab: 'guide' } })}>View it inside the app</button>
        </div>
      </Section>
    </div>
  );
}
