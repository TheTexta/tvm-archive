"use client";

import { useRouter } from "next/navigation";
import type { Video } from "@/lib/catalogue";
import { VideoPlayer } from "./video-player";

export function WatchPlayback({
  video,
  nextSlug,
}: {
  video: Video;
  nextSlug: string | null;
}) {
  const router = useRouter();
  return (
    <VideoPlayer
      key={video.id}
      video={video}
      autoPlay
      onEnded={nextSlug ? () => router.push(`/watch/${nextSlug}/`) : undefined}
    />
  );
}
