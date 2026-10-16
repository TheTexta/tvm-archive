import Link from "next/link";
import { Icon } from "@/components/icon";
export default function NotFound() {
  return (
    <main
      id="main"
      className="max-tablet:px-6 max-tablet:pb-12.5 max-tablet:pt-7.5 max-xs:px-4.5 max-xs:pb-11.25 max-xs:pt-6.5 mx-auto max-w-400 px-10.5 pt-11 pb-17.5"
    >
      <div className="border-soft-line mb-12 border-b pb-10">
        <h1 className="max-xs:text-4xl my-3.75 text-[clamp(42px,5vw,72px)] leading-none font-medium tracking-tighter">
          Page not found
        </h1>
      </div>
      <Link
        className="border-line hover:bg-ink inline-flex items-center justify-between gap-6 border bg-transparent px-4.5 py-3.25 text-xs hover:text-white"
        href="/#archive"
      >
        The Collection <Icon name="arrow" />
      </Link>
    </main>
  );
}
