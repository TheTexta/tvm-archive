"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type Video } from "@/lib/catalogue";
import { TelevisionPlayer } from "./television-player";
import { ArchiveBrowser } from "./archive-browser";
import { Icon } from "./icon";
import { useMotionScroll } from "./motion-provider";

export function ArchiveHome({
  videos,
}: {
  videos: Video[];
}) {
  const [featured, setFeatured] = useState<Video | null>(videos[0] ?? null);
  const [ready, setReady] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [playbackKey, setPlaybackKey] = useState(0);
  const scrollTo = useMotionScroll();
  useEffect(() => {
    function choose(excludeCurrent: boolean) {
      setFeatured((previous) => {
        const pool = excludeCurrent
          ? videos.filter((v) => v.id !== previous?.id)
          : videos;
        return pool.length
          ? pool[Math.floor(Math.random() * pool.length)]
          : (videos[0] ?? null);
      });
      setReady(true);
      setAutoplay(true);
      setPlaybackKey((key) => key + 1);
    }
    const pick = () => choose(true);
    const frame = requestAnimationFrame(() => choose(false));
    window.addEventListener("tvm:shuffle", pick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("tvm:shuffle", pick);
    };
  }, [videos]);
  function select(video: Video) {
    setFeatured(video);
    setReady(true);
    setAutoplay(true);
    setPlaybackKey((key) => key + 1);
    scrollTo(document.getElementById("featured"));
  }
  function playNext() {
    if (videos.length < 2) return;
    setFeatured((previous) => {
      const index = videos.findIndex((video) => video.id === previous?.id);
      return videos[(index + 1) % videos.length];
    });
    setAutoplay(true);
    setPlaybackKey((key) => key + 1);
  }
  return (
    <main id="main" className="w-full">
      <section
        className="tv-hero bg-paper relative isolate w-full overflow-hidden"
        id="featured"
        aria-label="Featured archive video"
      >
        {featured ? (
          <TelevisionPlayer
            key={`${featured.id}-${playbackKey}`}
            video={featured}
            autoPlay={ready && autoplay}
            onEnded={playNext}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-sm">
            No videos available.
          </div>
        )}
        <h1 className="sr-only">TVM Archive</h1>
        {featured && (
          <div className="tv-hero-info max-tablet:px-6 max-xs:bottom-26 max-xs:px-4.5 pointer-events-none absolute inset-x-0 bottom-28 z-10 flex items-end justify-between gap-6 px-10.5">
            <div className="max-xs:max-w-47 max-w-72">
              <p className="text-muted max-xs:text-[9px] mb-2 text-[10px] font-semibold tracking-wide">
                {featured.category} / {featured.year ?? "Undated"}
              </p>
              <h2 className="max-xs:text-lg pointer-events-auto m-0 text-[clamp(20px,2.7vw,34px)] leading-tight font-medium tracking-tight select-text">
                {featured.title}
              </h2>
              <Link
                href={`/watch/${featured.slug}/`}
                className="hover:text-brand max-xs:text-[11px] pointer-events-auto mt-2 inline-flex items-center gap-2 text-xs underline underline-offset-4"
              >
                Video details <Icon name="diagonal" size={14} />
              </Link>
            </div>
            <div className="max-tablet:translate-y-10 max-xs:text-xs pointer-events-auto flex flex-col items-end gap-2.5 text-sm">
              <button
                onClick={() => window.dispatchEvent(new Event("tvm:shuffle"))}
                className="hover:text-brand min-tablet:hidden inline-flex items-center gap-2 font-semibold"
              >
                <Icon name="shuffle" size={18} /> Pick another
              </button>
              <a href="#archive" className="hover:text-brand">
                Collection ↓
              </a>
            </div>
          </div>
        )}
      </section>
      <div className="mx-auto max-w-400">
        <ArchiveBrowser videos={videos} onPlay={select} />
      </div>
    </main>
  );
}
