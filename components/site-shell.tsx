"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "./icon";
import { useMotionScroll } from "./motion-provider";

export function Header() {
  const path = usePathname();
  const router = useRouter();
  const scrollTo = useMotionScroll();
  const isHome = path === "/";
  function shuffle() {
    if (isHome) {
      window.dispatchEvent(new Event("tvm:shuffle"));
      scrollTo(document.getElementById("featured"));
    } else router.push("/");
  }
  return (
    <header
      className={`max-tablet:px-6 max-xs:h-17 max-xs:gap-2 max-xs:px-4 inset-x-0 top-0 z-30 flex h-20 items-center justify-between gap-4 bg-transparent px-8 ${isHome ? "absolute" : "relative"}`}
    >
      <Link
        href="/"
        aria-label="TVM Archive home"
        className="max-xs:text-base shrink-0 text-xl leading-none font-normal tracking-tight text-black hover:text-brand"
      >
        TVM Archive
      </Link>
      <nav
        className="max-tablet:gap-5 max-xs:gap-3 max-xs:text-xs flex items-center gap-7 text-base"
        aria-label="Main navigation"
      >
        {isHome ? (
          <a href="#archive" className="hover:text-brand">
            Archive
          </a>
        ) : (
          <Link href="/#archive" className="hover:text-brand">
            Archive
          </Link>
        )}
        <Link
          href="/dvds/"
          className={`${path?.startsWith("/dvds") ? "text-brand" : ""} hover:text-brand`}
        >
          DVDs
        </Link>
        <Link
          href="/about/"
          className={`${path?.startsWith("/about") ? "text-brand" : ""} hover:text-brand`}
        >
          About
        </Link>
        <button
          className="text-brand hover:text-ink flex items-center gap-2"
          aria-label={isHome ? "Pick another video" : "Watch a random video"}
          onClick={shuffle}
        >
          <Icon name="shuffle" size={19} />
          <span className="max-tablet:hidden">
            {isHome ? "Pick another" : "Random video"}
          </span>
        </button>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-soft-line min-canvas:px-[calc((100vw-1600px)/2)] max-tablet:px-6 max-xs:px-4.5 flex flex-wrap items-center justify-between gap-5 border-t px-10.5 py-8 text-sm">
      <span>Student television at McGill</span>
      <nav
        className="[&_a:hover]:text-brand flex flex-wrap gap-x-5 gap-y-2"
        aria-label="Footer navigation"
      >
        <a
          href="https://www.tvmtelevision.com/"
          target="_blank"
          rel="noreferrer"
        >
          TVM website
        </a>
        <a href="https://dextery.dev/admin">Admin</a>
        <a href="mailto:hello@tvmtelevision.com">Email TVM</a>
      </nav>
    </footer>
  );
}
