import { ArchiveBrowser } from "@/components/archive-browser";
import { catalogue } from "@/lib/catalogue";
export const metadata = { title: "Browse the archive" };
export default function Archive() {
  return (
    <main id="main">
      <ArchiveBrowser videos={catalogue.videos} />
    </main>
  );
}
