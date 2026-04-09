import successSoundUrl from '@/assets/sounds/success-sound.mp3';
import verifiedCheckInSoundUrl from '@/assets/sounds/verified-check-in.mp3';
import verifiedCheckOutSoundUrl from '@/assets/sounds/verified-check-out.mp3';

let successAudio: HTMLAudioElement | null = null;
let checkInAudio: HTMLAudioElement | null = null;
let checkOutAudio: HTMLAudioElement | null = null;

export type SuccessAction = 'check-in' | 'check-out';

function getSuccessAudio(): HTMLAudioElement {
  if (!successAudio) {
    successAudio = new Audio(successSoundUrl);
    successAudio.preload = 'auto';
  }
  return successAudio;
}

function getCheckInAudio(): HTMLAudioElement {
  if (!checkInAudio) {
    checkInAudio = new Audio(verifiedCheckInSoundUrl);
    checkInAudio.preload = 'auto';
  }
  return checkInAudio;
}

function getCheckOutAudio(): HTMLAudioElement {
  if (!checkOutAudio) {
    checkOutAudio = new Audio(verifiedCheckOutSoundUrl);
    checkOutAudio.preload = 'auto';
  }
  return checkOutAudio;
}

export function playSuccessSound() {
  try {
    const audio = getSuccessAudio();
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // Ignore sound playback failures (autoplay policies, unsupported devices, etc.).
  }
}

export function playSuccessSoundByAction(action: SuccessAction) {
  try {
    const audio = action === 'check-in' ? getCheckInAudio() : getCheckOutAudio();
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // Fall back to legacy success tone if specific assets fail to play.
    playSuccessSound();
  }
}
