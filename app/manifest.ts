import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LabPass",
    short_name: "LabPass",
    description: "Book idle labs, rooms and equipment from any department.",
    start_url: "/browse",
    display: "standalone",
    background_color: "#f1e43c",
    theme_color: "#f1e43c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
