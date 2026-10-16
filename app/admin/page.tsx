import type { Metadata } from "next";

const adminUrl = "https://dextery.dev/admin";

export const metadata: Metadata = {
  title: "Archive admin",
  robots: { index: false, follow: false },
  alternates: { canonical: adminUrl },
};

export default function AdminPage() {
  return (
    <main
      id="main"
      className="max-tablet:px-6 max-xs:px-4.5 mx-auto min-h-[60vh] max-w-400 px-10.5 py-16"
    >
      <meta httpEquiv="refresh" content={`0; url=${adminUrl}`} />
      <h1 className="my-4 text-5xl font-medium tracking-tighter">
        Archive admin
      </h1>
      <a
        className="border-line hover:bg-ink mt-6 inline-flex border px-4.5 py-3.25 text-xs hover:text-white"
        href={adminUrl}
      >
        Open dextery.dev/admin
      </a>
    </main>
  );
}
