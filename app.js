const THEME_KEY = "mathphilia.theme.v2";
const API_URL = "/api/posts";
const ABOUT_API_URL = "/api/about";

const state = {
  posts: [],
  activeId: null,
  password: "",
  editingId: null,
  query: "",
  route: "home",
  loading: true,
  aboutIntro: "",
  members: [],
  aboutLoading: true,
  pendingUnlock: null,
  previewDraft: null,
};

const els = {
  html: document.documentElement,
  homeView: document.querySelector("#homeView"),
  postList: document.querySelector("#postList"),
  postCount: document.querySelector("#postCount"),
  postView: document.querySelector("#postView"),
  aboutView: document.querySelector("#aboutView"),
  aboutIntro: document.querySelector("#aboutIntro"),
  memberList: document.querySelector("#memberList"),
  searchInput: document.querySelector("#searchInput"),
  homeLogoButton: document.querySelector("#homeLogoButton"),
  aboutButton: document.querySelector("#aboutButton"),
  editAboutButton: document.querySelector("#editAboutButton"),
  writeButton: document.querySelector("#writeButton"),
  backButton: document.querySelector("#backButton"),
  passwordDialog: document.querySelector("#passwordDialog"),
  passwordForm: document.querySelector("#passwordForm"),
  passwordInput: document.querySelector("#passwordInput"),
  passwordError: document.querySelector("#passwordError"),
  cancelPassword: document.querySelector("#cancelPassword"),
  editorDialog: document.querySelector("#editorDialog"),
  editorForm: document.querySelector("#editorForm"),
  editorTitle: document.querySelector("#editorTitle"),
  closeEditor: document.querySelector("#closeEditor"),
  titleInput: document.querySelector("#titleInput"),
  authorInput: document.querySelector("#authorInput"),
  tagsInput: document.querySelector("#tagsInput"),
  bodyInput: document.querySelector("#bodyInput"),
  deleteButton: document.querySelector("#deleteButton"),
  previewButton: document.querySelector("#previewButton"),
  saveButton: document.querySelector("#saveButton"),
  editorError: document.querySelector("#editorError"),
  aboutDialog: document.querySelector("#aboutDialog"),
  aboutForm: document.querySelector("#aboutForm"),
  aboutIntroInput: document.querySelector("#aboutIntroInput"),
  membersInput: document.querySelector("#membersInput"),
  aboutError: document.querySelector("#aboutError"),
  cancelAbout: document.querySelector("#cancelAbout"),
  saveAboutButton: document.querySelector("#saveAboutButton"),
  themeToggleButton: document.querySelector("#themeToggleButton"),
};

init();

async function init() {
  bindEvents();
  applyTheme(getSavedTheme());
  syncRouteFromLocation();
  renderLoading();
  await Promise.all([loadPosts(), loadAbout()]);
  syncRouteFromLocation();
  render();
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    navigateHome({ replace: true });
  });

  els.writeButton.addEventListener("click", () => ensureUnlocked(() => openEditor()));
  els.backButton.addEventListener("click", () => navigateHome());
  els.homeLogoButton.addEventListener("click", () => navigateHome());
  els.aboutButton.addEventListener("click", () => navigateAbout());
  els.editAboutButton.addEventListener("click", () => ensureUnlocked(openAboutEditor));

  window.addEventListener("popstate", () => {
    syncRouteFromLocation();
    render();
  });

  els.passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await unlockWithPassword();
  });

  els.cancelPassword.addEventListener("click", () => {
    els.passwordInput.value = "";
    els.passwordError.textContent = "";
    state.pendingUnlock = null;
    els.passwordDialog.close();
  });

  els.closeEditor.addEventListener("click", () => els.editorDialog.close());

  els.editorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveCurrentPost();
  });

  els.deleteButton.addEventListener("click", deleteCurrentPost);
  els.previewButton.addEventListener("click", previewDraft);
  els.aboutForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveAbout();
  });
  els.cancelAbout.addEventListener("click", () => els.aboutDialog.close());

  els.themeToggleButton.addEventListener("click", () => {
    const nextTheme = els.html.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
  });
}

