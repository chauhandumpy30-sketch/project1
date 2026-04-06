const { randomUUID } = require("crypto");
const { preflight, respond, readJsonFile, writeJsonFile, sanitizeName, clamp, normalizeLeaderboard } = require("./shared");

exports.handler = async (event) => {
  const cors = preflight(event);
  if (cors) return cors;

  if (event.httpMethod !== "POST") {
    return respond(405, { error: "Method not allowed" });
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const name = sanitizeName(body.name || "Anonymous");
    const score = Number(body.score);
    const totalQuestions = clamp(Number(body.totalQuestions) || 0, 1, 20);
    const mode = "curated";

    if (!Number.isFinite(score) || score < 0) {
      return respond(400, { error: "Valid score is required" });
    }

    const leaderboard = readJsonFile("quiz-leaderboard.json", []);
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
    writeJsonFile("quiz-leaderboard.json", sorted);

    const topTen = sorted.slice(0, 10);
    const rank = topTen.findIndex((e) => e.id === savedEntry.id);

    return respond(201, {
      saved: true,
      entry: sorted.find((e) => e.id === savedEntry.id) || savedEntry,
      rank: rank >= 0 ? rank + 1 : null,
      leaderboard: topTen,
    });
  } catch (err) {
    console.error("Leaderboard write error:", err);
    return respond(500, { error: "Unable to save score" });
  }
};
