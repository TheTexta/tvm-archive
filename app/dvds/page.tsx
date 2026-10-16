import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { catalogue } from "@/lib/catalogue";
import { Icon } from "@/components/icon";
export const metadata: Metadata = { title: "DVD collection" };
export default function DVDs() {
  return (
    <main
      id="main"
      className="max-tablet:px-6 max-tablet:pb-12.5 max-tablet:pt-7.5 max-xs:px-4.5 max-xs:pb-11.25 max-xs:pt-6.5 mx-auto max-w-400 px-10.5 pt-11 pb-17.5"
    >
      <div className="border-soft-line mb-12 border-b pb-10">
        <h1 className="max-xs:text-4xl my-3.75 text-[clamp(42px,5vw,72px)] leading-none font-medium tracking-tighter">
          DVD Collection
        </h1>
      </div>
      {catalogue.dvds.length ? (
        <div className="max-wide:grid-cols-3 max-tablet:grid-cols-2 max-xs:gap-x-3 max-xs:gap-y-5 grid grid-cols-4 gap-x-6 gap-y-7">
          {catalogue.dvds.map((dvd) => (
            <Link
              key={dvd.slug}
              className="border-soft-line hover:border-brand block border"
              href={`/dvds/${dvd.slug}/`}
            >
              <div className="bg-disc shadow-disc relative grid aspect-square place-items-center p-6.5">
                {dvd.cover ? (
                  <Image
                    src={dvd.cover}
                    alt={`Still from ${dvd.label}`}
                    fill
                    sizes="(max-width: 800px) 50vw, 25vw"
                    className="object-cover"
                  />
                ) : (
                  <Icon name="disc" size={100} />
                )}
              </div>
              <div className="border-soft-line max-xs:p-3 border-t p-4">
                <h2 className="max-xs:text-base mt-0 mb-3 text-lg leading-tight font-medium tracking-tight">
                  {dvd.label}
                </h2>
                <footer className="text-caption flex justify-between">
                  <span>
                    {dvd.year ?? "Undated"} ·{" "}
                    {
                      catalogue.videos.filter((v) => v.dvdSlug === dvd.slug)
                        .length
                    }{" "}
                    recording
                  </span>
                  <Icon name="diagonal" size={15} />
                </footer>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border-soft-line [&_p]:text-muted flex flex-col items-center gap-3.5 border px-5 py-16.25 text-center [&_h3]:m-0 [&_h3]:text-3xl [&_h3]:font-normal [&_h3]:tracking-tighter [&_p]:m-0 [&_p]:max-w-120 [&_p]:text-sm [&_p]:leading-relaxed">
          <h3>No DVDs indexed</h3>
          <Link
            className="border-line hover:bg-ink inline-flex items-center justify-between gap-6 border bg-transparent px-4.5 py-3.25 text-xs hover:text-white"
            href="/#archive"
          >
            Videos <Icon name="arrow" />
          </Link>
        </div>
      )}
    </main>
  );
}
