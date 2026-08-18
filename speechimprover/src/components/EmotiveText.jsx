import { useState } from 'react';
import { parseTagged, autoTag, TAG_LEGEND } from '../lib/emotive.js';

// Renders provided text with ElevenLabs-v3-style delivery tags as inline chips.
// `text` may already carry tags; otherwise it is auto-tagged (heuristic).
export default function EmotiveText({ text = '', tagged = null }) {
  const src = tagged || autoTag(text);
  return (
    <>
      {parseTagged(src).map((seg, i) =>
        seg.tag != null
          ? <span key={i} className={`etag etag-${seg.tag.replace(/\W+/g, '-')}`} title={legendFor(seg.tag)}>{seg.tag}</span>
          : <span key={i}>{seg.text}</span>
      )}
    </>
  );
}

function legendFor(tag) {
  const hit = TAG_LEGEND.find(([t]) => t === tag);
  return hit ? hit[1] : `deliver: ${tag}`;
}

// Toggle + collapsible legend for the prompt card header.
export function EmotiveToggle({ on, onChange }) {
  const [legend, setLegend] = useState(false);
  return (
    <span className="row" style={{ gap: 6, alignItems: 'center' }}>
      <button type="button" className={`btn ghost sm ${on ? 'active' : ''}`} aria-pressed={on} onClick={() => onChange(!on)} title="ElevenLabs v3 audio-tag style delivery cues: [whispers], [excited], [pause]… CAPITALS = stress">
        🎭 Emotive cues {on ? 'on' : 'off'}
      </button>
      {on && <button type="button" className="btn ghost sm" onClick={() => setLegend((v) => !v)} aria-expanded={legend}>{legend ? 'hide legend' : 'legend'}</button>}
      {on && legend && (
        <div className="etag-legend tiny muted" style={{ flexBasis: '100%' }}>
          {TAG_LEGEND.map(([t, d]) => <span key={t}><span className="etag">{t}</span> {d}</span>)}
          <span><b>CAPITALS</b> = stress the word · <b>…</b> = hesitate/breathe</span>
        </div>
      )}
    </span>
  );
}
