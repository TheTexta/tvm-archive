# TVM Archive

A static archive of TVM student television at McGill, staged in a digital white void inspired by the Construct in _The Matrix_ (1999). Built with Next.js 16, React 19, TypeScript, Tailwind CSS, Motion for React, and Three.js. This is TVM's archive, not an official Matrix project.

## Run locally

```sh
npm install
npm run dev
```

For the actual static export:

```sh
npm run build
npm start
```

Open http://localhost:3000. The build produces `out/`; it requires no Next.js runtime. `npm start` serves that folder with byte-range support for video seeking. Tests: `npm test`. Lint: `npm run lint`.

## Demo footage

The catalogue contains eight real DVD recordings converted from `/Volumes/A044/DVD Backups`, with source-disc pages. Three are complete first-title recordings; five are clearly labelled demo excerpts from discs. No original backup was changed. Derivatives use H.264/AAC, fast-start metadata, deinterlacing where needed, and square pixels preserving 4:3 or 16:9 display proportions. The demo MP4s total approximately 55 MB and live in `public/media/`.

Recreate the pilot imports with FFmpeg and FFprobe installed:

```sh
python3 scripts/import-demo.py '/Volumes/A044/DVD Backups'
```

This imports selected first titles rather than treating all VOB chunks as independent films. Remaining titles and chapters need cataloguing. The manifest is `data/demo-import.json`. Thumbnails are local files. The historical TVM logo remains available as a source asset with provenance recorded in `data/asset-sources.json`, but the site header and icon use a black text wordmark instead. The initial public TVM online records are retained in `data/online-reference.json` for optional later use.

The homepage selects a random video in the browser on each fresh load. Shuffle avoids immediate repeats; when a recording ends, the next catalogue video plays (wrapping to the first). Playback attempts autoplay with sound first, falling back to muted autoplay when required by the browser. The homepage TV has a transparent, right-aligned seek bar without play/pause or sound buttons; the video title is selectable, and “Video details” leads to a watch page with native controls and captions. Viewer mute and volume choices persist across video changes and page navigation; automatic muting does not overwrite those choices. Browser storage is used when available, with an in-memory fallback. Native controls appear if all autoplay is blocked. YouTube embeds use the official iframe API to apply and remember the same sound preference.

The homepage opens with a full-viewport Radiola television in an apparently infinite white room; the collection begins below the first screen. The transparent menu uses a black “TVM Archive” text wordmark. The hero has no visible introductory headline or paragraph so the TV has breathing room. Fine-pointer movement eases the camera around the TV for depth while preserving a head-on resting view; touch and reduced-motion visitors get a steady view. The featured MP4 plays on a dedicated screen mesh in the exported model. Video wider than the screen keeps its aspect ratio, with solid black letterboxing. The 3D scene loads only in the browser. The page falls back to the native player when WebGL or the model fails to load. YouTube entries use the native player instead of a video texture. Watch pages autoplay and advance to the next recording when one ends.

## Design language — The Construct

The Construct is not a conventional white interior. Its near-limitless empty field has no readable walls, ceiling, floor edge, architectural grid, or visible light source. The absence of a world isolates the objects: a detailed, weathered, brown-and-brass analog television becomes the only substantial thing in the first viewport, and the archival footage supplies the visual world _inside_ it. The site draws on this tension between believable physical material and impossible digital emptiness rather than copying green code or neon sci-fi effects.

The layout gives the TV generous negative space and lets the collection appear only after scrolling. Lighting is high-key and almost shadowless, with just enough contact shadow to ground the set. Navigation, search, DVD pages, watch pages, and the footer use the same sparse, editorial vocabulary. Interface copy is limited to factual labels, direct actions, and useful archive context: “The Collection,” “8 Videos,” and “No results” instead of promotional prompts. Source provenance, uncertain dates, and form feedback remain explicit. Motion responds to the viewer's pointer, never competes with a recording, and stops for reduced-motion preferences.

### Adaptive scene quality

The hero initially uses direct rendering, hardware antialiasing (including on high-density displays), and the model's existing baked ambient-occlusion texture. The shadow receiver is confined to the TV's contact area rather than overlapping the infinite floor into the distance, where it could produce depth-fighting artifacts. It does not apply global bloom, color grading, or screen-space AO. Static shadows are rendered once; rendering pauses while the scene is off-screen or the tab is hidden.

