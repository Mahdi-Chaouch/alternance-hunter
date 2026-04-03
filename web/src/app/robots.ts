import type { MetadataRoute } from "next";

const SITE_URL = "https://alternance-hunter.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/mentions-legales", "/cgu", "/confidentialite"],
        disallow: ["/dashboard", "/profil", "/admin", "/explorer", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
