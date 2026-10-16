"use client";
import { useState } from "react";
import { Icon } from "./icon";
export function ShareButton() {
  const [status, setStatus] = useState("");
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("Link copied");
    } catch {
      setStatus("Link not copied. Use the address bar.");
    }
  }
  return (
    <div>
      <button
        className="border-line hover:bg-ink inline-flex items-center justify-between gap-6 border bg-transparent px-4.5 py-3.25 text-xs hover:text-white"
        onClick={share}
      >
        Copy link <Icon name="arrow" size={16} />
      </button>
      <div className="text-muted mt-3.75 text-xs leading-relaxed" role="status">
        {status}
      </div>
    </div>
  );
}
