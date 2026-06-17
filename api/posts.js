const fs = require("fs/promises");
const path = require("path");

const BLOB_PATH = "data/posts.json";
const LOCAL_DATA_PATH = path.join(process.cwd(), "data", "posts.json");

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const posts = await readPosts();
      return res.status(200).json({ posts });
    }

    if (!isAuthorized(req)) {
      return res.status(401).json({ error: "비밀번호가 맞지 않습니다." });
    }

    const body = await readJson(req);
    const posts = await readPosts();

    if (req.method === "POST") {
      const post = sanitizePost({
        ...body,
        id: createNumericId(posts),
        createdAt: new Date().toISOString().slice(0, 10),
      });
      const nextPosts = sortPosts([post, ...posts]);
      await writePosts(nextPosts);
      return res.status(201).json({ post, posts: nextPosts });
    }

    if (req.method === "PUT") {
      const index = posts.findIndex((post) => post.id === body.id);
      if (index === -1) return res.status(404).json({ error: "글을 찾을 수 없습니다." });

      const post = sanitizePost({
        ...posts[index],
        title: body.title,
        author: body.author,
        body: body.body,
        tags: body.tags,
      });
      const nextPosts = sortPosts(posts.map((item) => (item.id === post.id ? post : item)));
      await writePosts(nextPosts);
      return res.status(200).json({ post, posts: nextPosts });
    }

    if (req.method === "DELETE") {
      const nextPosts = posts.filter((post) => post.id !== body.id);
      await writePosts(nextPosts);
      return res.status(200).json({ post: nextPosts[0] || null, posts: nextPosts });
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error" });
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
        return normalizePosts(data.posts);
      }
    }
  }

  const raw = await fs.readFile(LOCAL_DATA_PATH, "utf8");
  const data = JSON.parse(raw);
  return normalizePosts(data.posts);
}

async function writePosts(posts) {
  const payload = JSON.stringify({ posts: normalizePosts(posts) }, null, 2);

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

function isAuthorized(req) {
  const expected = process.env.BLOG_PASSWORD || "mathphilia";
  return req.headers["x-blog-password"] === expected;
}

function sanitizePost(input) {
  const title = String(input.title || "").trim();
  const body = String(input.body || "").trim();
  if (!title || !body) throw new Error("제목과 본문을 입력해야 합니다.");

  return {
    id: String(input.id || createId(title)).trim(),
    title,
    author: String(input.author || "").trim(),
    tags: Array.isArray(input.tags)
      ? input.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 8)
      : [],
    createdAt: String(input.createdAt || new Date().toISOString().slice(0, 10)).slice(0, 10),
    body,
  };
}

function normalizePosts(posts) {
  return sortPosts(
    Array.isArray(posts)
      ? posts
          .filter((post) => post && post.id && post.title && post.body)
          .map((post) => sanitizePost(post))
      : [],
  );
}

function sortPosts(posts) {
  return [...posts].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function createNumericId(posts) {
  const maxId = posts.reduce((max, post) => {
    const value = Number(post.id);
    return Number.isInteger(value) && value > max ? value : max;
  }, 0);
  return String(maxId + 1);
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
