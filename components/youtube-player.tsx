"use client";

import { useEffect, useRef, useState } from "react";
import { readAudioPreference, saveAudioPreference } from "@/lib/playback";

type Player = {
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getVolume(): number;
  setVolume(volume: number): void;
  playVideo(): void;
  destroy(): void;
};
type YouTubeAPI = {
  Player: new (
    element: HTMLElement,
    options: {
      host: string;
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady(): void;
        onError(): void;
        onAutoplayBlocked(): void;
        onStateChange(event: { data: number }): void;
      };
    },
  ) => Player;
};
type YouTubeWindow = Window & {
  YT?: YouTubeAPI;
  onYouTubeIframeAPIReady?: () => void;
};
let api: Promise<YouTubeAPI> | null = null;
function loadYouTubeAPI() {
  const ytWindow = window as YouTubeWindow;
  if (ytWindow.YT?.Player) return Promise.resolve(ytWindow.YT);
  if (!api)
    api = new Promise((resolve, reject) => {
      const previous = ytWindow.onYouTubeIframeAPIReady;
      ytWindow.onYouTubeIframeAPIReady = () => {
        previous?.();
        if (ytWindow.YT) resolve(ytWindow.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        api = null;
        reject(new Error("YouTube could not be loaded."));
      };
      document.head.appendChild(script);
    });
  return api;
}

export function YouTubePlayer({
  videoId,
  title,
  onError,
  onEnded,
  showEnableSound = true,
}: {
  videoId: string;
  title: string;
  onError: () => void;
  onEnded?: () => void;
  showEnableSound?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const reportError = useRef(onError);
  const reportEnded = useRef(onEnded);
  const [automaticMute, setAutomaticMute] = useState(false);
  useEffect(() => {
    reportError.current = onError;
    reportEnded.current = onEnded;
  }, [onError, onEnded]);
  useEffect(() => {
    let active = true;
    let ready = false;
    let fallbackAttempted = false;
    let expected = readAudioPreference();
    let timer: ReturnType<typeof setInterval> | undefined;
    let player: Player | undefined;
    const rememberChange = () => {
      if (!ready || !player) return;
      const next = {
        muted: player.isMuted(),
        volume: player.getVolume() / 100,
      };
      if (next.muted === expected.muted && next.volume === expected.volume)
        return;
      expected = next;
      saveAudioPreference(next);
      if (active && !next.muted) setAutomaticMute(false);
    };
    void loadYouTubeAPI()
      .then((yt) => {
        if (!active || !container.current) return;
        const mount = document.createElement("div");
        container.current.appendChild(mount);
        player = new yt.Player(mount, {
          host: "https://www.youtube-nocookie.com",
          videoId,
          playerVars: {
            autoplay: 0,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady() {
              if (!active || !player) return;
              ready = true;
              player.setVolume(expected.volume * 100);
              if (expected.muted) player.mute();
              else player.unMute();
              const iframe = container.current?.querySelector("iframe");
              if (iframe) iframe.title = title;
              player.playVideo();
              // The official iframe API has no volume-change event.
              timer = setInterval(rememberChange, 250);
            },
            onAutoplayBlocked() {
              if (!active || !player || fallbackAttempted || player.isMuted())
                return;
              fallbackAttempted = true;
              expected = { ...expected, muted: true };
              setAutomaticMute(true);
              player.mute();
              player.playVideo();
            },
            onError() {
              if (active) reportError.current();
            },
            onStateChange(event) {
              if (active && event.data === 0) reportEnded.current?.();
            },
          },
        });
        playerRef.current = player;
      })
      .catch(() => {
        if (active) reportError.current();
      });
    return () => {
      active = false;
      if (timer) clearInterval(timer);
      rememberChange();
      player?.destroy();
      playerRef.current = null;
    };
  }, [videoId, title]);
  return (
    <div className="absolute inset-0">
      <div ref={container} />
      {showEnableSound && automaticMute && (
        <button
          className="bg-ink/90 hover:bg-brand absolute top-3.5 right-3.5 z-2 border border-white/60 px-3 py-2 text-sm text-white"
          onClick={() => {
            const player = playerRef.current;
            if (!player) return;
            player.unMute();
            saveAudioPreference({
              muted: false,
              volume: player.getVolume() / 100,
            });
            setAutomaticMute(false);
            player.playVideo();
          }}
        >
          Enable sound
        </button>
      )}
    </div>
  );
}
