import snapshot from "@/data/catalogue.json";

export type Video = {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  category: string;
  description: string;
  tags: string[];
  dvdSlug: string | null;
  duration: number | null;
  poster: string;
  source:
    | { type: "youtube"; id: string }
    | { type: "mp4"; url: string; captions?: string };
  sourceUrl: string;
  addedAt: string;
};
export type DVD = {
  slug: string;
  label: string;
  year: number | null;
  notes: string;
  cover: string | null;
};
export type Catalogue = { revision: string; videos: Video[]; dvds: DVD[] };
export const catalogue = snapshot as Catalogue;
export const categories = [
  "Campus life",
  "Short films",
  "Arts & culture",
  "Comedy",
  "Events",
];
export function durationLabel(seconds: number | null) {
  if (seconds === null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
