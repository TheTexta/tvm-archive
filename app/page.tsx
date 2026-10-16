import { ArchiveHome } from "@/components/archive-home";
import { catalogue } from "@/lib/catalogue";

export default function Home() {
  return <ArchiveHome videos={catalogue.videos} />;
}
