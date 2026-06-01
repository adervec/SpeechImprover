// Thin wrapper around the Web Speech API (English). Gracefully reports when the
// browser does not support it (e.g. Firefox) so the UI can offer a manual path.
//
// The recognizer emits *final segments* and *interim text* separately and
// reports end/error events. The caller (recorderContext) accumulates the final
// transcript and restarts the recognizer when the engine ends spontaneously —
// Chrome stops a "continuous" recognition after a pause, which otherwise leaves
// the live transcript frozen or empty for the rest of the take.

export function isRecognitionSupported() {
  return (
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
}

export function createRecognizer({ onFinal, onInterim, onError, onEnd } = {}) {
  const Impl =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!Impl) return null;

  const recog = new Impl();
  recog.lang = 'en-US';
  recog.continuous = true;
  recog.interimResults = true;
  recog.maxAlternatives = 1;

  recog.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const res = event.results[i];
      const alt = res[0];
      if (!alt) continue;
      if (res.isFinal) {
        onFinal?.(alt.transcript || '', alt.confidence || 0);
      } else {
        interim += alt.transcript || '';
      }
    }
    if (interim) onInterim?.(interim);
  };

  recog.onerror = (e) => onError?.(e.error || 'recognition-error');
  recog.onend = () => onEnd?.();

  return {
    start() {
      try {
        recog.start();
      } catch {
        /* already started — safe to ignore */
      }
    },
    stop() {
      try {
        recog.stop();
      } catch {
        /* not running */
      }
    },
    abort() {
      try {
        recog.abort();
      } catch {
        /* not running */
      }
    },
  };
}
