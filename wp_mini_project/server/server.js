import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import { mkdir, readFile, writeFile } from "fs/promises";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, "data");
const calculatorSourcesFile = path.join(dataDir, "calculator-sources.json");
const quizQuestionsFile = path.join(dataDir, "quiz-questions.json");
const quizLeaderboardFile = path.join(dataDir, "quiz-leaderboard.json");
const wastageReportsFile = path.join(dataDir, "wastage-reports.json");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();

const allowedOrigins = new Set([
  "https://aquasave1.vercel.app",
]);

function isAllowedLocalOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === "null" || isAllowedLocalOrigin(origin) || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(projectRoot));

app.get("/", (req, res) => {
  res.sendFile(path.join(projectRoot, "index.html"));
});

app.get("/api/test", (req, res) => {
  res.json({ status: "server working" });
});

app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

app.get("/api/calculator-metadata", async (req, res) => {
  try {
    const metadata = await readJsonFile(calculatorSourcesFile, {});
    res.json(metadata);
  } catch (error) {
    console.error("Calculator metadata error:", error);
    res.status(500).json({ error: "Unable to load calculator metadata" });
  }
});

app.get("/api/quiz/questions", async (req, res) => {
  try {
    const count = clamp(Number.parseInt(req.query.count, 10) || 10, 1, 10);
    const curatedQuestions = await readJsonFile(quizQuestionsFile, []);

    if (!Array.isArray(curatedQuestions) || !curatedQuestions.length) {
      return res.status(500).json({ error: "No quiz questions available" });
    }

    const questions = pickRandom(curatedQuestions, count);
    const mode = "curated";
    const notice = "Curated quiz questions are served by the backend API.";

    res.json({
      mode,
      notice,
      questions,
    });
  } catch (error) {
    console.error("Quiz question error:", error);
    res.status(500).json({ error: "Unable to load quiz questions" });
  }
});

app.get("/api/quiz/leaderboard", async (req, res) => {
  try {
    const leaderboard = await readJsonFile(quizLeaderboardFile, []);
    const sorted = normalizeLeaderboard(leaderboard).slice(0, 10);
    res.json({ leaderboard: sorted });
  } catch (error) {
    console.error("Leaderboard read error:", error);
    res.status(500).json({ error: "Unable to load leaderboard" });
  }
});

app.post("/api/quiz/submit-score", async (req, res) => {
  try {
    const name = sanitizeName(req.body?.name || "Anonymous");
    const score = Number(req.body?.score);
    const totalQuestions = clamp(Number(req.body?.totalQuestions) || 0, 1, 20);
    const mode = "curated";

    if (!Number.isFinite(score) || score < 0) {
      return res.status(400).json({ error: "Valid score is required" });
    }

    const leaderboard = await readJsonFile(quizLeaderboardFile, []);
    const savedEntry = {
      id: randomUUID(),
      name,
      score,
      totalQuestions,
      mode,
      createdAt: new Date().toISOString(),
    };
    leaderboard.push(savedEntry);

    const sorted = normalizeLeaderboard(leaderboard).slice(0, 25);
    await writeJsonFile(quizLeaderboardFile, sorted);

    const topTen = sorted.slice(0, 10);
    const rank = topTen.findIndex((entry) => entry.id === savedEntry.id);

    res.status(201).json({
      saved: true,
      entry: sorted.find((entry) => entry.id === savedEntry.id) || savedEntry,
      rank: rank >= 0 ? rank + 1 : null,
      leaderboard: topTen,
    });
  } catch (error) {
    console.error("Leaderboard write error:", error);
    res.status(500).json({ error: "Unable to save score" });
  }
});

