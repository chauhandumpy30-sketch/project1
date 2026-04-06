const { preflight, respond, readJsonFile, normalizeLeaderboard } = require("./shared");

exports.handler = async (event) => {
  const cors = preflight(event);
  if (cors) return cors;

  if (event.httpMethod !== "GET") {
    return respond(405, { error: "Method not allowed" });
  }

  try {
    const leaderboard = readJsonFile("quiz-leaderboard.json", []);
    const sorted = normalizeLeaderboard(leaderboard).slice(0, 10);
    return respond(200, { leaderboard: sorted });
  } catch (err) {
    console.error("Leaderboard read error:", err);
    return respond(500, { error: "Unable to load leaderboard" });
  }
};
