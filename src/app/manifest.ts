import type { MetadataRoute } from "next";

/**
 * Web app manifest.
 *
 * `display: standalone` is what makes an installed Coursera open without browser
 * chrome, which is the point of installing it for offline study.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Coursera — learn something that sticks",
    short_name: "Coursera",
    description:
      "Structured courses, progress that follows you between devices, and lessons you can download for offline study.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#fbfdfc",
    theme_color: "#0E7C6B",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
