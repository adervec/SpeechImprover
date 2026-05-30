// Single owner of the live microphone stream. Powers both the global recording
// indicator and the always-visible mic level meter, plus the Practice flow's
// recording + live transcription. Centralizing here guarantees there is exactly
// one getUserMedia stream and one obvious "we are recording" source of truth.
/* eslint-disable react-refresh/only-export-components -- context provider + its hook. */

import { createContext, useContext, useRef, useState, useCallback } from 'react';
import { createRecognizer, isRecognitionSupported } from './analysis/speechRecognition.js';

const RecorderContext = createContext(null);

function pickMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  if (typeof MediaRecorder === 'undefined') return '';
  return candidates.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
}

export function RecorderProvider({ children }) {
  const [mode, setMode] = useState('idle'); // idle | monitoring | recording
  const [level, setLevel] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const lastLevelUpdate = useRef(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognizerRef = useRef(null);
  const confidenceRef = useRef(0);
  const finalTextRef = useRef('');
  const startTimeRef = useRef(0);
  const timerRef = useRef(null);
  const activeDeviceRef = useRef('');

  const recognitionSupported = !!isRecognitionSupported();

  const stopLevelLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const teardownStream = useCallback(() => {
    stopLevelLoop();
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    setLevel(0);
  }, [stopLevelLoop]);

  const startLevelLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i += 1) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();
      if (now - lastLevelUpdate.current > 45) {
        lastLevelUpdate.current = now;
        // gentle non-linear boost so quiet speech is visible
        setLevel(Math.min(1, rms * 3.2));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const openStream = useCallback(async (deviceId) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not available in this browser.');
    }
    const constraints = {
      audio: deviceId
        ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }
        : { echoCancellation: true, noiseSuppression: true },
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef.current = stream;
    activeDeviceRef.current = deviceId || '';
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    startLevelLoop();
    return stream;
  }, [startLevelLoop]);

  const startMonitor = useCallback(async (deviceId) => {
    setError(null);
    try {
      if (mode === 'recording') return;
      if (streamRef.current && activeDeviceRef.current === (deviceId || '')) {
        setMode('monitoring');
        return;
      }
      teardownStream();
      await openStream(deviceId);
      setMode('monitoring');
    } catch (e) {
      setError(e.message || String(e));
      setMode('idle');
    }
  }, [mode, openStream, teardownStream]);

  const stopMonitor = useCallback(() => {
    if (mode === 'recording') return;
    teardownStream();
    setMode('idle');
  }, [mode, teardownStream]);

  const startRecording = useCallback(async (deviceId, { recognition = true } = {}) => {
    setError(null);
    try {
      // reuse an existing monitor stream on the same device if present
      if (!streamRef.current || activeDeviceRef.current !== (deviceId || '')) {
        teardownStream();
        await openStream(deviceId);
      }
      chunksRef.current = [];
      finalTextRef.current = '';
      confidenceRef.current = 0;
      setFinalText('');
      setInterim('');

      const mime = pickMimeType();
      const recorder = new MediaRecorder(
        streamRef.current,
        mime ? { mimeType: mime } : undefined
      );
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(250);
      recorderRef.current = recorder;

      if (recognition && recognitionSupported) {
        const recognizer = createRecognizer({
          onResult: ({ finalText: ft, interim: it, confidence }) => {
            finalTextRef.current = ft;
            confidenceRef.current = confidence;
            setFinalText(ft);
            setInterim(it);
          },
          onError: () => {},
        });
        recognizerRef.current = recognizer;
        recognizer?.start();
      }

      startTimeRef.current = performance.now();
      setElapsedMs(0);
      timerRef.current = setInterval(() => {
        setElapsedMs(performance.now() - startTimeRef.current);
      }, 200);

      setMode('recording');
    } catch (e) {
      setError(e.message || String(e));
      setMode('idle');
    }
  }, [openStream, teardownStream, recognitionSupported]);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      const durationSec = (performance.now() - startTimeRef.current) / 1000;

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;

      if (recognizerRef.current) recognizerRef.current.stop();

      const finish = () => {
        const mime = recorder?.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mime });
        const transcript = finalTextRef.current.trim();
        const confidence = confidenceRef.current;
        recorderRef.current = null;
        chunksRef.current = [];
        teardownStream();
        setMode('idle');
        setInterim('');
        resolve({ blob, mime, durationSec, transcript, confidence });
      };

      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = finish;
        recorder.stop();
      } else {
        finish();
      }
    });
  }, [teardownStream]);

  const value = {
    mode,
    level,
    elapsedMs,
    finalText,
    interim,
    error,
    recognitionSupported,
    isRecording: mode === 'recording',
    isMonitoring: mode === 'monitoring',
    isActive: mode !== 'idle',
    startMonitor,
    stopMonitor,
    startRecording,
    stopRecording,
  };

  return <RecorderContext.Provider value={value}>{children}</RecorderContext.Provider>;
}

export function useRecorder() {
  const ctx = useContext(RecorderContext);
  if (!ctx) throw new Error('useRecorder must be used within RecorderProvider');
  return ctx;
}
