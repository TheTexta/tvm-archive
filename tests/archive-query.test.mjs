import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  defaultFilters,
  queryVideos,
  filterSearch,
  readFilters,
} from "../lib/archive-query.ts";
import { validateCatalogue } from "../scripts/catalogue.mjs";
const catalogue = JSON.parse(
  await readFile(new URL("../data/catalogue.json", import.meta.url), "utf8"),
);

test("DVD-only search excludes online recordings and unknown dates stay explicitly filterable", () => {
  const records = queryVideos(catalogue.videos, {
    ...defaultFilters,
    source: "dvd",
    year: "unknown",
  });
  assert.ok(records.length > 0);
  assert.ok(records.every((v) => v.dvdSlug && v.year === null));
});
test("search finds source-disc labels and ignores accents and case", () => {
  const records = queryVideos(catalogue.videos, {
    ...defaultFilters,
    q: "GOLDEN nominations",
  });
  assert.equal(records.length, 1);
  assert.equal(records[0].slug, "golden-tape-2008");
  const custom = [{ ...catalogue.videos[0], title: "Montréal on screen" }];
  assert.equal(
    queryVideos(custom, { ...defaultFilters, q: "montreal" }).length,
    1,
  );
});
test("chronological sorting places unknown dates after known dates in either direction", () => {
  for (const sort of ["oldest", "newest"]) {
    const records = queryVideos(catalogue.videos, { ...defaultFilters, sort });
    const firstUnknown = records.findIndex((v) => v.year === null);
    assert.ok(firstUnknown > 0);
    assert.ok(records.slice(firstUnknown).every((v) => v.year === null));
    const years = records.slice(0, firstUnknown).map((v) => v.year);
    assert.deepEqual(
      years,
      [...years].sort((a, b) => (sort === "oldest" ? a - b : b - a)),
    );
  }
});
test("shareable URL round-trips category combinations and disc selection", () => {
  const filters = {
    ...defaultFilters,
    q: "Golden Tape",
    categories: ["Events", "Campus life"],
    dvd: "golden-tape-2008",
    source: "dvd",
    year: "2008",
    sort: "oldest",
  };
  assert.deepEqual(readFilters("?" + filterSearch(filters)), filters);
});
test("removed layout URLs and invalid control values fall back to supported defaults", () => {
  const filters = readFilters("?view=list&sort=invalid&source=other");
  assert.ok(!("view" in filters));
  assert.equal(filters.sort, "added");
  assert.equal(filters.source, "");
});
test("public catalogue strips private staging fields and rejects unsafe playback URLs", () => {
  const input = structuredClone(catalogue);
  input.videos[0].playback_key = "private/staging";
  input.videos[0].internal_notes = "private";
  const result = validateCatalogue(input);
  assert.ok(!("playback_key" in result.videos[0]));
  assert.ok(!("internal_notes" in result.videos[0]));
  input.videos[0].source = { type: "mp4", url: "javascript:alert(1)" };
  assert.throws(() => validateCatalogue(input), /Invalid playback/);
});
test("missing source discs and duplicate stable URLs fail before static generation", () => {
  const input = structuredClone(catalogue);
  input.videos[0].dvdSlug = "missing";
  assert.throws(() => validateCatalogue(input), /Missing source DVD/);
  const other = structuredClone(catalogue);
  other.videos[1].slug = other.videos[0].slug;
  assert.throws(() => validateCatalogue(other), /duplicate video/);
});
