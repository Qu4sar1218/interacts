import failureSoundUrl from '@/assets/sounds/failure-sound.mp3';
import failedScanSoundUrl from '@/assets/sounds/failed-scan.mp3';

let failureAudio: HTMLAudioElement | null = null;
let failedScanAudio: HTMLAudioElement | null = null;

let beepEndedListener: (() => void) | null = null;
let voiceEndedListener: (() => void) | null = null;

function getFailureAudio(): HTMLAudioElement {
  if (!failureAudio) {
    failureAudio = new Audio(failureSoundUrl);
    failureAudio.preload = 'auto';
  }
  return failureAudio;
}

function getFailedScanAudio(): HTMLAudioElement {
  if (!failedScanAudio) {
    failedScanAudio = new Audio(failedScanSoundUrl);
    failedScanAudio.preload = 'auto';
  }
  return failedScanAudio;
}

function clearSequenceListeners(): void {
  const beep = failureAudio;
  const voice = failedScanAudio;
  if (beep && beepEndedListener) {
    beep.removeEventListener('ended', beepEndedListener);
    beepEndedListener = null;
  }
  if (voice && voiceEndedListener) {
    voice.removeEventListener('ended', voiceEndedListener);
    voiceEndedListener = null;
  }
}

/** Stops any in-progress failure beep / failed-scan voice and clears listeners. */
export function cancelFailureSequence(): void {
  clearSequenceListeners();
  try {
    if (failureAudio) {
      failureAudio.pause();
      failureAudio.currentTime = 0;
    }
    if (failedScanAudio) {
      failedScanAudio.pause();
      failedScanAudio.currentTime = 0;
    }
  } catch {
    // Ignore
  }
}

export function playFailureSound() {
  try {
    const audio = getFailureAudio();
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // Ignore sound playback failures (autoplay policies, unsupported devices, etc.).
  }
}

/**
 * Plays the short failure tone, then the failed-scan voice line. Invokes `onComplete` after the voice ends,
 * or if playback is aborted / fails (so UI callbacks always run).
 */
export function playFailureThenFailedScanSound(onComplete?: () => void) {
  clearSequenceListeners();

  const finish = () => {
    clearSequenceListeners();
    onComplete?.();
  };

  const playVoice = () => {
    const voice = getFailedScanAudio();
    voice.currentTime = 0;
    voiceEndedListener = () => {
      finish();
    };
    voice.addEventListener('ended', voiceEndedListener, { once: true });
    voice.play().catch(() => {
      finish();
    });
  };

  try {
    const beep = getFailureAudio();
    beep.currentTime = 0;
    beepEndedListener = () => {
      playVoice();
    };
    beep.addEventListener('ended', beepEndedListener, { once: true });
    beep.play().catch(() => {
      playVoice();
    });
  } catch {
    playVoice();
  }
}
