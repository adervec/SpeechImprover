// Native <audio> for our recordings. MediaRecorder webm/opus blobs ship without a
// duration in their metadata, so browsers report duration === Infinity until forced —
// which leaves the built-in progress slider stuck / unrelated to actual playback.
// Fix: on metadata load, nudge currentTime to the end once so the browser computes the
// real duration, then snap back to 0. No-ops for blobs that already have a duration
// (e.g. the WAV export preview), so it's safe to use for every player.

import { useRef } from 'react';

export default function RecordingAudio({ src, style, ...rest }) {
  const fixed = useRef(false);

  const onLoadedMetadata = (e) => {
    const el = e.currentTarget;
    if (fixed.current) return;
    if (el.duration === Infinity || Number.isNaN(el.duration)) {
      fixed.current = true;
      const reset = () => { el.removeEventListener('timeupdate', reset); el.currentTime = 0; };
      el.addEventListener('timeupdate', reset);
      el.currentTime = 1e101; // clamps to true end → browser resolves the real duration
    }
  };

  return <audio src={src} controls onLoadedMetadata={onLoadedMetadata} style={{ width: '100%', ...style }} {...rest} />;
}