async function loadPosts() {
  state.loading = true;
  try {
    const response = await fetch(API_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("API unavailable");
    const data = await response.json();
    state.posts = normalizePosts(data.posts);
  } catch {
    const response = await fetch("/data/posts.json", { headers: { Accept: "application/json" } });
    const data = await response.json();
    state.posts = normalizePosts(data.posts);
  } finally {
    state.loading = false;
  }
}

async function loadAbout() {
  state.aboutLoading = true;
  try {
    const response = await fetch(ABOUT_API_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("About API unavailable");
    const data = await response.json();
    state.aboutIntro = normalizeAboutIntro(data.intro);
    state.members = normalizeMembers(data.members);
  } catch {
    const response = await fetch("/data/about.json", { headers: { Accept: "application/json" } });
    const data = await response.json();
    state.aboutIntro = normalizeAboutIntro(data.intro);
    state.members = normalizeMembers(data.members);
  } finally {
    state.aboutLoading = false;
  }
}

function normalizePosts(posts) {
  return Array.isArray(posts)
    ? posts
        .filter((post) => post && post.id && post.title && post.body)
        .map((post) => ({
          ...post,
          author: String(post.author || "").trim(),
          tags: Array.isArray(post.tags) ? post.tags : [],
        }))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    : [];
}

function normalizeAboutIntro(intro) {
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

function syncRouteFromLocation() {
  const match = window.location.pathname.match(/^\/posts\/([^/]+)\/?$/);
  if (match) {
    state.route = "post";
    state.activeId = decodeURIComponent(match[1]);
    return;
  }

  if (/^\/about\/?$/.test(window.location.pathname)) {
    state.route = "about";
    state.activeId = null;
    return;
  }

  state.route = "home";
  state.activeId = null;
}

function postUrl(id) {
  return `/posts/${encodeURIComponent(id)}`;
}

function navigateToPost(id, options = {}) {
  state.activeId = id;
  state.route = "post";
  const nextUrl = postUrl(id);
  if (window.location.pathname !== nextUrl) {
    history[options.replace ? "replaceState" : "pushState"]({}, "", nextUrl);
  }
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function navigateHome(options = {}) {
  state.route = "home";
  state.activeId = null;
  const nextUrl = "/";
  if (window.location.pathname !== nextUrl) {
    history[options.replace ? "replaceState" : "pushState"]({}, "", nextUrl);
  }
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function navigateAbout(options = {}) {
  state.route = "about";
  state.activeId = null;
  const nextUrl = "/about";
  if (window.location.pathname !== nextUrl) {
    history[options.replace ? "replaceState" : "pushState"]({}, "", nextUrl);
  }
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function filteredPosts() {
  if (!state.query) return state.posts;
  return state.posts.filter((post) => {
    const haystack = [post.title, post.author, post.body, ...post.tags].join(" ").toLowerCase();
    return haystack.includes(state.query);
  });
}

function renderLoading() {
  els.postList.innerHTML = `
    <div class="empty-state">
      <p>글을 불러오는 중입니다.</p>
    </div>
  `;
}

function render() {
  const posts = filteredPosts();
  els.postCount.textContent = state.query
    ? `검색 결과: ${posts.length}개`
    : `전체 글: ${posts.length}개`;
  renderList(posts);

  const activePost = state.posts.find((post) => post.id === state.activeId);
  if (state.route === "post" && activePost) {
    renderPost(activePost);
    els.homeView.hidden = true;
    els.postView.hidden = false;
    els.aboutView.hidden = true;
    els.backButton.hidden = false;
    document.title = `${activePost.title} | Mathphilia`;
    return;
  }

  if (state.route === "about") {
    renderAbout();
    els.homeView.hidden = true;
    els.postView.hidden = true;
    els.aboutView.hidden = false;
    els.backButton.hidden = false;
    document.title = "About Us | Mathphilia";
    return;
  }

  if (state.route === "post" && !state.loading) {
    renderNotFound();
    els.homeView.hidden = true;
    els.postView.hidden = false;
    els.aboutView.hidden = true;
    els.backButton.hidden = false;
    document.title = "글을 찾을 수 없습니다 | Mathphilia";
    return;
  }

  els.homeView.hidden = false;
  els.postView.hidden = true;
  els.aboutView.hidden = true;
  els.backButton.hidden = true;
  document.title = "Mathphilia";
}

function renderList(posts) {
  if (state.loading) {
    renderLoading();
    return;
  }

  if (!posts.length) {
    els.postList.innerHTML = `
      <div class="empty-state">
        <p>조건에 맞는 글이 없습니다.</p>
      </div>
    `;
    return;
  }

  els.postList.innerHTML = posts
    .map(
      (post) => `
        <button class="post-card" type="button" data-post-id="${post.id}">
          <span class="post-card-date">${formatDate(post.createdAt)}</span>
          <strong>${escapeHtml(post.title)}</strong>
          <span class="post-card-excerpt">${escapeHtml(excerpt(post.body))}</span>
          <span class="post-card-bottom">
            <span class="tag-row">${post.tags.map(renderTag).join("")}</span>
            ${post.author ? `<span class="post-card-author">${escapeHtml(post.author)}</span>` : ""}
          </span>
        </button>
      `,
    )
    .join("");

  els.postList.querySelectorAll("[data-post-id]").forEach((button) => {
    button.addEventListener("click", () => navigateToPost(button.dataset.postId));
  });
}

function renderPost(post) {
  const isPreview = post.id === "draft";
  els.postView.innerHTML = `
    <div class="post-meta">
      <span>${formatDate(post.createdAt)}</span>
      <span class="tag-row">${post.tags.map(renderTag).join("")}</span>
    </div>
    <div class="post-title-block">
      <h2>${escapeHtml(post.title)}</h2>
      <div class="post-title-tools">
        ${post.author ? `<span class="post-author">by ${escapeHtml(post.author)}</span>` : ""}
        ${
          isPreview
            ? `<button class="small-icon-button" id="returnToEditorButton" type="button" aria-label="편집으로 돌아가기" title="편집으로 돌아가기">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 14 4 9l5-5" />
                  <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
                </svg>
              </button>`
            : `<button class="small-icon-button" id="editPostButton" type="button" aria-label="수정" title="수정">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>`
        }
      </div>
    </div>
    <div class="post-body">${renderMarkdown(post.body)}</div>
  `;

  if (isPreview) {
    document.querySelector("#returnToEditorButton").addEventListener("click", returnToDraftEditor);
  } else {
    document.querySelector("#editPostButton").addEventListener("click", () => {
      state.editingId = post.id;
      ensureUnlocked(() => openEditor(post.id));
    });
  }
  renderMath(els.postView);
}

function renderNotFound() {
  els.postView.innerHTML = `
    <div class="empty-state">
      <p>글을 찾을 수 없습니다.</p>
    </div>
  `;
}

function renderAbout() {
  els.aboutIntro.innerHTML = escapeHtml(
    state.aboutIntro || "Mathphilia를 함께 만드는 사람들입니다.",
  ).replace(/\n/g, "<br>");

  if (state.aboutLoading) {
    els.memberList.innerHTML = `<div class="empty-state"><p>조원 정보를 불러오는 중입니다.</p></div>`;
    return;
  }

  if (!state.members.length) {
    els.memberList.innerHTML = `<div class="empty-state"><p>아직 등록된 조원이 없습니다.</p></div>`;
    return;
  }

  els.memberList.innerHTML = state.members
    .map(
      (member) => `
        <div class="member-row">
          <span class="member-cohort">${escapeHtml(member.cohort)}</span>
          <strong>${escapeHtml(member.name)}</strong>
        </div>
      `,
    )
    .join("");
}

function ensureUnlocked(callback) {
  if (state.password) {
    callback();
    return;
  }
  state.pendingUnlock = callback;
  els.passwordDialog.showModal();
  els.passwordInput.focus();
}

async function unlockWithPassword() {
  const password = els.passwordInput.value;
  els.passwordError.textContent = "";

  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) throw new Error("invalid");
    state.password = password;
    els.passwordInput.value = "";
    els.passwordDialog.close();
    const pendingUnlock = state.pendingUnlock;
    state.pendingUnlock = null;
    if (pendingUnlock) pendingUnlock();
  } catch {
    els.passwordError.textContent = "비밀번호가 맞지 않습니다.";
  }
}

function openEditor(id = null) {
  state.editingId = id;
  const post = state.posts.find((item) => item.id === id);
  els.editorTitle.textContent = post ? "글 수정" : "새 글";
  els.titleInput.value = post?.title ?? "";
  els.authorInput.value = post?.author ?? "";
  els.tagsInput.value = post?.tags.join(", ") ?? "";
  els.bodyInput.value = post?.body ?? "";
  els.deleteButton.hidden = !post;
  els.editorError.textContent = "";
  els.editorDialog.showModal();
  els.titleInput.focus();
}

function openDraftEditor() {
  const draft = state.previewDraft;
  if (!draft) return openEditor();

  state.editingId = draft.sourceId || null;
  els.editorTitle.textContent = draft.sourceId ? "글 수정" : "새 글";
  els.titleInput.value = draft.title;
  els.authorInput.value = draft.author;
  els.tagsInput.value = draft.tags.join(", ");
  els.bodyInput.value = draft.body;
  els.deleteButton.hidden = !draft.sourceId;
  els.editorError.textContent = "";
  els.editorDialog.showModal();
  els.titleInput.focus();
}

function openAboutEditor() {
  els.aboutIntroInput.value = state.aboutIntro;
  els.membersInput.value = state.members
    .map((member) => `${member.cohort}, ${member.name}`.replace(/^,\s*/, "").replace(/,\s*$/, ""))
    .join("\n");
  els.aboutError.textContent = "";
  els.aboutDialog.showModal();
  els.membersInput.focus();
}

async function saveAbout() {
  const intro = els.aboutIntroInput.value.trim();
  const members = els.membersInput.value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [cohort, ...nameParts] = line.split(",");
      return {
        cohort: (cohort || "").trim(),
        name: nameParts.join(",").trim(),
      };
    })
    .filter((member) => member.cohort || member.name);

  els.aboutError.textContent = "";
  els.saveAboutButton.disabled = true;
  try {
    const response = await fetch(ABOUT_API_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Blog-Password": state.password,
      },
      body: JSON.stringify({ intro, members }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "저장에 실패했습니다.");
    state.aboutIntro = normalizeAboutIntro(data.intro);
    state.members = normalizeMembers(data.members);
    els.aboutDialog.close();
    renderAbout();
  } catch (error) {
    els.aboutError.textContent = error.message;
  } finally {
    els.saveAboutButton.disabled = false;
  }
}

function returnToDraftEditor() {
  navigateHome({ replace: true });
  openDraftEditor();
}

async function saveCurrentPost() {
  const title = els.titleInput.value.trim();
  const body = els.bodyInput.value.trim();
  if (!title || !body) return;

  const payload = {
    title,
    author: els.authorInput.value.trim(),
    body,
    tags: els.tagsInput.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  };

  const method = state.editingId ? "PUT" : "POST";
  if (state.editingId) payload.id = state.editingId;

  await mutatePost(method, payload);
}

async function deleteCurrentPost() {
  if (!state.editingId) return;
  const post = state.posts.find((item) => item.id === state.editingId);
  if (!post || !confirm(`"${post.title}" 글을 삭제할까요?`)) return;

  await mutatePost("DELETE", { id: state.editingId });
}

async function mutatePost(method, payload) {
  els.editorError.textContent = "";
  els.saveButton.disabled = true;

  try {
    const response = await fetch(API_URL, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Blog-Password": state.password,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "저장에 실패했습니다.");
    }

    state.posts = normalizePosts(data.posts);
    state.activeId = data.post?.id ?? state.posts[0]?.id ?? null;
    els.editorDialog.close();
    if (state.activeId) navigateToPost(state.activeId, { replace: true });
    else navigateHome({ replace: true });
  } catch (error) {
    els.editorError.textContent = error.message;
  } finally {
    els.saveButton.disabled = false;
  }
}

function previewDraft() {
  const draft = {
    id: "draft",
    sourceId: state.editingId,
    title: els.titleInput.value.trim() || "제목 없음",
    author: els.authorInput.value.trim(),
    tags: els.tagsInput.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    createdAt: new Date().toISOString().slice(0, 10),
    body: els.bodyInput.value.trim() || "본문이 비어 있습니다.",
  };
  state.previewDraft = draft;
  els.editorDialog.close();
  history.replaceState({}, "", postUrl("draft"));
  state.route = "post";
  state.activeId = "draft";
  renderPost(draft);
  els.homeView.hidden = true;
  els.postView.hidden = false;
  els.backButton.hidden = false;
  document.title = `${draft.title} | Mathphilia`;
}

function renderTag(tag) {
  return `<span class="tag">${escapeHtml(tag)}</span>`;
}

function renderMarkdown(source) {
  const mathSegments = [];
  const protectedSource = source.replace(
    /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+\$)/g,
    (match) => {
      const token = `@@MATHPHILIA_MATH_${mathSegments.length}@@`;
      mathSegments.push(escapeHtml(match));
      return token;
    },
  );

  const lines = protectedSource.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(`<pre><code>${restoreMathTokens(escapeHtml(code.join("\n")), mathSegments)}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${formatInline(heading[2], mathSegments)}</h${level}>`);
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const tableLines = [lines[index], lines[index + 1]];
      index += 2;
      while (index < lines.length && /\|/.test(lines[index]) && lines[index].trim()) {
        tableLines.push(lines[index]);
        index += 1;
      }
      blocks.push(renderTable(tableLines, mathSegments));
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push(`<blockquote>${renderMarkdown(quote.join("\n"))}</blockquote>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const pattern = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*+]\s+/;
      const items = [];
      while (index < lines.length && pattern.test(lines[index])) {
        items.push(lines[index].replace(pattern, ""));
        index += 1;
      }
      const tag = ordered ? "ol" : "ul";
      blocks.push(`<${tag}>${items.map((item) => `<li>${formatInline(item, mathSegments)}</li>`).join("")}</${tag}>`);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(`<p>${paragraph.map((part) => formatInline(part, mathSegments)).join("<br>")}</p>`);
  }

  return blocks.join("\n");
}

function isBlockStart(lines, index) {
  return (
    /^```/.test(lines[index]) ||
    /^(#{1,6})\s+/.test(lines[index]) ||
    /^\s*>\s?/.test(lines[index]) ||
    /^\s*[-*+]\s+/.test(lines[index]) ||
    /^\s*\d+\.\s+/.test(lines[index]) ||
    isTableStart(lines, index)
  );
}

function isTableStart(lines, index) {
  return (
    index + 1 < lines.length &&
    /\|/.test(lines[index]) &&
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])
  );
}

