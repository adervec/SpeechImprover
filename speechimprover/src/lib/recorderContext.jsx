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
  const [recognitionError, setRecognitionError] = useState(null);

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const lastLevelUpdate = useRef(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognizerRef = useRef(null);
  const confidenceRef = useRef(0);
  const confSumRef = useRef(0);
  const confCountRef = useRef(0);
  const manualStopRef = useRef(false);
  const recognitionFatalRef = useRef(false);
  const finalTextRef = useRef('');
  const interimRef = useRef(''); // last live interim, so a not-yet-finalized tail isn't lost on stop
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

  // Create + start a recognizer wired to accumulate final text in refs. Reused
  // on auto-restart, so the transcript survives Chrome ending recognition on a
  // pause. Returns the recognizer handle (stored in recognizerRef).
  const startRecognizer = useCallback(() => {
    const rec = createRecognizer({
      onFinal: (segment, confidence) => {
        const seg = segment.trim();
        if (seg) {
          finalTextRef.current = (finalTextRef.current ? `${finalTextRef.current} ${seg}` : seg).trim();
          setFinalText(finalTextRef.current);
          interimRef.current = '';
          setInterim('');
        }
        if (confidence > 0) {
          confSumRef.current += confidence;
          confCountRef.current += 1;
          confidenceRef.current = confSumRef.current / confCountRef.current;
        }
      },
      onInterim: (it) => { interimRef.current = it; setInterim(it); },
      onError: (err) => {
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          recognitionFatalRef.current = true;
          setRecognitionError('Live transcription was blocked — check microphone permission and that the page is on https or localhost.');
        } else if (err === 'language-not-supported') {
          recognitionFatalRef.current = true;
          setRecognitionError('Live transcription for English is not available in this browser.');
        } else if (err === 'network') {
          setRecognitionError('Live transcription needs an internet connection (the browser sends audio to a speech service).');
        } else if (err !== 'no-speech' && err !== 'aborted') {
          setRecognitionError(`Transcription issue: ${err}.`);
        }
      },
      onEnd: () => {
        // Chrome ends a "continuous" recognition after a pause. Restart it while
        // we are still recording so the live transcript keeps flowing.
        if (!manualStopRef.current && !recognitionFatalRef.current) {
          try {
            recognizerRef.current?.start();
          } catch {
            /* ignore */
          }
        }
      },
    });
    recognizerRef.current = rec;
    rec?.start();
    return rec;
  }, []);

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
      interimRef.current = '';
      confidenceRef.current = 0;
      confSumRef.current = 0;
      confCountRef.current = 0;
      setFinalText('');
      setInterim('');
      setRecognitionError(null);

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
        manualStopRef.current = false;
        recognitionFatalRef.current = false;
        startRecognizer();
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
  }, [openStream, teardownStream, recognitionSupported, startRecognizer]);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      const durationSec = (performance.now() - startTimeRef.current) / 1000;

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;

      if (recognizerRef.current) {
        manualStopRef.current = true;
        recognizerRef.current.stop();
      }

      const finish = () => {
        const mime = recorder?.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mime });
        // Include any not-yet-finalized tail: on stop, recognition may not have
        // flushed the last utterance into finalText even though it was visible live.
        let transcript = finalTextRef.current.trim();
        const leftover = interimRef.current.trim();
        if (leftover && !transcript.toLowerCase().endsWith(leftover.toLowerCase())) {
          transcript = (transcript ? `${transcript} ${leftover}` : leftover).trim();
        }
        const confidence = confidenceRef.current;
        recorderRef.current = null;
        chunksRef.current = [];
        teardownStream();
        setMode('idle');
        setInterim('');
        interimRef.current = '';
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
    recognitionError,
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
