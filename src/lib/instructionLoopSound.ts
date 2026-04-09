let activeInstructionAudio: HTMLAudioElement | null = null;
let activeInstructionUrl: string | null = null;
let replayTimeout: number | null = null;
let endedListener: (() => void) | null = null;
const LOOP_INTERVAL_MS = 1000;

function clearReplayTimeout() {
  if (replayTimeout != null) {
    window.clearTimeout(replayTimeout);
    replayTimeout = null;
  }
}

function detachEndedListener() {
  if (activeInstructionAudio && endedListener) {
    activeInstructionAudio.removeEventListener('ended', endedListener);
  }
  endedListener = null;
}

export function playInstructionLoopSound(url: string) {
  try {
    if (activeInstructionAudio && activeInstructionUrl === url) {
      if (activeInstructionAudio.paused) {
        activeInstructionAudio.currentTime = 0;
        activeInstructionAudio.play().catch(() => {});
      }
      return;
    }

    if (activeInstructionAudio) {
      activeInstructionAudio.pause();
      activeInstructionAudio.currentTime = 0;
    }
    clearReplayTimeout();
    detachEndedListener();

    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.loop = false;
    activeInstructionAudio = audio;
    activeInstructionUrl = url;

    endedListener = () => {
      clearReplayTimeout();
      replayTimeout = window.setTimeout(() => {
        if (!activeInstructionAudio || activeInstructionUrl !== url) return;
        activeInstructionAudio.currentTime = 0;
        activeInstructionAudio.play().catch(() => {});
      }, LOOP_INTERVAL_MS);
    };
    audio.addEventListener('ended', endedListener);

    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // Ignore loop playback failures (autoplay/device restrictions).
  }
}

export function stopInstructionLoopSound() {
  clearReplayTimeout();
  detachEndedListener();
  if (!activeInstructionAudio) return;
  try {
    activeInstructionAudio.pause();
    activeInstructionAudio.currentTime = 0;
  } catch {
    // Ignore stop errors.
  } finally {
    activeInstructionAudio = null;
    activeInstructionUrl = null;
  }
}
