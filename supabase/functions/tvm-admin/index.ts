import { createClient } from "npm:@supabase/supabase-js@2";
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
} from "npm:@aws-sdk/client-s3@3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3";

const required = (key: string) => {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing function setting: ${key}`);
  return v;
};
const origin = Deno.env.get("TVM_SITE_ORIGIN") || "http://localhost:3000";
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  Vary: "Origin",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const s3 = () =>
  new S3Client({
    region: "auto",
    endpoint: required("R2_ENDPOINT"),
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST")
    return response({ error: "Method not allowed" }, 405);
  try {
    const token = request.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "");
    if (!token) return response({ error: "Sign-in required" }, 401);
    const db = createClient(
      required("SUPABASE_URL"),
      required("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user)
      return response({ error: "Invalid session" }, 401);
    const user = auth.user;
    const { data: admin } = await db
      .from("tvm_admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!admin)
      return response({ error: "Archive administrator access required" }, 403);
    const body = await request.json();
    const stagedKey = (key: unknown): string => {
      if (
        typeof key !== "string" ||
        key.includes("..") ||
        !/^staging\/[a-f0-9-]+\/[a-f0-9-]+\/(video\.mp4|poster\.(jpg|png|webp))$/.test(
          key,
        )
      )
        throw new Error("Invalid upload key");
      return key;
    };
    const ownedKey = (key: unknown): string => {
      const valid = stagedKey(key);
      if (!valid.startsWith(`staging/${user.id}/`))
        throw new Error("This upload belongs to another administrator.");
      return valid;
    };
    if (body.action === "rebuild") {
      const result = await fetch(required("VERCEL_DEPLOY_HOOK"), {
        method: "POST",
      });
      if (!result.ok) throw new Error("Vercel rejected the rebuild request.");
      return response({
        message:
          "Rebuild requested. Saved changes will be live after Vercel completes the deployment.",
      });
    }
    if (body.action === "upload-start") {
      const types: Record<string, string> = {
        "video/mp4": "video.mp4",
        "image/jpeg": "poster.jpg",
        "image/png": "poster.png",
        "image/webp": "poster.webp",
      };
      const name = types[body.contentType];
      if (!name || (body.kind === "video") !== name.startsWith("video"))
        throw new Error("Unsupported media type");
      const key = `staging/${user.id}/${crypto.randomUUID()}/${name}`;
      const result = await s3().send(
        new CreateMultipartUploadCommand({
          Bucket: required("R2_STAGING_BUCKET"),
          Key: key,
          ContentType: body.contentType,
        }),
      );
      return response({ key, uploadId: result.UploadId });
    }
    if (
      ["upload-part", "upload-complete", "upload-abort"].includes(body.action)
    ) {
      const key = ownedKey(body.key);
      if (typeof body.uploadId !== "string" || !body.uploadId)
        throw new Error("Invalid upload session");
      const input = {
        Bucket: required("R2_STAGING_BUCKET"),
        Key: key,
        UploadId: body.uploadId,
      };
      if (body.action === "upload-part") {
        if (
          !Number.isInteger(body.partNumber) ||
          body.partNumber < 1 ||
          body.partNumber > 10000
        )
          throw new Error("Invalid part number");
        return response({
          url: await getSignedUrl(
            s3(),
            new UploadPartCommand({ ...input, PartNumber: body.partNumber }),
            { expiresIn: 600 },
          ),
        });
      }
      if (body.action === "upload-abort") {
        await s3().send(new AbortMultipartUploadCommand(input));
        return response({ ok: true });
      }
      if (
        !Array.isArray(body.parts) ||
        !body.parts.length ||
        body.parts.length > 10000 ||
        body.parts.some(
          (p: { ETag: string; PartNumber: number }, i: number) =>
            typeof p.ETag !== "string" || p.PartNumber !== i + 1,
        )
      )
        throw new Error("Invalid uploaded parts");
      await s3().send(
        new CompleteMultipartUploadCommand({
          ...input,
          MultipartUpload: { Parts: body.parts },
        }),
      );
      const object = await s3().send(
        new HeadObjectCommand({ Bucket: input.Bucket, Key: key }),
      );
      if (!object.ContentLength || object.ContentLength > 1024 ** 3)
        throw new Error("Uploaded media must be between 1 byte and 1 GB");
      return response({ ok: true });
    }
    if (
      !["preview", "publish", "unpublish"].includes(body.action) ||
      typeof body.id !== "string"
    )
      return response({ error: "Unknown operation" }, 400);
    const { data: video, error } = await db
      .from("tvm_videos")
      .select("*")
      .eq("id", body.id)
      .single();
    if (error || !video) throw new Error("Save this video record first.");
    if (body.action === "unpublish") {
      const { error } = await db
        .from("tvm_videos")
        .update({ status: "draft" })
        .eq("id", video.id);
      if (error) throw error;
      return response({
        video: { ...video, status: "draft" },
        message:
          "Unpublished in the database. Rebuild the public site to update its catalogue. Existing media URLs remain accessible.",
      });
    }
    if (body.action === "preview") {
      const preview = { ...video };
      if (video.playback_key) {
        const key = stagedKey(video.playback_key);
        const url = await getSignedUrl(
          s3(),
          new GetObjectCommand({
            Bucket: required("R2_STAGING_BUCKET"),
            Key: key,
          }),
          { expiresIn: 3600 },
        );
        preview.source = { type: "mp4", url };
        preview.sourceUrl = url;
      }
      if (video.poster_key)
        preview.poster = await getSignedUrl(
          s3(),
          new GetObjectCommand({
            Bucket: required("R2_STAGING_BUCKET"),
            Key: stagedKey(video.poster_key),
          }),
          { expiresIn: 3600 },
        );
      return response({ video: preview });
    }
    const base = required("TVM_MEDIA_BASE_URL").replace(/\/$/, "");
    if (!base.startsWith("https://"))
      throw new Error("The media base URL must use HTTPS.");
    const updated = { ...video, status: "published", ready: true };
    const promote = async (key: string) => {
      // Records can be published by a different invited admin; keys are still confined to TVM staging.
      stagedKey(key);
      const client = s3(),
        stage = required("R2_STAGING_BUCKET"),
        bucket = required("R2_PUBLIC_BUCKET");
      const info = await client.send(
        new HeadObjectCommand({ Bucket: stage, Key: key }),
      );
      if (!info.ContentLength || info.ContentLength > 1024 ** 3)
        throw new Error("Staged media is missing or too large.");
      const destination = `videos/${video.slug}/${key.split("/").slice(2).join("/")}`;
      await client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          Key: destination,
          CopySource: `${stage}/${key}`,
          ContentType: info.ContentType,
          CacheControl: "public, max-age=31536000, immutable",
          MetadataDirective: "REPLACE",
        }),
      );
      return `${base}/${destination}`;
    };
    if (video.playback_key) {
      const url = await promote(video.playback_key);
      updated.source = { type: "mp4", url };
      updated.sourceUrl = url;
    }
    if (video.poster_key) updated.poster = await promote(video.poster_key);
    if (!updated.poster) throw new Error("Add a poster before publishing.");
    if (
      updated.source.type === "youtube" &&
      !/^[a-zA-Z0-9_-]{11}$/.test(updated.source.id)
    )
      throw new Error("Invalid YouTube video ID.");
    if (
      updated.source.type === "mp4" &&
      !(
        updated.source.url?.startsWith(`${base}/`) ||
        updated.source.url?.startsWith("/media/")
      )
    )
      throw new Error(
        "Upload an MP4 to the archive media bucket before publishing.",
      );
    const { error: saveError } = await db
      .from("tvm_videos")
      .update(updated)
      .eq("id", video.id);
    if (saveError) throw saveError;
    return response({
      video: updated,
      message:
        "Ready for publication. Rebuild the public site to make this recording live.",
    });
  } catch (error) {
    return response(
      {
        error:
          error instanceof Error ? error.message : "Archive operation failed",
      },
      400,
    );
  }
});
