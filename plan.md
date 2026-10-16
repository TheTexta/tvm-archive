# TVM McGill Archive — Project Plan

Status: local demo implemented October 1, 2026. Reference hierarchy confirmed: Internet Archive functionality, CKUT UI, and subtle design influence from elliotmairet.com, the owner's project showcased on dextery.dev. Static export; no Three.js.

## Implementation status

The static frontend is built, with random homepage playback, search/filter/sort controls, grid/list views, watch pages, DVD collections, and a mobile layout. Eight real recordings from `/Volumes/A044/DVD Backups` have been converted to browser-ready MP4s and indexed without modifying the original files. Three are complete first-title recordings; five are labelled demo excerpts.

The private browser admin, isolated `tvm_` database migrations, contact form and private admin inbox, R2 upload/publish function, catalogue export, and deployment-hook integration are implemented. Messages submit directly to Supabase without requiring email, with email as a secondary option. Database permissions and snapshot filtering are tested locally. Live Supabase migrations, R2 configuration, function deployment, and Vercel deployment remain setup work; the existing database contains another project and was not changed. Deployment monitoring, full-disc/title inventory, caption ingestion, and cross-browser/device release checks remain future work. See `README.md` for the concrete setup and import steps.

## Goal

Create a stylized home for the TVM DVDs currently being catalogued. Opening the homepage should surface a random archive video in a prominent player, with controls and discovery tools below it. The experience should feel like finding forgotten student television, with enough structure to locate a particular film, year, or DVD.

Use a static Next.js export on Vercel, Supabase Postgres and Auth for the catalogue and private admin, and Cloudflare R2 for media. Supabase functions handle privileged admin operations. The initial collection contains approximately 60–100 DVDs, some still in unusual formats. Total video count, duration, and storage size need to be measured during inventory.

## Existing project

- Next.js 16.3.8 with App Router, React 19.2.8, TypeScript, and Tailwind CSS 4.
- The app now contains the implemented archive frontend and private admin shell.
- Before implementation, consult the installed Next.js guides in `node_modules/next/dist/docs/`, as required by `AGENTS.md`. The video, server/client component, deployment, and static-export guides were reviewed for this plan.
- Keep this plan as the design and release roadmap; implemented behavior and setup instructions are documented in `README.md`.

## Stack decisions

| Decision         | Choice                                                                     | Status                                                      |
| ---------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Frontend         | Existing Next.js/React/TypeScript/Tailwind stack                           | Confirmed                                                   |
| App hosting      | Vercel serving the static `out/` export                                    | Confirmed                                                   |
| Rendering        | Next.js `output: 'export'`; build-time HTML and browser interactivity      | Static site requested by owner                              |
| Catalogue        | Supabase Postgres with a private browser admin                             | Confirmed                                                   |
| Admin login      | Supabase Auth, invited email/password accounts                             | Implemented; allowlist to configure during setup            |
| Media            | Cloudflare R2; MP4 derivatives as the initial playback format              | R2 preferred by owner; encoding to validate with real files |
| Collection size  | Approximately 60–100 DVDs, mixed formats                                   | Disc estimate confirmed; inventory still needed             |
| Player           | Native HTML video with a styled surrounding interface                      | Proposed first version                                      |
| Visual direction | Internet Archive functionality; CKUT UI; subtle elliotmairet.com influence | Confirmed                                                   |
| 3D               | No Three.js, React Three Fiber, or WebGL UI                                | Confirmed                                                   |

