"use client";

import { useRef, useState, type FormEvent } from "react";
import type { Video } from "@/lib/catalogue";
import { contactDraft, recordingDetails } from "@/lib/contact";
import { Icon } from "./icon";
import { getSupabase } from "@/lib/supabase";

export function RecordingContact({
  video,
  dvdLabel,
}: {
  video: Video;
  dvdLabel?: string;
}) {
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const element = event.currentTarget;
    const data = new FormData(event.currentTarget);
    setStatus("");
    setSending(true);
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Contact is not configured.");
      const { data: saved, error } = await supabase.rpc("tvm_submit_contact", {
        p_video_id: video.id,
        p_name: String(data.get("name") || ""),
        p_email: String(data.get("email") || ""),
        p_message: String(data.get("message") || ""),
      });
      if (error || !saved) throw error || new Error("Message was not saved.");
      element.reset();
      setStatus("Message saved for review.");
    } catch {
      setStatus(
        "Message not saved. Your text is still here; try again or email TVM.",
      );
    } finally {
      setSending(false);
    }
  }
  function emailInstead() {
    if (!form.current) return;
    const data = new FormData(form.current);
    const draft = contactDraft(video, dvdLabel, {
      name: String(data.get("name") || ""),
      email: String(data.get("email") || ""),
      message: String(data.get("message") || ""),
      origin: window.location.origin,
    });
    window.location.href = draft.href;
  }
  return (
    <section
      id="contact"
      className="border-soft-line max-tablet:grid-cols-1 max-tablet:gap-5.5 mt-12 grid scroll-mt-6 grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] gap-10 border-t pt-7"
      aria-labelledby="contact-title"
      tabIndex={-1}
    >
      <div>
        <h2
          id="contact-title"
          className="mt-0 mb-3.5 text-[clamp(25px,3vw,36px)] leading-none font-medium tracking-tighter"
        >
          Add information
        </h2>
      </div>
      <form
        ref={form}
        onSubmit={submit}
        className="max-xs:grid-cols-1 [&_input]:border-soft-line [&_textarea]:border-soft-line [&_textarea[readonly]]:bg-panel-alt grid min-w-0 grid-cols-2 gap-4.5 [&_input]:w-full [&_input]:rounded-none [&_input]:border [&_input]:bg-transparent [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-base [&_input]:leading-normal [&_label]:flex [&_label]:min-w-0 [&_label]:flex-col [&_label]:gap-2 [&_label]:text-base [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-none [&_textarea]:border [&_textarea]:bg-transparent [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:text-base [&_textarea]:leading-normal"
        aria-busy={sending}
      >
        <label className="col-span-full">
          Recording
          <textarea
            name="recording"
            value={recordingDetails(video, dvdLabel)}
            readOnly
            rows={4}
          />
        </label>
        <label>
          Your name
          <input
            name="name"
            autoComplete="name"
            required
            maxLength={100}
            disabled={sending}
          />
        </label>
        <label>
          Your email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            disabled={sending}
          />
        </label>
        <label className="col-span-full">
          Message
          <textarea
            name="message"
            required
            rows={5}
            maxLength={5000}
            disabled={sending}
          />
        </label>
        <div className="max-xs:flex-col max-xs:items-start max-xs:gap-3 col-span-full flex items-center gap-4.5">
          <button
            className="border-brand bg-brand hover:bg-ink inline-flex shrink-0 items-center justify-between gap-6 border px-4.5 py-3.25 text-xs text-white"
            type="submit"
            disabled={sending}
          >
            {sending ? "Sending…" : "Send to archive"}{" "}
            <Icon name="arrow" size={16} />
          </button>
          <button
            className="border-line hover:bg-ink inline-flex shrink-0 items-center justify-between gap-6 border bg-transparent px-4.5 py-3.25 text-xs hover:text-white"
            type="button"
            onClick={emailInstead}
            disabled={sending}
          >
            Email TVM <Icon name="diagonal" size={16} />
          </button>
        </div>
        <p
          className="text-muted col-span-full m-0 text-base leading-relaxed empty:hidden"
          role="status"
        >
          {status}
        </p>
      </form>
    </section>
  );
}
