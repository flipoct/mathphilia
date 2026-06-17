module.exports = function handler(req, res) {
  const SITE_URL = process.env.SITE_URL || "https://mathphilia.com";
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.status(200).end(
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml`
  );
};