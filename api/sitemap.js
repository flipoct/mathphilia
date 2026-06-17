const fs = require("fs/promises");
const path = require("path");

const BLOB_PATH = "data/posts.json";
const LOCAL_DATA_PATH = path.join(process.cwd(), "data", "posts.json");

// ⚠️ 배포된 실제 도메인으로 변경하세요
const SITE_URL = process.env.SITE_URL || "https://mathphilia.vercel.app";

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const posts = await readPosts();

    const staticUrls = [
      { loc: SITE_URL, priority: "1.0", changefreq: "daily" },
    ];

    const postUrls = posts.map((post) => ({
      loc: `${SITE_URL}/posts/${post.id}`,
      lastmod: post.createdAt,
      priority: "0.8",
      changefreq: "monthly",
    }));

    const allUrls = [...staticUrls, ...postUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    // 10분 캐시 (CDN), 1분 캐시 (브라우저) — 포스트 추가 후 곧 반영됨
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=60");
    return res.status(200).end(xml);
  } catch (error) {
    console.error("Sitemap generation error:", error);
    return res.status(500).end("Failed to generate sitemap");
  }
};

async function readPosts() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { list } = await import("@vercel/blob");
    const result = await list({ prefix: BLOB_PATH, limit: 1 });
    const blob = result.blobs.find((item) => item.pathname === BLOB_PATH);
    if (blob) {
      const response = await fetch(`${blob.url}?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data.posts) ? data.posts : [];
      }
    }
  }

  const raw = await fs.readFile(LOCAL_DATA_PATH, "utf8");
  const data = JSON.parse(raw);
  return Array.isArray(data.posts) ? data.posts : [];
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
