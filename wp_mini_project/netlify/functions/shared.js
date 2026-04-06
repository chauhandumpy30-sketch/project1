const path = require("path");
const fs = require("fs");

// In a Netlify bundled Lambda, __dirname is the function root (/var/task) and
// included_files land at __dirname/data. In local dev, __dirname is
// netlify/functions/ and data is two directories up at the project root.
const dataDir = (() => {
  const inBundle = path.join(__dirname, "data");
  try {
    if (fs.statSync(inBundle).isDirectory()) return inBundle;
  } catch (_) {}
  return path.resolve(__dirname, "../../data");
})();

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function preflight(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  return null;
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readJsonFile(filename, fallback) {
  const filePath = path.join(dataDir, filename);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

function writeJsonFile(filename, payload) {
  // Netlify Lambda has a read-only filesystem outside /tmp.
  // Use /tmp for ephemeral writes when the normal data dir is not writable.
  let filePath = path.join(dataDir, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  } catch (err) {
    if (err.code === "EROFS" || err.code === "EACCES" || err.code === "ENOENT") {
      const tmpPath = path.join("/tmp", filename);
      fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf8");
    } else {
      throw err;
    }
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeName(raw) {
  return String(raw || "Anonymous")
    .replace(/^\s*(?:[0-9]+[\.)\-\s]*)+/, "")
    .trim()
    .slice(0, 20) || "Anonymous";
}

function pickRandom(items, count) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function normalizeLeaderboard(entries) {
  const { randomUUID } = require("crypto");
  return [...entries]
    .filter((e) => Number.isFinite(Number(e.score)))
    .map((e) => ({
      id: e.id || randomUUID(),
      name: sanitizeName(e.name),
      score: Number(e.score),
      totalQuestions: Number(e.totalQuestions) || 0,
      mode: "curated",
      createdAt: e.createdAt || new Date().toISOString(),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseQuery(event) {
  return event.queryStringParameters || {};
}

module.exports = {
  CORS_HEADERS,
  preflight,
  respond,
  readJsonFile,
  writeJsonFile,
  clamp,
  sanitizeName,
  pickRandom,
  normalizeLeaderboard,
  haversineKm,
  parseQuery,
};