app.get("/api/wastage-reports", async (req, res) => {
  try {
    const lat = Number.parseFloat(req.query.lat);
    const lng = Number.parseFloat(req.query.lng);
    const radiusKm = clamp(Number.parseFloat(req.query.radiusKm) || 5, 1, 50);

    const localReports = await readJsonFile(wastageReportsFile, []);
    const externalReports = await getExternalWastageReports();
    const combinedReports = [...localReports, ...externalReports].map((report) => ({
      ...report,
      distanceKm:
        Number.isFinite(lat) && Number.isFinite(lng)
          ? haversineKm(lat, lng, Number(report.lat), Number(report.lng))
          : null,
    }));

    const filteredReports = combinedReports
      .filter((report) => Number.isFinite(Number(report.lat)) && Number.isFinite(Number(report.lng)))
      .filter((report) => report.distanceKm === null || report.distanceKm <= radiusKm)
      .sort((left, right) => (left.distanceKm ?? Number.MAX_SAFE_INTEGER) - (right.distanceKm ?? Number.MAX_SAFE_INTEGER));

    res.json({
      reports: filteredReports,
      meta: {
        radiusKm,
        total: filteredReports.length,
        localCount: localReports.length,
        externalCount: externalReports.length,
      },
    });
  } catch (error) {
    console.error("Wastage reports read error:", error);
    res.status(500).json({ error: "Unable to load nearby reports" });
  }
});

app.post("/api/wastage-reports", async (req, res) => {
  try {
    const type = String(req.body?.type || "").trim();
    const description = String(req.body?.description || "").trim();
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);

    if (!type || !description) {
      return res.status(400).json({ error: "Type and description are required" });
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "Valid latitude and longitude are required" });
    }

    const reports = await readJsonFile(wastageReportsFile, []);
    const report = {
      id: randomUUID(),
      type,
      description,
      lat,
      lng,
      source: "Community report",
      status: "Open",
      createdAt: new Date().toISOString(),
    };

    reports.push(report);
    await writeJsonFile(wastageReportsFile, reports);

    res.status(201).json({ saved: true, report });
  } catch (error) {
    console.error("Wastage report write error:", error);
    res.status(500).json({ error: "Unable to save report" });
  }
});

async function ensureDataStore() {
  await mkdir(dataDir, { recursive: true });
}

async function readJsonFile(filePath, fallback) {
  await ensureDataStore();
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function writeJsonFile(filePath, payload) {
  await ensureDataStore();
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function pickRandom(items, count) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy.slice(0, count);
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

function normalizeLeaderboard(entries) {
  return [...entries]
    .filter((entry) => Number.isFinite(Number(entry.score)))
    .map((entry) => ({
      id: entry.id || randomUUID(),
      name: sanitizeName(entry.name),
      score: Number(entry.score),
      totalQuestions: Number(entry.totalQuestions) || 0,
      mode: "curated",
      createdAt: entry.createdAt || new Date().toISOString(),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    });
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getExternalWastageReports() {
  if (!process.env.EXTERNAL_WASTAGE_FEED_URL) {
    return [];
  }

  try {
    const response = await fetch(process.env.EXTERNAL_WASTAGE_FEED_URL, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return normalizeExternalReports(payload);
  } catch (error) {
    console.error("External wastage feed error:", error);
    return [];
  }
}

function normalizeExternalReports(payload) {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => ({
        id: item.id || randomUUID(),
        type: item.type || item.category || "External report",
        description: item.description || item.title || "Imported from external feed",
        lat: Number(item.lat),
        lng: Number(item.lng),
        source: item.source || "External feed",
        status: item.status || "Open",
        createdAt: item.createdAt || new Date().toISOString(),
      }))
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
  }

  if (Array.isArray(payload?.features)) {
    return payload.features
      .map((feature) => ({
        id: feature.id || feature.properties?.id || randomUUID(),
        type: feature.properties?.type || feature.properties?.category || "External report",
        description: feature.properties?.description || feature.properties?.title || "Imported from external feed",
        lat: Number(feature.geometry?.coordinates?.[1]),
        lng: Number(feature.geometry?.coordinates?.[0]),
        source: feature.properties?.source || "External feed",
        status: feature.properties?.status || "Open",
        createdAt: feature.properties?.createdAt || new Date().toISOString(),
      }))
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
  }

  return [];
}

const PORT = process.env.PORT || 3000;

ensureDataStore().then(() => {
  app.listen(PORT, () => {
    console.log(`AquaSave server running on http://localhost:${PORT}`);
  });
});
