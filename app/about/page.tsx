import type { Metadata } from "next";
import Link from "next/link";
import { catalogue } from "@/lib/catalogue";
import { Icon } from "@/components/icon";
export const metadata: Metadata = { title: "About the archive" };
export default function About() {
  return (
    <main
      id="main"
      className="max-tablet:px-6 max-tablet:pb-12.5 max-tablet:pt-7.5 max-xs:px-4.5 max-xs:pb-11.25 max-xs:pt-6.5 mx-auto max-w-400 px-10.5 pt-11 pb-17.5"
    >
      <div className="border-soft-line mb-12 border-b pb-10">
        <h1 className="max-xs:text-4xl my-3.75 text-[clamp(42px,5vw,72px)] leading-none font-medium tracking-tighter">
          About
        </h1>
      </div>
      <div className="max-tablet:grid-cols-1 max-tablet:gap-7.5 grid grid-cols-2 gap-17.5">
        <div className="[&_p]:mt-0 [&_p]:mb-5 [&_p]:text-base [&_p]:leading-loose">
          <p>
            TVM is student television at McGill. Its recordings include films,
            events, and campus coverage. Many were kept on DVDs.
          </p>
          <p>
            Original disc labels and backups are retained. Some dates and
            credits remain unknown; demo excerpts are marked. Each recording
            links to its source disc.
          </p>
          <Link
            href="/#archive"
            className="text-caption hover:text-brand inline-flex items-center justify-between gap-6 py-2.5 font-semibold tracking-wider"
          >
            The Collection <Icon name="arrow" />
          </Link>
        </div>
        <aside className="border-soft-line [&>p]:leading-spacious [&>p]:text-copy border-t pt-8 [&>p]:text-sm">
          <h2 className="mt-0 mb-5 text-2xl font-normal">Collection status</h2>
          <p>
            {catalogue.videos.length} videos and {catalogue.dvds.length} DVDs
            indexed. Approximately 60–100 DVDs remain to be catalogued.
          </p>
          <hr className="border-soft-line my-6.25 border-t" />
          <h2 className="my-5 text-2xl font-normal">Corrections and credits</h2>
          <a
            className="text-caption hover:text-brand inline-flex items-center justify-between gap-6 py-2.5 font-semibold tracking-wider"
            href="mailto:hello@tvmtelevision.com"
          >
            Email TVM <Icon name="diagonal" />
          </a>
        </aside>
      </div>
    </main>
  );
}
