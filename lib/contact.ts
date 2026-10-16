type Recording = {
  id: string;
  title: string;
  year: number | null;
  slug: string;
};
export type ContactMessage = {
  id: string;
  created_at: string;
  video_id: string | null;
  recording: Recording & { dvdLabel: string | null };
  name: string;
  email: string;
  message: string;
  reviewed_at: string | null;
};

export function recordingDetails(video: Recording, dvdLabel?: string) {
  return [
    `Title: ${video.title}`,
    `Archive ID: ${video.id}`,
    `Year: ${video.year ?? "Undated"}`,
    `Source: ${dvdLabel || "TVM online"}`,
  ].join("\n");
}

export function contactDraft(
  video: Recording,
  dvdLabel: string | undefined,
  {
    name,
    email,
    message,
    origin,
  }: { name: string; email: string; message: string; origin: string },
) {
  const subject = `Archive information: ${video.title} (${video.id})`;
  const body = [
    recordingDetails(video, dvdLabel),
    `Watch page: ${new URL(`/watch/${video.slug}/`, origin).href}`,
    "",
    `From: ${name.trim()}`,
    `Email: ${email.trim()}`,
    "",
    message.trim(),
  ].join("\n");
  return {
    subject,
    body,
    href: `mailto:hello@tvmtelevision.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
}
