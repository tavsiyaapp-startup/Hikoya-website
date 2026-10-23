import type { MetadataRoute } from "next";

// Web app manifest (served at /manifest.webmanifest): lets phones install
// Hikoya to the home screen and open it like an app, without the browser's
// address bar. Icons are generated from public/images/logo.png.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hikoya — hikoyalar oʻqish va yozish",
    short_name: "Hikoya",
    description: "Rus va oʻzbek tilidagi hikoyalarni oʻqish va chop etish platformasi.",
    lang: "uz",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F4F8",
    theme_color: "#5535A6",
    categories: ["books", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
