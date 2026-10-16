"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Video } from "@/lib/catalogue";
import {
  attemptAutoplay,
  readAudioPreference,
  saveAudioPreference,
} from "@/lib/playback";
import { VideoPlayer } from "./video-player";

const TVScene = dynamic(() => import("./tv-scene"), { ssr: false });

function timeLabel(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function TelevisionPlayer({
  video,
  autoPlay,
  onEnded,
}: {
  video: Video;
  autoPlay: boolean;
  onEnded: () => void;
}) {
  const media = useRef<HTMLVideoElement | null>(null);
  const [element, setElement] = useState<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [nativePlayer, setNativePlayer] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => setNativePlayer(true), []);
  const attachMedia = useCallback((node: HTMLVideoElement | null) => {
    media.current = node;
    setElement(node);
  }, []);

  useEffect(() => {
    const current = media.current;
    if (!current || video.source.type !== "mp4") return;
    let active = true;
    let expected = readAudioPreference();
    current.muted = expected.muted;
    current.volume = expected.volume;

    const onVolume = () => {
      if (
        current.muted === expected.muted &&
        current.volume === expected.volume
      )
        return;
      expected = { muted: current.muted, volume: current.volume };
      saveAudioPreference(expected);
    };
    const onTime = () => setTime(current.currentTime);
    const onMetadata = () => setDuration(current.duration);
    current.addEventListener("volumechange", onVolume);
    current.addEventListener("timeupdate", onTime);
    current.addEventListener("loadedmetadata", onMetadata);

    if (autoPlay)
      void attemptAutoplay(
        current,
        () => {
          expected = { ...expected, muted: true };
        },
        () => active,
      ).then((started) => {
        if (active && !started) setNativePlayer(true);
      });

    return () => {
      active = false;
      current.pause();
      current.removeEventListener("volumechange", onVolume);
      current.removeEventListener("timeupdate", onTime);
      current.removeEventListener("loadedmetadata", onMetadata);
    };
  }, [element, autoPlay, video.source]);

  if (video.source.type === "youtube" || nativePlayer)
    return (
      <div className="flex size-full items-center justify-center bg-[#f8f8f6] px-5 pt-30 pb-40">
        <div className="w-full max-w-4xl">
          <VideoPlayer
            video={video}
            autoPlay={autoPlay}
            onEnded={onEnded}
            showEnableSound={false}
          />
        </div>
      </div>
    );

  return (
    <div className="tv-stage text-ink relative isolate size-full overflow-hidden bg-[#f8f8f6]">
      <div className="tv-stage-glow absolute inset-0" aria-hidden="true" />
      {!ready && (
        <Image
          src={video.poster}
          alt=""
          fill
          className="tv-stage-poster object-cover opacity-10 blur-2xl"
          sizes="100vw"
          loading="eager"
        />
      )}
      <video
        ref={attachMedia}
        crossOrigin="anonymous"
        src={video.source.url}
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
        className="pointer-events-none absolute size-px opacity-0"
        onError={() => setNativePlayer(true)}
        onEnded={onEnded}
      >
        {video.source.captions && (
          <track
            src={video.source.captions}
            kind="captions"
            srcLang="en"
            label="English"
          />
        )}
      </video>
      {element && (
        <TVScene video={element} onReady={onReady} onError={onError} />
      )}
      <div className="tv-seek-bar max-tablet:w-40 max-xs:right-4 max-xs:bottom-33 max-xs:w-32 absolute right-10.5 bottom-35 z-20 w-[min(360px,calc(100%-2rem))] text-xs">
        {!ready && <span role="status">Loading video</span>}
        <div className="flex items-center gap-3">
          <label className="sr-only" htmlFor="tv-seek">
            Seek through {video.title}
          </label>
          <input
            id="tv-seek"
            type="range"
            min="0"
            max={duration || 1}
            step="0.1"
            value={Math.min(time, duration || 1)}
            onChange={(event) => {
              if (media.current)
                media.current.currentTime = Number(event.target.value);
            }}
            className="tv-seek accent-brand min-w-0 flex-1"
          />
          <span className="shrink-0 text-[10px] tabular-nums">
            {timeLabel(time)} / {timeLabel(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
