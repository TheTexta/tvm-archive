import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attemptAutoplay,
  readAudioPreference,
  saveAudioPreference,
  AUDIO_PREFERENCE_KEY,
} from "../lib/playback.ts";

const denied = () =>
  Object.assign(new Error("User interaction required"), {
    name: "NotAllowedError",
  });

test("sound is tried first; browser-required muting does not replace the viewer's preference", async () => {
  saveAudioPreference({ muted: false, volume: 0.6 });
  const attempts = [];
  let fallback = 0;
  const media = {
    muted: false,
    async play() {
      attempts.push(this.muted);
      if (!this.muted) throw denied();
    },
  };
  const started = await attemptAutoplay(media, () => {
    fallback++;
  });
  assert.equal(started, true);
  assert.deepEqual(attempts, [false, true]);
  assert.equal(fallback, 1);
  assert.deepEqual(readAudioPreference(), { muted: false, volume: 0.6 });
});

test("a viewer's mute choice stays muted and is not retried indefinitely when playback is blocked", async () => {
  let calls = 0;
  const media = {
    muted: true,
    async play() {
      calls++;
      throw denied();
    },
  };
  const started = await attemptAutoplay(media, () =>
    assert.fail("Already muted"),
  );
  assert.equal(started, false);
  assert.equal(calls, 1);
  assert.equal(media.muted, true);
});

test("media errors and cancelled videos do not cause policy fallback", async () => {
  for (const [name, active] of [
    ["NotSupportedError", true],
    ["AbortError", true],
    ["NotAllowedError", false],
  ]) {
    const media = {
      muted: false,
      async play() {
        throw Object.assign(new Error("Playback failed"), { name });
      },
    };
    const started = await attemptAutoplay(
      media,
      () => assert.fail("Unexpected mute"),
      () => active,
    );
    assert.equal(started, false);
    assert.equal(media.muted, false);
  }
});

test("mute and volume survive a new player, including when browser storage is restricted", () => {
  const entries = new Map();
  globalThis.localStorage = {
    getItem: (key) => entries.get(key) || null,
    setItem: (key, value) => entries.set(key, value),
  };
  try {
    saveAudioPreference({ muted: true, volume: 0.4 });
    assert.deepEqual(readAudioPreference(), { muted: true, volume: 0.4 });
    assert.deepEqual(JSON.parse(entries.get(AUDIO_PREFERENCE_KEY)), {
      muted: true,
      volume: 0.4,
    });
    entries.set(AUDIO_PREFERENCE_KEY, '{"muted":false,"volume":9}');
    assert.deepEqual(readAudioPreference(), { muted: true, volume: 0.4 });
    globalThis.localStorage = {
      getItem() {
        throw new Error("Storage disabled");
      },
      setItem() {
        throw new Error("Storage disabled");
      },
    };
    saveAudioPreference({ muted: false, volume: 0.8 });
    assert.deepEqual(readAudioPreference(), { muted: false, volume: 0.8 });
  } finally {
    delete globalThis.localStorage;
  }
});
