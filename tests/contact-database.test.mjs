import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("contact submissions persist canonical context; only invited admins can read and review the inbox", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
    `);
    for (const file of [
      "202610010001_tvm_archive.sql",
      "202610010002_tvm_contact_inbox.sql",
    ])
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(`
      insert into public.tvm_admin_users values('00000000-0000-0000-0000-000000000001');
      insert into public.tvm_dvds(slug,label) values('original-disc','Original disc label');
      insert into public.tvm_videos(id,slug,title,year,"dvdSlug",source,status,ready) values
        ('published','public-film','Film & campus',2008,'original-disc','{"type":"mp4","url":"/media/test.mp4"}','published',true),
        ('draft','draft-film','Private film',null,null,'{"type":"mp4","url":"/media/test.mp4"}','draft',true),
        ('unfinished','unfinished-film','Unfinished film',null,null,'{"type":"mp4","url":"/media/test.mp4"}','published',false);
      set role anon;
    `);
    const args = [
      "published",
      " Alex ",
      " alex@example.com ",
      " I recognise the director. ",
    ];
    const submit = (values = args) =>
      db.query("select public.tvm_submit_contact($1,$2,$3,$4) as id", values);
    const id = (await submit()).rows[0].id;
    assert.match(id, /^[a-f0-9-]{36}$/);
    for (const video of ["draft", "unfinished", "missing"])
      await assert.rejects(
        submit([video, ...args.slice(1)]),
        /no longer accepting submissions/,
      );
    for (const values of [
      ["published", " ", args[2], args[3]],
      ["published", args[1], "invalid", args[3]],
      ["published", args[1], args[2], " "],
      ["published", args[1], args[2], "x".repeat(5001)],
    ])
      await assert.rejects(
        submit(values),
        /Enter a name, valid email, and message/,
      );
    await assert.rejects(
      db.query("select * from public.tvm_contact_messages"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec("update public.tvm_contact_messages set reviewed_at = now()"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec(
        `insert into public.tvm_contact_messages(recording,name,email,message) values('{}','Bot','bot@example.com','Forged context')`,
      ),
      /permission denied/,
    );
    await db.exec(
      `reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);`,
    );
    assert.equal(
      (await db.query("select * from public.tvm_contact_messages")).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "update public.tvm_contact_messages set reviewed_at=now() returning id",
        )
      ).rows.length,
      0,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);`,
    );
    const saved = (await db.query("select * from public.tvm_contact_messages"))
      .rows[0];
    assert.equal(saved.name, "Alex");
    assert.equal(saved.email, "alex@example.com");
    assert.equal(saved.message, "I recognise the director.");
    assert.deepEqual(saved.recording, {
      id: "published",
      slug: "public-film",
      title: "Film & campus",
      year: 2008,
      dvdLabel: "Original disc label",
    });
    const reviewed = (
      await db.query(
        "update public.tvm_contact_messages set reviewed_at=now() where id=$1 returning *",
        [id],
      )
    ).rows[0];
    assert.ok(reviewed.reviewed_at);
    await assert.rejects(
      db.exec(
        "update public.tvm_contact_messages set message='Edited submission'",
      ),
      /permission denied/,
    );
    await db.query(
      "update public.tvm_contact_messages set reviewed_at=null where id=$1",
      [id],
    );
    assert.equal(
      (
        await db.query(
          "select count(*) as count from public.tvm_contact_messages where reviewed_at is null",
        )
      ).rows[0].count,
      1,
    );
    await db.exec(
      "reset role; update public.tvm_videos set title='Revised title' where id='published'; delete from public.tvm_videos where id='published';",
    );
    const preserved = (
      await db.query("select * from public.tvm_contact_messages")
    ).rows[0];
    assert.equal(preserved.video_id, null);
    assert.equal(preserved.recording.title, "Film & campus");
    const exported = (
      await db.query("select public.tvm_export_catalogue() as snapshot")
    ).rows[0].snapshot;
    assert.ok(!JSON.stringify(exported).includes("alex@example.com"));
    assert.ok(!JSON.stringify(exported).includes("I recognise the director"));
  } finally {
    await db.close();
  }
});