The TV's PBR materials use a light-response/display-transform treatment inspired by [P_Malin's Meta CRT](https://www.shadertoy.com/view/4dlyWX), inspected through its [source port](https://github.com/libretro/glsl-shaders/tree/master/crt/shaders/metacrt). `lib/material-light-processing.ts` applies the reference's rational highlight-rolloff curve before the single sRGB output conversion, and weights ambient irradiance by the world-space surface normal, retaining lower-hemisphere fill for the existing white floor. Three's GGX/Fresnel response, material textures, normal/roughness maps, and baked AO remain active. This is not a complete shader port: its motion blur, depth of field, temporal accumulation, grain, and vignette are deliberately excluded. No geometry, camera, light placement/intensity, room, environment map, video shader, or background is changed. Processing is confined to the TV materials rather than a full-frame pass, with no additional render targets or textures. Compare the prior material response with `/?lightProcessing=original`; the scene element reports `data-light-processing="meta-crt"` or `"original"`.

The TV screen alone uses a single-pass adaptation of Timothy Lottes' public-domain [CRT shader](https://www.shadertoy.com/view/XsjSzR), with the source reference and attribution in `lib/crt-screen.ts`. It combines Gaussian reconstruction, restrained scanlines, a subtle RGB phosphor mask, and slight image curvature; there is no bloom, flicker, noise, or temporal afterglow. The virtual raster preserves the recording's aspect ratio at up to 240 rows, and derivatives fade scanlines and mask detail before they become subpixel. The mask is anchored to the TV's UVs so it follows parallax rather than sticking to the browser viewport. Video is decoded to linear light before filtering and encoded once for display. Black letterboxing, native controls, watch-page playback, and the no-WebGL fallback remain unchanged; media files are not modified. Data-saver, constrained hardware hints, or an oversized canvas disable the effect. After warmup, a 90-frame playback window with p90 frame time over 24 ms disables it for the rest of the tab, independently of cabinet texture quality. Inspect `data-crt="lottes"` or `"off"` on the scene element. No additional render targets or GPU textures are allocated.

The screen also illuminates the actual recessed inner bezel through four video-reactive rectangular area lights (`lib/screen-lighting.ts`). A private 24×24 canvas samples the contained picture, including black letterboxing, at up to 10 Hz during playback. Each quadrant's linear-light colour drives the corresponding part of the emitting screen, with 180 ms exponential smoothing to avoid abrupt colour flashes. Paused seeks update the light and settle before rendering stops. The bezel keeps its original texture, normal map, roughness, and physically based diffuse/specular response. This is a regional area-emitter approximation of screen-to-frame illumination, not ray-traced global illumination or shadowed multi-bounce transport. Only the separate `Screen_LowB` mesh receives these lights: other TV materials explicitly exclude their contribution, and the white room/floor remain unchanged. There is no glow outline or bloom.

Area-light code and LTC lookup tables load only on eligible devices. Data-saver, constrained hardware, and oversized canvases disable emission. After warmup, 90 active frames with p90 over 24 ms remove the lights for the rest of the tab, including across shuffles; the CRT receives a fresh performance window without area lighting before being judged separately. Pixel-readback/CORS failures disable only emission, never playback. Hidden/off-screen scenes do not sample frames. Downgrade/unmount restores shared materials and releases the canvas, cloned bezel material, and optional LTC GPU textures (after the last active scene releases them). Inspect `data-screen-light="regional"` or `"off"` on the scene element.

The rejected per-fragment ray-traced bezel experiment is retained **opt-in only** at `/?screenLight=raytrace` (`lib/bezel-ray-*.ts`); the default remains the regional area lights. It traces visibility against a static BVH of nearby model triangles and integrates a smoothed 32×32 linear-light screen image through the existing PBR equation. It is direct screen illumination, not full-scene path tracing or multi-bounce GI. Fixed sparse samples can produce uneven highlights, and the measured prototype exhibited severe slow frames, so it is not the realism/default path. `raySamples=16`, `32` (default), or `64` requests the initial ray count. Slow playback halves the ray count to a minimum of 16 before disabling emission; the reduced ceiling persists across shuffles. Both ray textures, the sampling canvas, and cloned materials are released on downgrade/unmount. `data-screen-rays` reports the active count. Use `/?screenLight=off` to compare without any screen illumination. All query switches are read when the scene mounts; reload for a clean comparison.

Studio lighting stays fixed from the first frame—there is no delayed change to the room's lighting. In a desktop-sized view with a fine pointer, the original 2048px cabinet atlas and up to 4× anisotropic filtering load alongside the GLB **before the TV first renders**. If measured playback slows, the TV returns to its 1024px atlas for the rest of that tab's session (including subsequent shuffles). Mobile/touch-sized views begin with the smaller atlas and use `lib/scene-quality.ts` to try the enhanced version only after smooth visible playback. A capable mobile device can qualify; a desktop view can downgrade. Data-saver takes precedence over the desktop default. Low reported memory, few cores, or an oversized canvas rule out the mobile trial; unknown hardware hints do not. An ineligible resize or sustained slowdown restores the smaller atlas and original filtering. The upgrade affects the TV's PBR materials, not the archival video or white background. No GPU model or persistent device fingerprint is collected. The scene element's `data-graphics` value (`basic`, `loading`, `trial`, `enhanced`, or `rejected`) is available for local inspection.

| Role               | Color                                              |
| ------------------ | -------------------------------------------------- |
| Void / page        | `#fafaf9`                                          |
| Seamless floor     | `#fafaf9` (matches the void)                       |
| Soft grey surfaces | `#f3f3f0`                                          |
| Near-black text    | `#201b17`                                          |
| Muted grey         | `#6e6861`                                          |
| Oxblood accent     | `#762d30`                                          |
| TV materials       | Weathered brown wood and aged brass from the asset |

Use **Times** sitewide—not Times New Roman. The four local font-face rules resolve macOS's exact `Times-*` PostScript names rather than relying on a system alias that could substitute Times New Roman. Where that face is unavailable, `next/font/google` self-hosts **Tinos** as the fallback, including normal, bold, and italic. The Tinos license is retained at `public/fonts/Tinos-OFL.txt`. The system Times face is not redistributed. The visible wordmark and site icon are black text rather than the old graphic logo; the original logo file is kept only as an archival source asset. Avoid invented Matrix logos, source-film footage, heavy shadows, gradients, decorative scanline overlays outside the TV, circuitry, and ornamental controls.

### Radiola asset pipeline

`the-matrix-white-room.zip` contains the original Blender scene and many textures. The site ships `public/models/construct-tv.glb` (about 2.8 MB) with the Radiola cabinet, its 1024px baseline textures, and one clean playback surface. The export shares a single normal map between the TV's materials instead of duplicating it. It also writes `public/models/construct-tv-color-2k.jpg`, the original 2048px color atlas, which browsers fetch only after the enhanced tier is selected. The two chairs, other furniture, and roughly 200 baked screen-frame meshes are **not** exported. The source ZIP remains untouched; do not copy the whole scene into `public/`.

With Blender 4.5+ installed, regenerate the asset after any approved model change:

```sh
blender --background --python scripts/export-construct-tv.py -- \
  --source the-matrix-white-room.zip --output public/models/construct-tv.glb
```

`components/tv-scene.tsx` loads the GLB and maps the catalogue video onto its named `PlaybackScreen`. The floor is intentionally a broad, featureless plane blended into a matching fog/background; there are no shipped walls or chairs. Check the source model's redistribution rights and any required attribution before publishing.

`opencode.json` configures the project-local Three.js devtools MCP for inspecting this scene. It runs the pinned npm package as a local process and keeps its browser launch disabled. Start the site with `npm run dev`, then open the devtools proxy at `http://localhost:9222/` to inspect the scene; change the target port with the MCP's `set_dev_port` tool if your dev server uses another port.

Search, category/year/source/DVD filters, sorting, and pagination run locally in a single grid layout. MP4 cards preview silently on pointer hover without fetching video until hovered; touch and reduced-motion visitors see still images. Query state is shareable and restored on browser Back; old `view` query parameters are ignored. Watch and DVD routes are generated from the catalogue snapshot. Each watch page includes an in-page contact form with its recording and source-disc details prefilled. “Send to archive” saves a message in Supabase for administrators to review in the Inbox tab. “Email TVM instead” is an optional email-draft action. Failed submissions preserve the visitor's text and never display a success acknowledgement.

## Catalogue

`data/catalogue.json` is the demo's source of truth. `npm run catalogue` validates it, strips internal fields, and writes `public/catalogue.json`. This also runs before a production build. The public site makes no runtime database requests.

The snapshot accepts MP4 sources (`{ "type": "mp4", "url": "https://media.example.com/path.mp4" }`) and YouTube sources (`{ "type": "youtube", "id": "VIDEO_ID" }`). Use `null` for unknown years and durations. Every `dvdSlug` must refer to a DVD in the snapshot. New recordings need unique IDs and slugs, descriptions, categories, tags, posters, and an `addedAt` ISO date.

## Supabase admin setup

The private browser admin lives at [`https://dextery.dev/admin`](https://dextery.dev/admin) and uses Supabase Auth. The archive deployment's `/admin/` route only forwards administrators to that canonical address. The configured database already contains another gallery project, so no remote schema changes were applied during this build. All archive tables and functions use the `tvm_` prefix.

1. Apply `supabase/migrations/202610010001_tvm_archive.sql`, then `supabase/migrations/202610010002_tvm_contact_inbox.sql`, to the intended project using its SQL editor or migration workflow. The migrations create only TVM tables/functions and policies. If the archive migration is already applied, run only the new contact inbox migration.
2. Invite an administrator in Supabase Auth and insert that user's UUID into `public.tvm_admin_users`. Public signup should stay disabled for an invite-only admin. Authenticate with the invited email/password.
3. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). The existing `.env.local` is preserved and ignored by Git. See `.env.example`.
4. Deploy the `supabase/functions/tvm-admin/` Edge Function. Its handler verifies the user's token and TVM admin allowlist for every operation. Keep JWT verification enabled when deploying, and set `TVM_SITE_ORIGIN=https://dextery.dev` so the canonical admin can call it.
5. Set function secrets: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_STAGING_BUCKET`, `R2_PUBLIC_BUCKET`, `TVM_MEDIA_BASE_URL`, `TVM_SITE_ORIGIN` (the app's exact origin), and `VERCEL_DEPLOY_HOOK`. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to functions.
6. To populate the TVM tables with the demo, run `npm run seed:database` explicitly. This writes only `tvm_dvds` and `tvm_videos`; it is not run during builds. The local demo media must remain in the static output until it is uploaded to R2.
7. Set `TVM_CATALOGUE_SOURCE=supabase` in Vercel's build environment, plus the Supabase URL and service-role key. The prebuild script uses a single database snapshot RPC to generate consistent routes and catalogue files. Fetch or validation failures stop the build instead of silently publishing an empty catalogue.

The admin can edit metadata, create DVDs/videos, preview private staged media, upload MP4s/posters directly to R2 with multipart transfer, publish/unpublish records, and request a Vercel rebuild. Browser uploads currently support MP4/JPEG/PNG/WebP files up to 1 GB. Conversion and title/chapter extraction remain local tasks.

The contact Inbox shows new/all/reviewed submissions, a new-message count, contributor details, the original recording context, and the message. Administrators can mark messages reviewed or new, refresh the inbox, and load older messages. Inbox updates are live and require no public rebuild. Anonymous visitors can execute only the validated submission RPC; they cannot read the inbox or insert rows directly. The RPC accepts only published, ready recordings, resolves metadata from the database, and preserves that context even if the video later changes or is deleted. Messages and email addresses are excluded from the public catalogue. Seed the demo records after applying both migrations so their archive IDs are recognised by the submission function. No email delivery service or additional Edge Function is required for this inbox.

**Publishing:** save metadata → upload converted media → preview → publish → rebuild public site. Promoted objects use immutable versioned URLs. Saved database changes become public only after a successful static deployment. The admin displays the catalogue revision included in its current build; reload after deployment to see the new revision. Live deployment monitoring is not included yet. Unpublishing requires a rebuild, and does not revoke a public media URL; urgent media removal requires deleting/restricting the object and purging its cache.

## R2

Use a dedicated published TVM bucket behind a production custom domain, and a private staging bucket for draft uploads. Public playback requests go straight to the media domain. Never put R2 credentials or service-role keys in `NEXT_PUBLIC_` variables.

Both buckets need CORS for the exact app origin and localhost while developing: allow `GET`, `HEAD`, and `PUT`; allow the `Content-Type` and `Range` request headers; expose `ETag`, `Content-Length`, and `Content-Range`. The upload UI needs `ETag` for completing multipart uploads. Keep the staging bucket private and add a lifecycle rule to abort incomplete multipart uploads. Preview URLs expire after one hour.

To upload the existing demo derivatives to your dedicated public R2 bucket:

```sh
# Configure the R2 values in .env.example first.
npm run media:upload
npm run build
```

This is an explicit write operation. It uploads local MP4s/posters and changes the local catalogue to use their media-domain URLs. If Supabase is your catalogue source, import the updated catalogue before rebuilding from the database.

## Vercel

Deploy as a static export: build command `npm run build`, output directory `out`. No server functions or SSR are needed for public browsing. The admin backend runs separately in Supabase. Deploying the site, applying the live migration, and configuring R2/Supabase functions have not been performed by this local build.
