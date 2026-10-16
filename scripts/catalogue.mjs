import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { readFile, writeFile, mkdir } from "node:fs/promises";
loadEnvConfig(process.cwd());
const publicVideoFields = [
  "id",
  "slug",
  "title",
  "year",
  "category",
  "description",
  "tags",
  "dvdSlug",
  "duration",
  "poster",
  "source",
  "sourceUrl",
  "addedAt",
];
const publicDVDFields = ["slug", "label", "year", "notes", "cover"];
const pick = (object, fields) =>
  Object.fromEntries(fields.map((key) => [key, object[key]]));
const safeURL = (s) =>
  typeof s === "string" && (/^https:\/\//.test(s) || /^\/(?!\/)/.test(s));
export function validateCatalogue(input) {
  if (
    !input ||
    typeof input.revision !== "string" ||
    !Array.isArray(input.videos) ||
    !Array.isArray(input.dvds)
  )
    throw new Error("Invalid catalogue snapshot.");
  const result = {
    revision: input.revision,
    videos: input.videos.map((v) => pick(v, publicVideoFields)),
    dvds: input.dvds.map((d) => pick(d, publicDVDFields)),
  };
  const slugs = new Set(),
    ids = new Set(),
    discs = new Set();
  const slugOK = (s) =>
    typeof s === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
  for (const d of result.dvds) {
    if (
      !slugOK(d.slug) ||
      discs.has(d.slug) ||
      !d.label ||
      (d.cover !== null && !safeURL(d.cover))
    )
      throw new Error("Invalid or duplicate DVD: " + d.slug);
    discs.add(d.slug);
  }
  for (const v of result.videos) {
    if (
      !slugOK(v.slug) ||
      slugs.has(v.slug) ||
      !v.id ||
      ids.has(v.id) ||
      !v.title ||
      typeof v.description !== "string" ||
      !v.category ||
      !Array.isArray(v.tags) ||
      !v.tags.every((t) => typeof t === "string")
    )
      throw new Error("Invalid or duplicate video: " + v.slug);
    if (
      v.year !== null &&
      (!Number.isInteger(v.year) || v.year < 1900 || v.year > 2100)
    )
      throw new Error("Invalid year: " + v.slug);
    if (
      v.duration !== null &&
      (!Number.isInteger(v.duration) || v.duration <= 0)
    )
      throw new Error("Invalid duration: " + v.slug);
    if (v.dvdSlug !== null && !discs.has(v.dvdSlug))
      throw new Error("Missing source DVD: " + v.slug);
    if (
      !safeURL(v.poster) ||
      !safeURL(v.sourceUrl) ||
      !Number.isFinite(Date.parse(v.addedAt))
    )
      throw new Error("Invalid public media or date: " + v.slug);
    if (v.source?.type === "youtube" && /^[a-zA-Z0-9_-]{11}$/.test(v.source.id))
      v.source = { type: "youtube", id: v.source.id };
    else if (v.source?.type === "mp4" && safeURL(v.source.url))
      v.source = {
        type: "mp4",
        url: v.source.url,
        ...(v.source.captions && safeURL(v.source.captions)
          ? { captions: v.source.captions }
          : {}),
      };
    else throw new Error("Invalid playback source: " + v.slug);
    slugs.add(v.slug);
    ids.add(v.id);
  }
  return result;
}
export async function prepareCatalogue() {
  let data;
  if (process.env.TVM_CATALOGUE_SOURCE === "supabase") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
      throw new Error("Supabase catalogue credentials are missing.");
    const response = await fetch(url + "/rest/v1/rpc/tvm_export_catalogue", {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!response.ok)
      throw new Error(
        "Catalogue export failed. Apply the TVM migration before enabling Supabase export.",
      );
    data = await response.json();
  } else data = JSON.parse(await readFile("data/catalogue.json", "utf8"));
  const snapshot = validateCatalogue(data);
  await writeFile(
    "data/catalogue.json",
    JSON.stringify(snapshot, null, 2) + "\n",
  );
  await mkdir("public", { recursive: true });
  await writeFile("public/catalogue.json", JSON.stringify(snapshot) + "\n");
  console.log(
    `Catalogue ready: ${snapshot.videos.length} videos, ${snapshot.dvds.length} DVDs (${snapshot.revision}).`,
  );
}
if (process.argv[1]?.endsWith("/catalogue.mjs")) await prepareCatalogue();
