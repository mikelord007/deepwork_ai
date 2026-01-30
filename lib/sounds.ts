/**
 * Sound utilities using Web Audio API
 * Generates notification tones without requiring external audio files
 */

export type SoundType = "bell" | "chime" | "gentle" | "success" | "none";

export const SOUND_OPTIONS: { value: SoundType; label: string }[] = [
  { value: "bell", label: "Bell" },
  { value: "chime", label: "Chime" },
  { value: "gentle", label: "Gentle" },
  { value: "success", label: "Success" },
  { value: "none", label: "No sound" },
];

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Play a frequency for a duration with envelope
function playTone(
  frequency: number,
  duration: number,
  startTime: number,
  gainValue: number = 0.3,
  type: OscillatorType = "sine"
) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = type;

  // Envelope for smooth sound
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gainValue, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

// Bell sound - classic notification
function playBell() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Main bell tone
  playTone(830, 0.8, now, 0.4, "sine");
  // Harmonic overtone
  playTone(1660, 0.6, now, 0.15, "sine");
  // Second strike
  playTone(830, 0.6, now + 0.15, 0.25, "sine");
}

// Chime sound - gentle multi-note
function playChime() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Ascending chime notes (C, E, G, C)
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    playTone(freq, 0.5, now + i * 0.15, 0.25, "sine");
  });
}

// Gentle sound - soft single tone
function playGentle() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Soft low tone
  playTone(440, 1.2, now, 0.2, "sine");
  // Subtle overtone
  playTone(880, 0.8, now + 0.1, 0.08, "sine");
}

// Success sound - upbeat completion
function playSuccess() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Quick ascending notes
  playTone(523, 0.15, now, 0.3, "sine");
  playTone(659, 0.15, now + 0.1, 0.3, "sine");
  playTone(784, 0.4, now + 0.2, 0.35, "sine");
}

// Play the sound once (used internally and for first tick of repeat)
function playSoundOnce(soundType: SoundType) {
  if (soundType === "none") return;

  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    ctx.resume();
  }

  switch (soundType) {
    case "bell":
      playBell();
      break;
    case "chime":
      playChime();
      break;
    case "gentle":
      playGentle();
      break;
    case "success":
      playSuccess();
      break;
  }
}

// Main function to play selected sound once (legacy / single play)
export function playNotificationSound(soundType: SoundType) {
  playSoundOnce(soundType);
}

const REPEAT_DURATION_MS = 15000; // 15 seconds when timer goes off
const REPEAT_INTERVAL_MS = 2000;  // Play every 2 seconds
const PREVIEW_DURATION_MS = 4000; // 4 seconds when selecting from dropdown

export interface RepeatOptions {
  durationMs?: number; // total duration; default 15s for timer, use PREVIEW_DURATION_MS for dropdown
}

/**
 * Play the notification sound repeatedly to grab attention.
 * Returns a function to stop the repetition early.
 * @param soundType - which sound to play
 * @param options.durationMs - total duration in ms (default 15000 for timer). Use 4000 for dropdown preview.
 */
export function playNotificationSoundRepeating(
  soundType: SoundType,
  options?: RepeatOptions
): () => void {
  if (soundType === "none") return () => {};

  const durationMs = options?.durationMs ?? REPEAT_DURATION_MS;

  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    ctx.resume();
  }

  // Play immediately
  playSoundOnce(soundType);

  const intervalId = setInterval(() => {
    playSoundOnce(soundType);
  }, REPEAT_INTERVAL_MS);

  const timeoutId = setTimeout(() => {
    clearInterval(intervalId);
  }, durationMs);

  return () => {
    clearInterval(intervalId);
    clearTimeout(timeoutId);
  };
}

// Preview a sound from dropdown - plays for 4 seconds
export function previewSound(soundType: SoundType): () => void {
  return playNotificationSoundRepeating(soundType, { durationMs: PREVIEW_DURATION_MS });
}

// Get/set sound preference from localStorage
const SOUND_STORAGE_KEY = "deepwork_notification_sound";

export function getSavedSound(): SoundType {
  if (typeof window === "undefined") return "bell";
  const saved = localStorage.getItem(SOUND_STORAGE_KEY);
  if (saved && SOUND_OPTIONS.some((opt) => opt.value === saved)) {
    return saved as SoundType;
  }
  return "bell";
}

export function saveSound(soundType: SoundType) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_STORAGE_KEY, soundType);
}