function renderTable(lines, mathSegments) {
  const headers = splitTableRow(lines[0]);
  const rows = lines.slice(2).map(splitTableRow);
  return `
    <table>
      <thead><tr>${headers.map((cell) => `<th>${formatInline(cell, mathSegments)}</th>`).join("")}</tr></thead>
      <tbody>${rows
        .map((row) => `<tr>${row.map((cell) => `<td>${formatInline(cell, mathSegments)}</td>`).join("")}</tr>`)
        .join("")}</tbody>
    </table>
  `;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function formatInline(text, mathSegments) {
  let value = escapeHtml(text);
  value = value.replace(/`([^`]+)`/g, "<code>$1</code>");
  value = value.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  value = value.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  value = value.replace(/@@MATHPHILIA_MATH_(\d+)@@/g, (_, mathIndex) => {
    return mathSegments[Number(mathIndex)] || "";
  });
  return value;
}

function restoreMathTokens(value, mathSegments) {
  return value.replace(/@@MATHPHILIA_MATH_(\d+)@@/g, (_, mathIndex) => {
    return mathSegments[Number(mathIndex)] || "";
  });
}

function renderMath(target) {
  if (!window.renderMathInElement) return;
  window.renderMathInElement(target, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false },
      { left: "\\[", right: "\\]", display: true },
    ],
    throwOnError: false,
  });
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function excerpt(value) {
  return value
    .replace(/\$\$?[^$]+\$\$?/g, " ")
    .replace(/[#>*_`\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 110);
}

function applyTheme(choice) {
  const theme = choice === "dark" ? "dark" : "light";
  els.html.dataset.theme = theme;
  els.themeToggleButton.setAttribute(
    "aria-label",
    theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환",
  );
  els.themeToggleButton.setAttribute(
    "title",
    theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환",
  );
}

function getSavedTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;

  const initialTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
  localStorage.setItem(THEME_KEY, initialTheme);
  return initialTheme;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