Supabase stores catalogue records and admin identities; R2 stores the video files and images. Use migrations for the database schema and a small catalogue access layer. The static admin uses browser-based Supabase Auth and row-level policies rather than cookie-based Next.js server authentication. Refer to [Supabase's React auth guide](https://supabase.com/docs/guides/auth/quickstarts/react), [row-level security guide](https://supabase.com/docs/guides/database/postgres/row-level-security), and [Edge Functions guide](https://supabase.com/docs/guides/functions).

Vercel serves static HTML, CSS, JavaScript, and catalogue files. Browsers fetch playback media directly from R2. The admin calls Supabase for authenticated data access and functions for R2 signing and publication operations. DVD conversion runs locally, with processed files uploaded directly to R2.

### Static architecture and publishing

- Configure `output: 'export'` during implementation; `next build` produces `out/`. Export every published `/watch/[slug]` and `/dvds/[slug]` route using `generateStaticParams()`.
- At build time, fetch one consistent, validated snapshot of published, playback-ready records from Supabase. Generate the public catalogue JSON, search index, routes, and counts from that same snapshot.
- Export only public fields. Keep draft records, ingest logs, private source locations, and privileged credentials out of generated HTML, JSON, and browser bundles.
- Random selection, searching, filtering, sorting, and grid/list switching run in the browser against this catalogue. Public browsing and playback do not need live Supabase queries.
- Pre-render page content at build time; isolate player and catalogue interactions in client components. Access browser APIs only after mounting so build-time rendering stays deterministic.
- Use pre-generated responsive poster images or an explicitly static-compatible image loader; the default Next.js image optimization endpoint requires a server.
- Keep the single `dextery.dev/admin` page as a browser application shell. Its authenticated data loads after sign-in; database policies and Supabase functions enforce access independently of the visible UI.
- Publishing marks an entry ready for the next site build. An authenticated admin function triggers a Vercel deploy hook, with the hook secret stored outside the browser. Batch changes into one rebuild when processing several DVDs.
- Show whether changes are saved, awaiting deployment, live, or failed. A failed build keeps the previous deployment available and allows a retry. Record the catalogue revision in the build output so the admin can identify the deployed revision.
- Metadata edits, new routes, and unpublishing require a rebuild to update the public snapshot. Urgent media removal also requires restricting/removing the R2 object and purging its cached copy; old static deployments can still contain metadata.
- The exported app uses build-time rendering and external admin services. Request-time Next.js route handlers, Server Actions, Proxy, cookies, and ISR are outside this architecture; see the installed `static-exports.md` guide.

## Homepage and archive experience

1. **Identity:** compact TVM masthead with a bordered navigation strip, archive name, and a link to the main TVM site.
2. **Featured player:** select one playable, published video on each fresh page load. Show its title, known year, duration, and original DVD/collection.
3. **Playback:** attempt inline autoplay with sound; fall back to muted autoplay when the browser requires it, with an Enable sound control and native Play fallback. Remember viewer mute/volume choices across recordings without persisting automatic policy muting. Preserve the source aspect ratio, including 4:3 footage. Keep pause, seeking, volume, and fullscreen accessible.
4. **Discovery below the player:** “Play another random video,” a prominent archive search field, year/era filters, tags, and DVD/collection browsing. Display the result count and selected filters.
5. **Results:** thumbnail cards with title, year if known, duration, collection, and a small archive ID; offer a compact list view and title/year/recently-added sorting. Selecting a result opens a stable watch URL.
6. **Context:** short archive introduction and an indication that additional discs are being digitized.

Proposed routes:

- `/` — random video player and archive exploration below it.
- `/watch/[slug]` — stable video page with credits, description, and source-disc context.
- `/dvds/[slug]` — disc label/cover, notes, and its associated videos.
- An additional `/archive` route only if the catalogue needs more room than the homepage provides; share the browsing components.
- `https://dextery.dev/admin` — the single private sign-in, DVD inventory, video editing, inbox, and publication interface. The archive site's `/admin` route forwards there.

Random selection happens in the browser on each fresh homepage load and on shuffle, using the exported catalogue. Keep the initial player placeholder deterministic; sample eligible videos with equal probability and avoid immediately repeating the current video when alternatives exist. Handle an empty catalogue, a single video, and an unavailable media object without endless retries. Use a real retry/shuffle control when playback fails.

Use a desktop filter column beside the results below the player; collapse it into an accessible filter panel on mobile. Search titles, descriptions, tags, credits, and disc labels. Preserve search/filter/sort/view state in URL query parameters through browser history, and restore it on back navigation. Include an explicit unknown-year option. Keep pagination or “load more” entirely client-side, and measure the catalogue/index size after the pilot.

Autoplay is best effort: browsers can block it, especially with sound. See [MDN's autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).

## Frontend direction

Build an archive with Internet Archive's browsing functionality and CKUT's UI. Let elliotmairet.com contribute a subtle photographic sensibility through image arrangement, spacing, and restrained presentation. This is the specific project referenced through dextery.dev.

The reference hierarchy guides design decisions:

1. **Internet Archive defines functionality:** search, filters, sorting, grid/list browsing, collection context, and stable item pages, adapted to the TVM catalogue and random-video homepage.
2. **CKUT defines the UI:** typography, navigation, borders, controls, colour emphasis, and page structure, adapted to TVM branding.
3. **elliotmairet.com supplies light inspiration:** consider its approach to image indexes and visual pacing where it fits the CKUT UI. Treat this influence as a design sensibility rather than a required component or feature set.

The observations below come from the reviewed references; Elliot Mairet's archive was reviewed through its presentation on [dextery.dev](https://dextery.dev/portfolio). Proposed TVM treatments are interpretations to validate in the first mockup.

### Reference mapping

| Reference                                                                                                                | Observed cues                                                                                                                              | Proposed TVM treatment                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| [Wayback Machine](https://web.archive.org/) and [Internet Archive video collections](https://archive.org/details/movies) | Prominent search; the video catalogue adds filters, result counts, sorting, grid/list views, and collection context                        | Put searchable archive tools below the featured player, with compact metadata and stable collection/watch pages                 |
| [CKUT](https://ckut.ca/)                                                                                                 | White/black contrast, bold sans-serif type, thin borders dividing header cells and content, red playback emphasis, large editorial imagery | Bordered TVM masthead, square panels, bold section titles, white catalogue background, and TVM red for primary playback actions |
| [elliotmairet.com](https://elliotmairet.com/), as showcased on [dextery.dev](https://dextery.dev/portfolio)              | Expansive photographic index and emphasis on the images themselves                                                                         | Subtle influence on thumbnail composition, spacing, and image-led browsing within CKUT's UI                                     |

Use this hierarchy when choosing components: catalogue behaviour follows Internet Archive, visible UI follows CKUT, and photographic details may draw lightly on Elliot Mairet. Implement the interface in HTML/CSS/React. Three.js and WebGL are excluded.

### Initial visual specification

- **Palette:** white or slightly warm white, near-black type/borders, neutral grey metadata, and TVM red as the primary accent. Use a dark stage for the video player and retain full-colour footage.
- **Typography:** a bold contemporary sans-serif for headings, readable sans-serif body text, and compact tabular numerals for years, IDs, and durations. CKUT's font is a reference for proportions; choose a suitable available font during implementation.
- **Structure:** thin dividing rules, crisp rectangular controls, generous player space, and a compact catalogue. Keep corners mostly square and use minimal shadows.
- **Media:** original thumbnails and DVD scans provide the texture and personality. Draw lightly on Elliot Mairet's image-led presentation when arranging thumbnails. Preserve source framing in the player and show disc notes as editorial context.
- **Interaction:** restrained colour changes, clear focus outlines, expandable metadata, and grid/list controls styled through CKUT's UI language. Thumbnails remain still by default so browsing does not load multiple videos.
- **Motion:** short Motion for React interactions and animated in-page scrolling, configured globally to respect reduced-motion preferences. Keep all controls usable on touch and keyboard, and keep metadata available without hover.
- **Identity:** use the red TVM logo and “Turn Us On!” cue from the [TVM main site](https://www.tvmtelevision.com/), while applying the selected layout and visual direction.

### Homepage layout

```text
TVM logo | Archive | DVDs | About                         Main TVM ↗
------------------------------------------------------------------
FROM THE ARCHIVE                              [Play another video]
[ Large random video player                                      ]
Title / year / duration / original DVD             [Watch page ↗]
------------------------------------------------------------------
EXPLORE THE ARCHIVE
[ Search titles, people, tags, or DVDs                            ]
Filters                N videos | Sort by … | Grid / List
Year / era             Thumbnail + title + metadata / archive ID
DVD / collection       Thumbnail + title + metadata / archive ID
Tags                   …
------------------------------------------------------------------
About the archive / digitization progress / TVM and McGill context
```

On mobile, keep the masthead compact, stack the player and its metadata, and place collapsible filters above the results. The first desktop/mobile mockup should use this direction and real footage; refine spacing, type, and red emphasis within it.

## Archive data and DVD ingestion

Model a **DVD** separately from a **video**: one disc may contain multiple films, an entire programme, or chaptered material. During the pilot, decide whether full-disc recordings, individual pieces, or both should be published.

Minimum video record:

- Stable ID and slug, title, description, and publication status (`draft` or `published`).
- Year/date when known; allow unknown or approximate dates explicitly.
- DVD ID, original title/chapter reference, and source filename for traceability.
- Duration, dimensions/aspect ratio, tags, and credits when known.
- Playback object key, poster object key, and optional caption object key.

Minimum DVD record: ID/slug, label, known date range, cover/label scan, notes, and associated video IDs. Keep checksums and processing details in the ingestion manifest rather than requiring them in the public interface.

The implemented first version uses `tvm_dvds`, `tvm_videos`, and `tvm_admin_users`. Tags are arrays on video records; upload keys and readiness are stored alongside those records. The local import manifest tracks conversion provenance. Separate media and ingest-job tables can follow when the inventory requires them. Unique slugs, foreign keys, and row-level policies enforce catalogue integrity and admin access. The public snapshot contains only published, ready recordings.

### Private browser admin

- Invite-only Supabase login with an explicit admin allowlist; a signed-in account alone does not grant editing rights.
- Use Supabase row-level policies to authorize direct database mutations. Validate identity and admin authorization inside every privileged Supabase function, including preview, upload-signing, publication, and rebuild operations. Keep privileged keys in function/build secrets.
- Create/edit DVD inventory records and upload label/cover scans.
- Create/edit video titles, descriptions, dates, tags, credits, and source-disc associations.
- Show processing state separately from publication state: pending, processing, ready, or failed versus draft/published.
- Preview a processed draft, prepare it for publication once its required media is ready, trigger the static rebuild, or unpublish and rebuild. Distinguish database status from the version currently live on the site.
- Support direct R2 uploads for already converted files and local batch imports for DVD processing. Use authenticated upload sessions and resumable multipart transfer for large files, with completion verification. See [R2 upload documentation](https://developers.cloudflare.com/r2/objects/upload-objects/).
- For unpublished media, use private staging storage and authorized preview URLs. Publishing promotes verified derivatives to public storage and then marks the database record published. Keep staging cleanup/retry steps explicit so interrupted publication can be recovered.
- Unpublishing removes the catalogue record from the next successful static deployment. If the media itself must become inaccessible immediately, remove or restrict the public object and purge any cached copy as a separate operation.

Proposed workflow:

1. Inventory and label each disc with a stable ID; record existing filenames and disc notes.
2. Preserve the original rip locally or in private archival storage; record a checksum.
3. Identify playable titles and chapters. Do not assume each VOB file is a complete film.
4. Produce browser-compatible H.264/AAC MP4 derivatives with fast-start metadata, using local FFmpeg processing. Check interlacing, pixel aspect ratio, audio sync, and chapter boundaries on representative discs.
5. Generate poster images and capture duration/dimensions. Preserve existing captions where available.
6. Upload processed media to private R2 staging, register draft records in Supabase, and review playback and metadata in the browser admin. Mark records published only after required objects are verified and promoted to public media storage, then rebuild/deploy the static archive to make their catalogue entries live.
7. Make imports resumable and repeatable: reuse stable IDs, skip unchanged outputs, and report failed files.

Start with a handful of representative DVDs, including unusual formats. Inspect them with FFprobe and log unsupported or damaged inputs for manual review. Measure output size and conversion time before estimating the 60–100-disc archive. R2 stores and serves objects; this plan performs transcoding separately. Add adaptive HLS renditions later if playback measurements justify them.

## Media storage and delivery

- Use a dedicated R2 bucket for published playback files and posters, plus private staging for drafts; keep original rips outside the public bucket.
- Suggested keys: `videos/{video-id}/v1/playback.mp4`, `videos/{video-id}/v1/poster.jpg`, and `dvds/{dvd-id}/cover.jpg`.
- Deliver browser media directly from a media domain. Keep R2 credentials in local tooling or Supabase function secrets; browser uploads use authorized signed requests.
- Use an R2 custom domain for production. Cloudflare documents `r2.dev` as a development endpoint with rate limits. See [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).
- Configure appropriate content types, versioned-object cache headers, and cross-origin access for the chosen app domain. Verify seeking through byte-range requests and caption loading in the deployed player. See [R2 CORS configuration](https://developers.cloudflare.com/r2/buckets/cors/).
- Verify CDN behaviour for representative video sizes rather than assuming every large MP4 will be cached.
- Keep catalogue metadata separate from bucket listing; the catalogue decides which objects appear publicly.

If the archive needs restricted access, revise the delivery design before implementation; the current working assumption is public viewing without viewer accounts.

## Implementation sequence

### 1. Prove the static publishing and media path

- Stack confirmed: static Next.js export on Vercel, Supabase database/Auth/functions, and R2 media storage.
- Inventory source formats and measure representative conversion time, derivative size, and videos per disc.
- Inventory representative discs and create several real catalogue entries.
- Produce and serve one real video derivative; verify playback, seeking, aspect ratio, and mobile behaviour.
- Establish database migrations, an invite-only browser admin, and privileged Supabase functions; prove draft → preview → publish → static rebuild → live.
- Export a sample watch route, DVD route, and catalogue from one snapshot; confirm the homepage chooses different videos across fresh loads without a random-video endpoint.

### 2. Apply the confirmed visual direction

- Collect the TVM logo and selected brand assets from the main site; save local copies and record source URLs.
- Identified logo source: [TVM red logo](https://images.squarespace-cdn.com/content/v1/63e86025e579fc1e268f9b95/4eda0d30-97f3-42ee-9aa4-164d81662a9c/tvmred.png?format=1500w).
- Build desktop/mobile homepage mockups with Internet Archive functionality and CKUT UI. Add subtle Elliot Mairet influence through image composition and spacing, then check that the overall interface still follows CKUT.
- Use real footage, thumbnails, and disc labels; settle the available fonts, spacing, and TVM red emphasis.

### 3. Build the core archive

- Implement the Supabase catalogue schema, access policies, private admin, and local conversion/import workflow.
- Build browser-side random selection, featured playback, shuffle, catalogue search, filters, sorting, grid/list switching, and DVD browsing.
- Add watch pages and collection pages with stable shareable links.
- Add loading, empty, missing-video, and playback-error states.
- Render navigation, watch-page content, and collection context at build time; isolate player controls, catalogue interactions, and browser admin in client components.

### 4. Prepare the first release

- Load the initial real catalogue through the repeatable ingestion process.
- Validate links, media objects, and metadata; confirm draft data stays out of exported files and public browsing.
- Verify that anonymous and non-admin users cannot edit records, obtain upload permissions, or preview private drafts. Check direct requests as well as the visible admin interface.
- Check Chrome, Firefox, Safari, and a real mobile device, including blocked autoplay and slow connections.
- Verify keyboard access, reduced motion, URL filter restoration, sort/view controls, unknown dates, and 4:3 footage.
- Run the project's lint and production build checks after implementation.
- Serve `out/` with a plain static file server and verify direct watch/DVD URLs, refreshes, and the 404 page. Confirm public browsing makes no request to a Next.js runtime or Supabase database.
- Check new publication, metadata edits, unpublishing, failed builds, and retries; verify the admin distinguishes pending changes from the deployed catalogue revision.
- Document ingesting the next DVD, correcting metadata, and updating the deployment.

## First-release acceptance criteria

- The public archive builds to static files in `out/` and works on static hosting; watch and DVD routes are generated at build time.
- A fresh homepage load selects a published, playable video in the browser from the exported catalogue.
- Visitors can watch, pause, seek, enable sound, use fullscreen, and select another random video.
- Search and archive exploration appear below the player and work on desktop and mobile.
- Each video has a stable URL and can be traced back to its source DVD.
- The site provides Internet Archive-style functionality through a CKUT-inspired UI with TVM branding; Elliot Mairet contributes a subtle influence on image presentation.
- All frontend interactions use HTML/CSS/React; the project includes no Three.js or WebGL UI.
- The next DVD can be processed and added through a documented workflow without changing UI code.
- Authorized admins can manage metadata, preview drafts, and trigger publication/rebuild through the browser; unauthorized users cannot perform these operations.
- Successful rebuilds update the public catalogue and generated routes together; deployment failures are visible and retryable.
- Mixed source formats have a documented conversion path, with failed imports visible and retryable.
- Media files are delivered from R2; credentials remain outside browser bundles and the repository.

## Remaining product decisions

- Should videos play from the beginning, or should the homepage preview start at a curated moment?
- Should playback continue to another random video when one ends?
- Should catalogue visitors be able to download playback copies?
- Is the archive public immediately, and which domain will host it?
- Should whole-disc programmes and individually extracted films both appear in search?
