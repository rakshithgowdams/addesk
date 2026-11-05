import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AdDesk by MyDesignNexus",
    short_name: "AdDesk",
    description: "Submit Instagram posts and track Meta ad requests.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f7f7",
    theme_color: "#123f3d",
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
