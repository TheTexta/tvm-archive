export type AudioPreference = { muted: boolean; volume: number };
export const AUDIO_PREFERENCE_KEY = "tvm:audio-preference";
let remembered: AudioPreference = { muted: false, volume: 1 };

export function readAudioPreference(): AudioPreference {
  try {
    const saved = JSON.parse(
      localStorage.getItem(AUDIO_PREFERENCE_KEY) || "null",
    );
    if (
      saved &&
      typeof saved.muted === "boolean" &&
      typeof saved.volume === "number" &&
      Number.isFinite(saved.volume) &&
      saved.volume >= 0 &&
      saved.volume <= 1
    )
      remembered = { muted: saved.muted, volume: saved.volume };
  } catch {
    /* Playback still works when browser storage is unavailable. */
  }
  return { ...remembered };
}

export function saveAudioPreference(preference: AudioPreference) {
  remembered = { ...preference };
  try {
    localStorage.setItem(AUDIO_PREFERENCE_KEY, JSON.stringify(preference));
  } catch {
    /* Keep the preference in memory for the next video. */
  }
}

type PlaybackMedia = { muted: boolean; play: () => Promise<void> };

// Muting to satisfy autoplay policy is temporary, never a saved viewer choice.
export async function attemptAutoplay(
  media: PlaybackMedia,
  onAutomaticMute: () => void,
  isActive: () => boolean = () => true,
): Promise<boolean> {
  try {
    await media.play();
    return true;
  } catch (error) {
    if (
      !isActive() ||
      media.muted ||
      !(error instanceof Error) ||
      error.name !== "NotAllowedError"
    )
      return false;
    onAutomaticMute();
    media.muted = true;
    try {
      await media.play();
      return true;
    } catch {
      /* The caller can offer native controls if all autoplay is blocked. */
      return false;
    }
  }
}
