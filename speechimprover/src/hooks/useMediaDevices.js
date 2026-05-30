// Enumerate audio input/output devices and keep the list fresh. Device labels
// only appear after microphone permission has been granted at least once.

import { useCallback, useEffect, useState } from 'react';

export function useMediaDevices() {
  const [inputs, setInputs] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const [hasLabels, setHasLabels] = useState(false);
  const [supported, setSupported] = useState(true);

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setSupported(false);
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const ins = devices.filter((d) => d.kind === 'audioinput');
      const outs = devices.filter((d) => d.kind === 'audiooutput');
      setInputs(ins);
      setOutputs(outs);
      setHasLabels(ins.some((d) => d.label) || outs.some((d) => d.label));
    } catch {
      setSupported(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
    })();
    if (!navigator.mediaDevices?.addEventListener) return undefined;
    const handler = () => refresh();
    navigator.mediaDevices.addEventListener('devicechange', handler);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handler);
  }, [refresh]);

  return { inputs, outputs, hasLabels, supported, refresh };
}
