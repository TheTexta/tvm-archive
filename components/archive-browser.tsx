"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { motion } from "motion/react";
import { durationLabel, type Video } from "@/lib/catalogue";
import {
  defaultFilters,
  filterSearch,
  queryVideos,
  readFilters,
  type Filters,
} from "@/lib/archive-query";
import { Icon } from "./icon";

const MotionLink = motion.create(Link);
const interactionVariants = { rest: {}, hover: {} };
const iconVariants = {
  rest: { opacity: 0 },
  hover: { opacity: 1 },
};

const filterFieldsetClass =
  "mb-3.5 min-w-0 border-b border-soft-line px-0 pb-3";
const filterLabelClass = "mb-2 block text-sm font-semibold tracking-wider";
const filterSelectClass =
  "w-full border border-soft-line bg-transparent px-1.75 py-1.5 text-base";
const checkboxClass =
  "flex cursor-pointer items-center gap-2.25 py-1 text-base max-tablet:py-1.5 [&_input]:m-0 [&_input]:size-4 [&_input]:cursor-pointer [&_input]:accent-brand [&_small]:ml-auto [&_small]:font-mono [&_small]:text-sm [&_small]:text-muted";

export function VideoCard({
  video,
  onPlay,
}: {
  video: Video;
  onPlay?: (v: Video) => void;
}) {
  const [preview, setPreview] = useState(false);
  const mediaProps = {
    onPointerEnter: (event: React.PointerEvent) => {
      if (
        event.pointerType !== "touch" &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        setPreview(true);
    },
    onPointerLeave: () => setPreview(false),
  };
  const media = (
    <>
      <Image
        src={video.poster}
        alt={`Still from ${video.title}`}
        fill
        sizes="(max-width: 600px) 100vw, (max-width: 1000px) 45vw, 25vw"
        className="object-cover"
      />
      {preview && video.source.type === "mp4" && (
        <video
          className="pointer-events-none absolute inset-0 size-full object-cover"
          src={video.source.url}
          muted
          autoPlay
          loop
          playsInline
          preload="none"
          aria-hidden="true"
        />
      )}
      {video.duration !== null && (
        <span
          className="bg-ink/70 text-fine max-xs:bottom-1.5 max-xs:right-1.5 max-xs:px-1 max-xs:py-0.75 max-xs:text-micro absolute right-2.25 bottom-2.25 px-1.5 py-1 font-mono text-white"
          aria-hidden="true"
        >
          {durationLabel(video.duration)}
        </span>
      )}
    </>
  );
  return (
    <article className="min-w-0">
      {onPlay ? (
        <motion.button
          className="bg-card relative block aspect-8/5 w-full overflow-hidden border-0 p-0"
          onClick={() => onPlay(video)}
          aria-label={`Play ${video.title}${video.duration !== null ? ` · ${durationLabel(video.duration)}` : ""}`}
          {...mediaProps}
          initial="rest"
          animate="rest"
          whileHover="hover"
          whileFocus="hover"
          variants={interactionVariants}
        >
          {media}
        </motion.button>
      ) : (
        <MotionLink
          className="bg-card relative block aspect-8/5 w-full overflow-hidden border-0 p-0"
          href={`/watch/${video.slug}/`}
          aria-label={`Watch ${video.title}${video.duration !== null ? ` · ${durationLabel(video.duration)}` : ""}`}
          {...mediaProps}
          initial="rest"
          animate="rest"
          whileHover="hover"
          whileFocus="hover"
          variants={interactionVariants}
        >
          {media}
        </MotionLink>
      )}
      <div className="min-w-0">
        <div className="text-fine text-muted max-xs:gap-1 max-xs:text-micro mt-3 mb-1.5 flex justify-between gap-2.5">
          <span>{video.category}</span>
          <span>{video.year ?? "Undated"}</span>
        </div>
        <MotionLink
          className="hover:text-brand max-xs:min-h-9.5 max-xs:text-sm flex min-h-10.5 items-start justify-between gap-2.25 text-base leading-tight font-medium tracking-tight"
          href={`/watch/${video.slug}/`}
          initial="rest"
          animate="rest"
          whileHover="hover"
          whileFocus="hover"
          variants={interactionVariants}
        >
          {video.title}
          <motion.span className="max-xs:hidden mt-0.5" variants={iconVariants}>
            <Icon name="diagonal" size={17} />
          </motion.span>
        </MotionLink>
        <div className="border-soft-line text-micro text-muted [&_.mono]:text-micro max-xs:gap-0.75 max-xs:text-micro max-xs:[&_.mono]:text-micro mt-1.75 flex justify-between gap-2 border-t pt-2 tracking-wide">
          <span className="font-mono">{video.id}</span>
        </div>
      </div>
    </article>
  );
}

export function ArchiveBrowser({
  videos,
  onPlay,
}: {
  videos: Video[];
  onPlay?: (v: Video) => void;
}) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [limit, setLimit] = useState(12);
  const [open, setOpen] = useState(false);
  const deferredQuery = useDeferredValue(filters.q);
  useEffect(() => {
    const restore = () => {
      setFilters(readFilters(window.location.search));
      setLimit(12);
    };
    const frame = requestAnimationFrame(restore);
    window.addEventListener("popstate", restore);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("popstate", restore);
    };
  }, []);
  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setLimit(12);
    const query = filterSearch(next);
    const url =
      window.location.pathname +
      (query ? `?${query}` : "") +
      window.location.hash;
    // Retain Next's history state so client navigation and browser Back both work.
    window.history.pushState(window.history.state, "", url);
  }
  const results = queryVideos(videos, { ...filters, q: deferredQuery });
  const allCategories = Array.from(
    new Set(videos.map((v) => v.category)),
  ).sort();
  const years = Array.from(
    new Set(videos.flatMap((v) => (v.year === null ? [] : [v.year]))),
  ).sort((a, b) => b - a);
  const active = !!(
    filters.q ||
    filters.year ||
    filters.categories.length ||
    filters.source ||
    filters.dvd
  );
  return (
    <section
      id="archive"
      className="max-tablet:px-6 max-tablet:py-11 max-xs:px-4.5 max-xs:py-8.75 scroll-mt-5 px-10.5 pt-15.75 pb-13.75"
      aria-labelledby="browse-title"
    >
      <div className="max-xs:gap-3.75 mb-6.25 flex items-end justify-between">
        <h2
          id="browse-title"
          className="max-tablet:text-4xl max-xs:text-3xl m-0 text-[clamp(28px,3vw,44px)] leading-none font-medium tracking-tighter"
        >
          The Collection
        </h2>
        <span className="max-xs:text-base shrink-0 text-xl">
          {videos.length} {videos.length === 1 ? "Video" : "Videos"}
        </span>
      </div>
      <form
        className="border-line focus-within:shadow-focus max-tablet:mb-5 max-xs:min-h-14 max-xs:gap-2.5 max-xs:px-3.25 mb-7 flex min-h-16.25 items-center gap-4.25 border px-5"
        role="search"
        onSubmit={(e) => e.preventDefault()}
      >
        <Icon name="search" size={24} />
        <label className="sr-only" htmlFor="archive-search">
          Search the archive
        </label>
        <input
          className="placeholder:text-placeholder max-xs:h-13 max-xs:text-base h-15 w-full min-w-0 border-0 bg-transparent text-xl tracking-tight outline-offset-0 focus-visible:outline-none"
          id="archive-search"
          type="search"
          placeholder="Search videos"
          value={filters.q}
          onChange={(e) => update({ q: e.target.value })}
        />
      </form>
      <div className="max-wide:grid-cols-[205px_1fr] max-tablet:grid-cols-1 max-tablet:gap-5 grid grid-cols-[220px_1fr] gap-6">
        <aside className="border-soft-line max-tablet:border-0 max-tablet:p-0 border-r pr-4.5">
          <button
            className="border-soft-line max-tablet:flex hidden w-full items-center justify-start gap-3 border bg-transparent px-3 py-2.25 text-base [&_svg:last-child]:ml-auto"
            aria-expanded={open}
            aria-controls="filter-fields"
            onClick={() => setOpen(!open)}
          >
            <Icon name="filter" size={18} /> Filter the archive{" "}
            <Icon name="chevron" size={16} />
          </button>
          <div
            id="filter-fields"
            className={`${open ? "max-tablet:block" : "max-tablet:hidden"} max-tablet:border-x max-tablet:border-b max-tablet:border-soft-line max-tablet:p-3.5`}
          >
            <fieldset className={filterFieldsetClass}>
              <legend className={filterLabelClass}>Category</legend>
              {allCategories.map((category) => (
                <label className={checkboxClass} key={category}>
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(category)}
                    onChange={() =>
                      update({
                        categories: filters.categories.includes(category)
                          ? filters.categories.filter((c) => c !== category)
                          : [...filters.categories, category],
                      })
                    }
                  />
                  <span>{category}</span>
                  <small>
                    {videos.filter((v) => v.category === category).length}
                  </small>
                </label>
              ))}
            </fieldset>
            <div className="mb-3.5">
              <label className={filterLabelClass} htmlFor="year-filter">
                Year
              </label>
              <select
                className={filterSelectClass}
                id="year-filter"
                value={filters.year}
                onChange={(e) => update({ year: e.target.value })}
              >
                <option value="">All years</option>
                {years.map((y) => (
                  <option value={y} key={y}>
                    {y}
                  </option>
                ))}
                <option value="unknown">Undated</option>
              </select>
            </div>
            <fieldset className={filterFieldsetClass}>
              <legend className={filterLabelClass}>Source</legend>
              {[
                ["", "All videos"],
                ["dvd", "DVD collection"],
                ["online", "TVM online"],
              ].map(([value, label]) => (
                <label className={checkboxClass} key={value}>
                  <input
                    type="radio"
                    name="source"
                    value={value}
                    checked={filters.source === value}
                    onChange={() => update({ source: value })}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
          </div>
        </aside>
        <div className="min-w-0">
          <div className="max-xs:flex-wrap max-xs:gap-2.5 max-xs:px-0 max-xs:pb-3 max-xs:pt-1 mb-6 flex min-h-12.25 items-center justify-between gap-3.75">
            {active && results.length > 0 && (
              <span
                className="text-label max-xs:text-caption"
                aria-live="polite"
              >
                {results.length} {results.length === 1 ? "result" : "results"}
              </span>
            )}
            <div className="max-xs:gap-1.25 ml-auto flex items-center gap-2.5">
              <label
                className="text-micro text-muted max-xs:hidden tracking-wider"
                htmlFor="sort"
              >
                Sort by
              </label>
              <select
                className="text-caption max-xs:max-w-28.25 max-xs:pr-0 max-xs:text-fine border-0 bg-transparent pr-1.75"
                id="sort"
                aria-label="Sort by"
                value={filters.sort}
                onChange={(e) => update({ sort: e.target.value })}
              >
                <option value="added">Recently added</option>
                <option value="oldest">Oldest first</option>
                <option value="newest">Newest first</option>
                <option value="title">Title A–Z</option>
              </select>
            </div>
          </div>
          {active && (
            <div className="-mt-2 mb-5 flex justify-end">
              <button
                className="text-brand flex items-center gap-1.75 border-0 bg-transparent p-0"
                onClick={() => update(defaultFilters)}
              >
                Clear filters <Icon name="close" size={13} />
              </button>
            </div>
          )}
          {results.length ? (
            <div className="max-wide:grid-cols-2 max-tablet:gap-x-4.5 max-tablet:gap-y-7 max-xs:gap-x-3 max-xs:gap-y-6 grid grid-cols-3 gap-x-5 gap-y-6.75">
              {results.slice(0, limit).map((video) => (
                <VideoCard key={video.id} video={video} onPlay={onPlay} />
              ))}
            </div>
          ) : (
            <div
              className="border-soft-line flex flex-col items-center gap-3.5 border px-5 py-16.25 text-center [&_h3]:m-0 [&_h3]:text-3xl [&_h3]:font-normal [&_h3]:tracking-tighter"
              role="status"
            >
              <h3>{active ? "No results" : "No videos available"}</h3>
            </div>
          )}
          {limit < results.length && (
            <button
              className="border-line text-caption hover:bg-ink [&>span]:text-caption [&>span]:text-muted mt-8.25 flex min-h-13.5 w-full items-center justify-between gap-3.75 border bg-transparent px-5 font-semibold hover:text-white [&>span]:ml-auto [&>span]:font-normal"
              onClick={() => setLimit(limit + 12)}
            >
              Show more videos <span>{results.length - limit} remaining</span>
              <Icon name="arrow" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
