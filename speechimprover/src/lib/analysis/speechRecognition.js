// Thin wrapper around the Web Speech API (English). Gracefully reports when the
// browser does not support it (e.g. Firefox) so the UI can offer a manual path.

export function isRecognitionSupported() {
  return (
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  );
}

export function createRecognizer({ onResult, onError } = {}) {
  const Impl = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Impl) return null;

  const recog = new Impl();
  recog.lang = 'en-US';
  recog.continuous = true;
  recog.interimResults = true;

  let finalText = '';
  let confidenceSum = 0;
  let confidenceCount = 0;

  recog.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const res = event.results[i];
      if (res.isFinal) {
        finalText += `${res[0].transcript} `;
        if (res[0].confidence > 0) {
          confidenceSum += res[0].confidence;
          confidenceCount += 1;
        }
      } else {
        interim += res[0].transcript;
      }
    }
    if (onResult) {
      onResult({
        finalText: finalText.trim(),
        interim,
        confidence: confidenceCount ? confidenceSum / confidenceCount : 0,
      });
    }
  };

  recog.onerror = (e) => {
    if (onError) onError(e.error || 'recognition-error');
  };

  return {
    start() {
      try {
        recog.start();
      } catch {
        /* already started */
      }
    },
    stop() {
      try {
        recog.stop();
      } catch {
        /* not running */
      }
    },
    getResult() {
      return {
        finalText: finalText.trim(),
        confidence: confidenceCount ? confidenceSum / confidenceCount : 0,
      };
    },
  };
}
