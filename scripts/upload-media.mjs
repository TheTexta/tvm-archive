// Upload already converted local derivatives to a dedicated TVM public bucket.
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
loadEnvConfig(process.cwd());
if (!process.argv.includes("--apply"))
  throw new Error(
    "Use --apply to explicitly upload the demo media to your configured TVM bucket.",
  );
const bucket = process.env.TVM_R2_BUCKET,
  base = process.env.TVM_MEDIA_BASE_URL?.replace(/\/$/, "");
if (!bucket || !base?.startsWith("https://"))
  throw new Error("Set TVM_R2_BUCKET and an HTTPS TVM_MEDIA_BASE_URL.");
const client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_S3_API_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_KEY,
  },
});
const catalogue = JSON.parse(await readFile("data/catalogue.json", "utf8"));
for (const v of catalogue.videos) {
  if (v.source.type !== "mp4" || !v.source.url.startsWith("/media/")) continue;
  for (const [property, path, type] of [
    ["video", v.source.url, "video/mp4"],
    ["poster", v.poster, "image/jpeg"],
  ]) {
    const body = await readFile("public" + path);
    const revision = createHash("sha256")
      .update(body)
      .digest("hex")
      .slice(0, 12);
    const key = `videos/${v.slug}/${revision}/${property === "video" ? "playback.mp4" : "poster.jpg"}`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: type,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    const url = base + "/" + key;
    if (property === "video") {
      v.source.url = url;
      v.sourceUrl = url;
    } else {
      v.poster = url;
      const dvd = catalogue.dvds.find((d) => d.slug === v.dvdSlug);
      if (dvd) dvd.cover = url;
    }
  }
  console.log("Uploaded " + v.title);
}
await writeFile(
  "data/catalogue.json",
  JSON.stringify(catalogue, null, 2) + "\n",
);
