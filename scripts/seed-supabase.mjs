// Explicit opt-in import; never runs as part of a build.
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { validateCatalogue } from "./catalogue.mjs";
loadEnvConfig(process.cwd());
if (!process.argv.includes("--apply"))
  throw new Error(
    "Use --apply to explicitly import the local catalogue into the TVM tables.",
  );
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase configuration missing.");
const db = createClient(url, key);
const snapshot = validateCatalogue(
  JSON.parse(await readFile("data/catalogue.json", "utf8")),
);
const discs = await db
  .from("tvm_dvds")
  .upsert(snapshot.dvds, { onConflict: "slug" });
if (discs.error) throw new Error("DVD seed failed: " + discs.error.message);
const videos = await db.from("tvm_videos").upsert(
  snapshot.videos.map((v) => ({ ...v, status: "published", ready: true })),
  { onConflict: "id" },
);
if (videos.error) throw new Error("Video seed failed: " + videos.error.message);
console.log("Imported the local catalogue into isolated TVM tables.");
