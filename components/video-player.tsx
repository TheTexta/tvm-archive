"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Video } from "@/lib/catalogue";
import { Icon } from "./icon";
import {
  attemptAutoplay,
  readAudioPreference,
  saveAudioPreference,
} from "@/lib/playback";
import { YouTubePlayer } from "./youtube-player";

export function VideoPlayer({
  video,
  autoPlay = false,
  onEnded,
  showEnableSound = true,
}: {
  video: Video;
  autoPlay?: boolean;
  onEnded?: () => void;
  showEnableSound?: boolean;
}) {
  const [playing, setPlaying] = useState(autoPlay);
  const [failed, setFailed] = useState(false);
  const [automaticMute, setAutomaticMute] = useState(false);
  const media = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = media.current;
    if (!element) return;
    let active = true;
    let expected = readAudioPreference();
    element.muted = expected.muted;
    element.volume = expected.volume;
    const rememberChange = () => {
      if (
        element.muted === expected.muted &&
        element.volume === expected.volume
      )
        return;
      expected = { muted: element.muted, volume: element.volume };
      saveAudioPreference(expected);
      if (active && !element.muted) setAutomaticMute(false);
    };
    element.addEventListener("volumechange", rememberChange);
    if (autoPlay)
      void attemptAutoplay(
        element,
        () => {
          expected = { ...expected, muted: true };
          setAutomaticMute(true);
        },
        () => active,
      );
    return () => {
      active = false;
      rememberChange();
      element.removeEventListener("volumechange", rememberChange);
    };
  }, [autoPlay, video.source]);
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:block [&_iframe]:size-full [&_iframe]:border-0 [&_video]:absolute [&_video]:inset-0 [&_video]:block [&_video]:size-full [&_video]:object-contain">
      {video.source.type === "mp4" ? (
        <video
          aria-label={video.title}
          crossOrigin="anonymous"
          ref={media}
          src={video.source.url}
          poster={video.poster}
          controls
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          onEnded={onEnded}
        >
          {video.source.captions && (
            <track
              src={video.source.captions}
              kind="captions"
              label="English"
              srcLang="en"
            />
          )}
        </video>
      ) : (
        <>
          <Image
            className="object-contain"
            src={video.poster}
            alt={`Still from ${video.title}`}
            fill
            sizes="(max-width: 800px) 100vw, 70vw"
            priority
          />
          {playing ? (
            <YouTubePlayer
              videoId={video.source.id}
              title={video.title}
              onError={() => setFailed(true)}
              onEnded={onEnded}
              showEnableSound={showEnableSound}
            />
          ) : (
            <button
              className="bg-brand hover:text-brand absolute top-1/2 left-1/2 grid size-18.5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/60 text-white hover:bg-white"
              onClick={() => setPlaying(true)}
              aria-label={`Play ${video.title}`}
            >
              <Icon name="play" size={28} />
            </button>
          )}
        </>
      )}
      {showEnableSound && automaticMute && !failed && (
        <button
          className="bg-ink/90 hover:bg-brand absolute top-3.5 right-3.5 z-2 border border-white/60 px-3 py-2 text-sm text-white"
          onClick={() => {
            if (!media.current) return;
            media.current.muted = false;
            // Persist even when unmute happens before the native volumechange event.
            saveAudioPreference({ muted: false, volume: media.current.volume });
            setAutomaticMute(false);
            void media.current.play().catch(() => {});
          }}
        >
          Enable sound
        </button>
      )}
      {failed && (
        <div className="bg-ink absolute inset-0 flex flex-col items-center justify-center gap-5 text-white">
          <p>This video couldn’t be loaded.</p>
          <button
            className="border-line hover:text-ink inline-flex items-center justify-between gap-6 border bg-transparent px-4.5 py-3.25 text-xs hover:bg-white"
            onClick={() => {
              setFailed(false);
              media.current?.load();
              void media.current?.play().catch(() => {});
            }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
