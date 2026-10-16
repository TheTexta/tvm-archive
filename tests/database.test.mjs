import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("archive migration isolates existing data, enforces admin access, and exports published records only", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
   create role anon; create role authenticated; create role service_role bypassrls;
   create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to authenticated;
   create table public.photographs(id integer primary key, title text);
   insert into public.photographs values(1,'Existing gallery record');
   insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
  `);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610010001_tvm_archive.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.equal(
      (await db.query("select title from public.photographs")).rows[0].title,
      "Existing gallery record",
    );
    await db.exec(`insert into public.tvm_admin_users values('00000000-0000-0000-0000-000000000001');
   insert into public.tvm_videos(id,slug,title,source,status,ready,playback_key) values
    ('1','published','Public film','{"type":"mp4","url":"/media/test.mp4"}','published',true,'staging/private'),
    ('2','draft','Private draft','{"type":"mp4","url":"/media/test.mp4"}','draft',true,'staging/private'),
    ('3','unfinished','Not ready','{"type":"mp4","url":"/media/test.mp4"}','published',false,'staging/private');
   set role authenticated;
   select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
  `);
    assert.equal(
      (await db.query("select public.tvm_is_admin() as allowed")).rows[0]
        .allowed,
      false,
    );
    assert.equal(
      (await db.query("select * from public.tvm_videos")).rows.length,
      0,
    );
    await assert.rejects(
      db.exec(
        `insert into public.tvm_dvds(slug,label) values('unauthorized','Unauthorized')`,
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.query("select public.tvm_export_catalogue()"),
      /permission denied/,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);`,
    );
    assert.equal(
      (await db.query("select public.tvm_is_admin() as allowed")).rows[0]
        .allowed,
      true,
    );
    assert.equal(
      (await db.query("select * from public.tvm_videos")).rows.length,
      3,
    );
    await db.exec(
      `insert into public.tvm_dvds(slug,label) values('authorized','Authorized'); reset role; set role anon;`,
    );
    await assert.rejects(
      db.query("select * from public.tvm_videos"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.tvm_export_catalogue()"),
      /permission denied/,
    );
    await db.exec("reset role; set role service_role;");
    const snapshot = (
      await db.query("select public.tvm_export_catalogue() as snapshot")
    ).rows[0].snapshot;
    assert.deepEqual(
      snapshot.videos.map((v) => v.id),
      ["1"],
    );
    assert.ok(!("playback_key" in snapshot.videos[0]));
    assert.ok(!("status" in snapshot.videos[0]));
    assert.ok(!("ready" in snapshot.videos[0]));
  } finally {
    await db.close();
  }
});
