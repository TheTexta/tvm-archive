import type { Metadata } from "next";
import { Tinos } from "next/font/google";
import "./globals.css";
import { Header, Footer } from "@/components/site-shell";
import { MotionProvider } from "@/components/motion-provider";

const tinos = Tinos({
  variable: "--font-tinos",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  fallback: ["Georgia"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: {
    default: "TVM Archive — Student television at McGill",
    template: "%s · TVM Archive",
  },
  description: "Student television recordings from TVM at McGill.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${tinos.variable} selection:bg-brand h-full scroll-pt-5 antialiased selection:text-white`}
    >
      <body className="bg-paper text-ink min-h-full font-sans">
        <MotionProvider>
          <a
            className="bg-ink fixed -top-20 left-5 z-100 p-3.75 text-white focus:top-3.75"
            href="#main"
          >
            Skip to content
          </a>
          <Header />
          {children}
          <Footer />
        </MotionProvider>
      </body>
    </html>
  );
}
