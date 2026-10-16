import type { Video } from "./catalogue";

export type Filters = {
  q: string;
  year: string;
  categories: string[];
  source: string;
  dvd: string;
  sort: string;
};
export const defaultFilters: Filters = {
  q: "",
  year: "",
  categories: [],
  source: "",
  dvd: "",
  sort: "added",
};
export function readFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  return {
    q: p.get("q") || "",
    year: p.get("year") || "",
    categories: p.getAll("category"),
    source: ["dvd", "online"].includes(p.get("source") || "")
      ? p.get("source")!
      : "",
    dvd: p.get("dvd") || "",
    sort: ["added", "title", "oldest", "newest"].includes(p.get("sort") || "")
      ? p.get("sort")!
      : "added",
  };
}
export function filterSearch(filters: Filters): string {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.year) p.set("year", filters.year);
  filters.categories.forEach((c) => p.append("category", c));
  if (filters.source) p.set("source", filters.source);
  if (filters.dvd) p.set("dvd", filters.dvd);
  if (filters.sort !== "added") p.set("sort", filters.sort);
  return p.toString();
}
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function queryVideos(videos: Video[], filters: Filters): Video[] {
  const words = normalize(filters.q).trim().split(/\s+/).filter(Boolean);
  return videos
    .filter((v) => {
      const text = normalize(
        [
          v.title,
          v.description,
          v.category,
          ...v.tags,
          v.id,
          v.dvdSlug || "",
        ].join(" "),
      );
      return (
        words.every((w) => text.includes(w)) &&
        (!filters.year ||
          (filters.year === "unknown"
            ? v.year === null
            : String(v.year) === filters.year)) &&
        (!filters.categories.length ||
          filters.categories.includes(v.category)) &&
        (!filters.source ||
          (filters.source === "dvd" ? !!v.dvdSlug : !v.dvdSlug)) &&
        (!filters.dvd || v.dvdSlug === filters.dvd)
      );
    })
    .sort((a, b) => {
      if (filters.sort === "title") return a.title.localeCompare(b.title);
      if (filters.sort === "oldest" || filters.sort === "newest") {
        if (a.year === null)
          return b.year === null ? a.title.localeCompare(b.title) : 1;
        if (b.year === null) return -1;
        return filters.sort === "oldest" ? a.year - b.year : b.year - a.year;
      }
      return b.addedAt.localeCompare(a.addedAt);
    });
}
