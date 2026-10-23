import type { Metadata, Viewport } from "next";
import { Manrope, Kaushan_Script, Literata } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/ThemeProvider";
import { getServerTheme } from "@/lib/theme-server";
import { CookieConsent } from "@/components/layout/CookieConsent";
import { PwaRegister } from "@/components/layout/PwaRegister";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
});

// Display serif for page and section headings — a reading platform's voice.
// Variable weight + optical size; latin-ext/cyrillic cover Uzbek (ʻ) and Russian.
const literata = Literata({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-literata",
  axes: ["opsz"],
});

const kaushan = Kaushan_Script({
  subsets: ["latin"],
  variable: "--font-kaushan",
  weight: "400",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  return {
    title: t.meta.title,
    description: t.meta.description,
    // Installed on an iPhone home screen: opens full-screen, named Hikoya.
    appleWebApp: { capable: true, title: "Hikoya", statusBarStyle: "default" },
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}

// Browser bar colour on phones; viewport-fit=cover lets the reader's bottom
// bar sit above the iPhone home indicator (env(safe-area-inset-bottom)).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F4F8" },
    { media: "(prefers-color-scheme: dark)", color: "#14101F" },
  ],
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getServerLocale();
  const theme = await getServerTheme();
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang={locale} data-theme={theme} className={`${manrope.variable} ${literata.variable} ${kaushan.variable}`}>
      <body>
        <ThemeProvider initialTheme={theme}>
          <LocaleProvider initialLocale={locale}>
            {children}
            <CookieConsent />
            <PwaRegister />
          </LocaleProvider>
        </ThemeProvider>
      </body>
      {gaId && <GoogleAnalytics gaId={gaId} />}
    </html>
  );
}
