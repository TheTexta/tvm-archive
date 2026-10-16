import { test } from "node:test";
import assert from "node:assert/strict";
import { contactDraft } from "../lib/contact.ts";

test("contact drafts include the exact recording, disc, stable link, and contributor message without corrupting URL fields", () => {
  const video = {
    id: "DVD-001",
    title: "Campus & city",
    slug: "campus-city",
    year: null,
  };
  const draft = contactDraft(video, "Disc A & B", {
    name: " Alex ",
    email: " alex@example.com ",
    message: "A correction & a credit\nSecond line? Yes.",
    origin: "https://archive.example.com",
  });
  const url = new URL(draft.href);
  assert.equal(url.pathname, "hello@tvmtelevision.com");
  assert.equal(
    url.searchParams.get("subject"),
    "Archive information: Campus & city (DVD-001)",
  );
  assert.equal(url.searchParams.get("body"), draft.body);
  assert.match(draft.body, /Year: Undated\nSource: Disc A & B/);
  assert.match(
    draft.body,
    /Watch page: https:\/\/archive.example.com\/watch\/campus-city\//,
  );
  assert.match(draft.body, /From: Alex\nEmail: alex@example.com/);
  assert.ok(draft.body.endsWith("A correction & a credit\nSecond line? Yes."));
});
