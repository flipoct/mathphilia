const fs = require("fs/promises");
const path = require("path");

const BLOB_PATH = "data/about.json";
const LOCAL_DATA_PATH = path.join(process.cwd(), "data", "about.json");

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const about = await readAbout();
      return res.status(200).json(about);
    }

    if (req.method !== "PUT") {
      res.setHeader("Allow", "GET, PUT");
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!isAuthorized(req)) {
      return res.status(401).json({ error: "비밀번호가 맞지 않습니다." });
    }

    const body = await readJson(req);
    const intro = normalizeIntro(body.intro);
    const members = normalizeMembers(body.members);
    await writeAbout({ intro, members });
    return res.status(200).json({ intro, members });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

async function readAbout() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { list } = await import("@vercel/blob");
    const result = await list({ prefix: BLOB_PATH, limit: 1 });
    const blob = result.blobs.find((item) => item.pathname === BLOB_PATH);
    if (blob) {
      const response = await fetch(`${blob.url}?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        return normalizeAbout(data);
      }
    }
  }

  const raw = await fs.readFile(LOCAL_DATA_PATH, "utf8");
  const data = JSON.parse(raw);
  return normalizeAbout(data);
}

async function writeAbout(about) {
  const payload = JSON.stringify(normalizeAbout(about), null, 2);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    await put(BLOB_PATH, payload, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
    return;
  }

  if (process.env.VERCEL) {
    throw new Error("Vercel Blob 저장소가 연결되지 않았습니다.");
  }

  await fs.writeFile(LOCAL_DATA_PATH, `${payload}\n`, "utf8");
}

function normalizeAbout(about) {
  return {
    intro: normalizeIntro(about?.intro),
    members: normalizeMembers(about?.members),
  };
}

function normalizeIntro(intro) {
  return String(intro || "").trim();
}

function normalizeMembers(members) {
  return Array.isArray(members)
    ? members
        .map((member) => ({
          cohort: String(member.cohort || "").trim(),
          name: String(member.name || "").trim(),
        }))
        .filter((member) => member.cohort || member.name)
    : [];
}

function isAuthorized(req) {
  const expected = process.env.BLOG_PASSWORD || "mathphilia";
  return req.headers["x-blog-password"] === expected;
}

function readJson(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") return Promise.resolve(JSON.parse(req.body || "{}"));

  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}
