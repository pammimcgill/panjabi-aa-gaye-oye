#!/usr/bin/env node
// Publish a REVIEWED Instagram manifest with the official Meta API.
// Requires Instagram Login publishing permission, secrets, and publicly reachable JPEGs.
import { readFile } from "node:fs/promises";

const slug = process.argv[2];
if (!slug || !/^[a-z0-9][a-z0-9-]{3,150}$/.test(slug)) {
  throw new Error("Usage: node scripts/instagram_publish.mjs <validated-comic-slug>");
}
const manifest = JSON.parse(await readFile("public/instagram/" + slug + "/manifest.json", "utf8"));
if (manifest.slug !== slug || manifest.instagram_account !== "5abiaagayeoye") {
  throw new Error("Unexpected Instagram manifest");
}
if (!Array.isArray(manifest.images) || manifest.images.length < 2 || manifest.images.length > 10) {
  throw new Error("Instagram carousel must have 2 to 10 slides");
}
for (const image of manifest.images) {
  const expected = "https://panjabiaagayeoye.com/instagram/" + slug + "/";
  if (!image.url.startsWith(expected) || !/^slide-[0-9]+\.jpg$/.test(image.file) ||
      image.url !== expected + image.file) {
    throw new Error("Invalid hosted JPEG URL in manifest");
  }
}
const dryRun = process.env.DRY_RUN === "1";
console.log("Instagram carousel:", manifest.title, "slides:", manifest.images.length);
if (dryRun) {
  console.log("DRY RUN ONLY. Caption:\n" + manifest.caption);
  for (const image of manifest.images) console.log(image.url);
  process.exit(0);
}
const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
const userId = process.env.INSTAGRAM_USER_ID;
const githubToken = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
if (!accessToken || !userId || !githubToken || !repo) {
  throw new Error("Missing Meta Instagram credentials or GitHub Actions token; no post attempted");
}
if (!/^[0-9]+$/.test(userId) || !/^[0-9]+$/.test(String(manifest.issue_number))) {
  throw new Error("Invalid account or article ID");
}
const apiVersion = process.env.INSTAGRAM_API_VERSION || "v27.0";
if (!/^v[0-9]+\.[0-9]+$/.test(apiVersion)) throw new Error("Invalid Meta API version");
const base = "https://graph.instagram.com/" + apiVersion;
const marker = "[instagram-published:" + slug + "]";

async function githubRequest(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: "Bearer " + githubToken, Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28", ...(init.headers || {}) },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error("GitHub API failure: " + response.status);
  return payload;
}

const issueUrl = "https://api.github.com/repos/" + repo + "/issues/" + manifest.issue_number;
let found = false;
for (let page = 1; page <= 10; page++) {
  const comments = await githubRequest(issueUrl + "/comments?per_page=100&page=" + page);
  if (comments.some((comment) => comment.body?.includes(marker))) found = true;
  if (comments.length < 100 || found) break;
}
if (found) {
  console.log("Already posted; found publication ledger on GitHub issue. Skipping.");
  process.exit(0);
}

// Also check the latest Instagram posts to guard against a post that succeeded
// but whose GitHub issue-comment ledger write failed.
async function meta(path, params = {}, method = "POST") {
  const form = new URLSearchParams({ ...params, access_token: accessToken });
  const url = base + path + (method === "GET" ? "?" + form.toString() : "");
  const result = await fetch(url, method === "POST" ?
    { method: "POST", body: form } : { method: "GET" });
  const json = await result.json();
  if (!result.ok || json.error) {
    throw new Error("Meta API error " + result.status + ": " + (json.error?.message || "Unknown response"));
  }
  return json;
}

const recent = await meta("/" + userId + "/media", {fields:"id,caption", limit:"100"}, "GET");
const uniqueText = "Story #" + manifest.issue_number + " · AI-assisted";
if (recent.data?.some((post) => post.caption?.includes(uniqueText))) {
  console.log("This comic appears in recent Instagram posts; skipping duplicate.");
  process.exit(0);
}

for (const item of manifest.images) {
  const response = await fetch(item.url, { method: "GET" });
  if (!response.ok || !response.headers.get("content-type")?.includes("image/jpeg")) {
    throw new Error("Public slide unavailable or not JPEG: " + item.url);
  }
  await response.body?.cancel();
}
const children = [];
for (const image of manifest.images) {
  const child = await meta("/" + userId + "/media", {
    image_url: image.url, is_carousel_item: "true",
  });
  if (!child.id) throw new Error("Meta did not return a slide container ID");
  children.push(child.id);
}
const carousel = await meta("/" + userId + "/media", {
  media_type: "CAROUSEL",
  children: children.join(","),
  caption: manifest.caption,
  is_ai_generated: "true",
});
if (!carousel.id) throw new Error("Meta did not return a carousel container ID");
let ready = false;
for (let attempts = 0; attempts < 20; attempts++) {
  const status = await meta("/" + carousel.id, {fields:"status_code"}, "GET");
  if (status.status_code === "FINISHED") { ready = true; break; }
  if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
    throw new Error("Meta rejected the carousel: " + status.status_code);
  }
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
if (!ready) throw new Error("Carousel was not ready; nothing published");
const published = await meta("/" + userId + "/media_publish", { creation_id: carousel.id });
if (!published.id) throw new Error("Meta publish response did not contain a media ID");
console.log("Instagram published media ID: " + published.id);
await githubRequest(issueUrl + "/comments", {
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body: JSON.stringify({body: marker + "\nInstagram carousel published by GitHub Actions. Media ID: " +
    published.id + "\nSource: " + manifest.source_url}),
});
console.log("Publication recorded on history issue #" + manifest.issue_number);
