import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogue } from "@/lib/catalogue";
import { VideoCard } from "@/components/archive-browser";
export const dynamicParams = false;
export function generateStaticParams() {
  return catalogue.dvds.map((d) => ({ slug: d.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title:
      catalogue.dvds.find((d) => d.slug === slug)?.label ?? "DVD not found",
  };
}
export default async function DVDPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dvd = catalogue.dvds.find((d) => d.slug === slug);
  if (!dvd) notFound();
  const videos = catalogue.videos.filter((v) => v.dvdSlug === slug);
  return (
    <main
      id="main"
      className="max-tablet:px-6 max-tablet:pb-12.5 max-tablet:pt-7.5 max-xs:px-4.5 max-xs:pb-11.25 max-xs:pt-6.5 mx-auto max-w-400 px-10.5 pt-11 pb-17.5"
    >
      <div className="text-label text-muted mb-6.75 flex gap-3 [&_a:hover]:underline">
        <Link href="/dvds/">DVD Collection</Link>
        <span>/</span>
        <span>{dvd.year ?? "Undated"}</span>
      </div>
      <div className="border-soft-line mb-12 border-b pb-10">
        <h1 className="max-xs:text-4xl my-3.75 text-[clamp(42px,5vw,72px)] leading-none font-medium tracking-tighter">
          {dvd.label}
        </h1>
        <p className="leading-copy text-copy max-xs:text-sm mt-2.5 mb-0 max-w-167.5 text-base">
          {dvd.notes}
        </p>
      </div>
      <div className="max-wide:grid-cols-2 max-tablet:gap-x-4.5 max-tablet:gap-y-7 max-xs:gap-x-3 max-xs:gap-y-6 grid grid-cols-3 gap-x-5 gap-y-6.75">
        {videos.map((v) => (
          <VideoCard key={v.id} video={v} />
        ))}
      </div>
    </main>
  );
}
