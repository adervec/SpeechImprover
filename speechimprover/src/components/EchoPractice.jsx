// Delayed auditory feedback: your mic, played back into your headphones a
// fraction of a second late. Short delays (~50–100 ms) tend to slow and smooth
// speech; longer ones (~200 ms) make you notice and over-articulate. Pure Web
// Audio (mic → DelayNode → speakers), nothing recorded.

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';

export default function EchoPractice() {
  const { settings } = useStore();
  const [on, setOn] = useState(false);
  const [delayMs, setDelayMs] = useState(150);
  const [error, setError] = useState(null);
  const ref = useRef(null); // { ctx, stream, delay }

  function stop() {
    const r = ref.current;
    ref.current = null;
    r?.stream.getTracks().forEach((t) => t.stop());
    r?.ctx.close();
    setOn(false);
  }

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: settings.inputDeviceId ? { exact: settings.inputDeviceId } : undefined,
          // Raw voice — the browser's processing would gate and muffle the echo.
          echoCancellation: false, noiseSuppression: false, autoGainControl: false,
        },
      });
      const ctx = new AudioContext();
      const delay = ctx.createDelay(1);
      delay.delayTime.value = delayMs / 1000;
      ctx.createMediaStreamSource(stream).connect(delay).connect(ctx.destination);
      ref.current = { ctx, stream, delay };
      setOn(true);
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  function changeDelay(ms) {
    setDelayMs(ms);
    if (ref.current) ref.current.delay.delayTime.setTargetAtTime(ms / 1000, ref.current.ctx.currentTime, 0.02);
  }

  useEffect(() => () => stop(), []);

  return (
    <div className="card">
      <div className="card-head"><h3>🎧 Echo practice (delayed feedback)</h3></div>
      <p className="muted small">
        Hear yourself a moment late while you read or speak. A short delay nudges you to slow down and
        smooth out; a longer one makes you over-articulate. <b>Use headphones</b> — on speakers it will howl.
      </p>
      <label className="field" style={{ marginTop: 10 }}>
        Delay <span className="mono tiny muted">{delayMs} ms</span>
        <input type="range" min={50} max={400} step={10} value={delayMs} onChange={(e) => changeDelay(Number(e.target.value))} />
      </label>
      <div className="row" style={{ marginTop: 12 }}>
        {on
          ? <button className="btn lg" onClick={stop}>■ Stop echo</button>
          : <button className="btn primary lg" onClick={start}>🎧 Start echo</button>}
        <span className="small muted">{on ? 'Live — nothing is recorded or saved.' : 'Nothing is recorded or saved.'}</span>
      </div>
      {error && <p className="small" style={{ color: 'var(--bad)', marginTop: 10 }} role="alert">⚠️ {error}</p>}
    </div>
  );
}
