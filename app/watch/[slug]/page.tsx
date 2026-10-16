import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogue, durationLabel } from "@/lib/catalogue";
import { WatchPlayback } from "@/components/watch-playback";
import { VideoCard } from "@/components/archive-browser";
import { ShareButton } from "@/components/share-button";
import { Icon } from "@/components/icon";
import { RecordingContact } from "@/components/recording-contact";

export const dynamicParams = false;
export function generateStaticParams() {
  return catalogue.videos.map((v) => ({ slug: v.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const video = catalogue.videos.find((v) => v.slug === slug);
  return {
    title: video?.title || "Video not found",
    description: video?.description,
  };
}
export default async function WatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const video = catalogue.videos.find((v) => v.slug === slug);
  if (!video) notFound();
  const index = catalogue.videos.findIndex((v) => v.id === video.id);
  const nextSlug =
    catalogue.videos.length > 1
      ? catalogue.videos[(index + 1) % catalogue.videos.length].slug
      : null;
  const related = catalogue.videos
    .filter((v) => v.id !== video.id && v.category === video.category)
    .slice(0, 3);
  const dvd = catalogue.dvds.find((d) => d.slug === video.dvdSlug);
  return (
    <main
      id="main"
      className="max-tablet:px-6 max-tablet:pb-12.5 max-tablet:pt-7.5 max-xs:px-4.5 max-xs:pb-11.25 max-xs:pt-6.5 mx-auto max-w-400 px-10.5 pt-11 pb-17.5"
    >
      <div className="text-label text-muted mb-6.75 flex gap-3 [&_a:hover]:underline">
        <Link href="/#archive">The Collection</Link>
        <span>/</span>
        <span>{video.id}</span>
      </div>
      <div className="border-soft-line mb-12 border-b pb-10">
        <h1 className="max-xs:text-4xl my-3.75 text-[clamp(42px,5vw,72px)] leading-none font-medium tracking-tighter">
          {video.title}
        </h1>
      </div>
      <div className="max-tablet:grid-cols-1 max-tablet:gap-6.25 grid grid-cols-[2.2fr_1fr] gap-10">
        <div>
          <WatchPlayback video={video} nextSlug={nextSlug} />
          <p className="leading-spacious mt-5.5 mb-0 max-w-187.5 text-base">
            {video.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {video.tags.map((tag) => (
              <Link
                className="border-soft-line text-caption hover:border-brand hover:text-brand border px-2.25 py-1.5"
                href={`/?q=${encodeURIComponent(tag)}#archive`}
                key={tag}
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
        <aside className="border-soft-line max-tablet:border-l-0 max-tablet:border-t max-tablet:px-0 max-tablet:pt-6.25 border-l pl-6.25">
          <h2 className="text-label mt-0 mb-4.5 font-semibold tracking-wider">
            Details
          </h2>
          <dl className="max-tablet:grid-cols-4 max-xs:grid-cols-2 [&_dt]:text-fine [&_dt]:text-muted mb-6.75 grid grid-cols-2 gap-x-3 gap-y-4.5 [&_dd]:m-0 [&_dd]:text-xs [&_dt]:mb-1.5 [&_dt]:tracking-wider">
            <div>
              <dt>Archive ID</dt>
              <dd className="font-mono">{video.id}</dd>
            </div>
            <div>
              <dt>Year</dt>
              <dd>{video.year ?? "Undated"}</dd>
            </div>
            <div>
              <dt>Running time</dt>
              <dd>{durationLabel(video.duration) ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{dvd ? "Original DVD" : "TVM online"}</dd>
            </div>
          </dl>
          {dvd && (
            <p className="leading-spacious mt-5.5 mb-0 max-w-187.5 text-base">
              From{" "}
              <Link
                className="text-caption hover:text-brand inline-flex items-center justify-between gap-6 py-2.5 font-semibold tracking-wider"
                href={`/dvds/${dvd.slug}/`}
              >
                {dvd.label}
                <Icon name="diagonal" size={15} />
              </Link>
            </p>
          )}
          <div className="flex flex-wrap gap-2.5">
            <ShareButton />
            <a
              className="border-line hover:bg-ink inline-flex items-center justify-between gap-6 border bg-transparent px-4.5 py-3.25 text-xs hover:text-white"
              href={video.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {video.source.type === "mp4"
                ? "Open video file"
                : "Watch on YouTube"}
              <Icon name="diagonal" size={16} />
            </a>
          </div>
        </aside>
      </div>
      <RecordingContact key={video.id} video={video} dvdLabel={dvd?.label} />
      {related.length > 0 && (
        <section className="border-soft-line mt-13.75 border-t pt-6.5">
          <div className="mb-6.25 flex items-center justify-between">
            <h2 className="text-3xl font-normal tracking-tight">
              Related videos
            </h2>
            <Link
              className="text-caption hover:text-brand inline-flex items-center justify-between gap-6 py-2.5 font-semibold tracking-wider"
              href="/#archive"
            >
              All videos <Icon name="arrow" />
            </Link>
          </div>
          <div className="max-wide:grid-cols-2 max-tablet:gap-x-4.5 max-tablet:gap-y-7 max-xs:gap-x-3 max-xs:gap-y-6 grid grid-cols-3 gap-x-5 gap-y-6.75">
            {related.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
