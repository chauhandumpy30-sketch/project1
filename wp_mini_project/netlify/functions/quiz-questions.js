const { preflight, respond, readJsonFile, pickRandom, clamp, parseQuery } = require("./shared");

exports.handler = async (event) => {
  const cors = preflight(event);
  if (cors) return cors;

  if (event.httpMethod !== "GET") {
    return respond(405, { error: "Method not allowed" });
  }

  try {
    const query = parseQuery(event);
    const count = clamp(parseInt(query.count, 10) || 10, 1, 10);
    const curatedQuestions = readJsonFile("quiz-questions.json", []);

    if (!Array.isArray(curatedQuestions) || !curatedQuestions.length) {
      return respond(500, { error: "No quiz questions available" });
    }

    const questions = pickRandom(curatedQuestions, count);
    const mode = "curated";
    const notice = "Curated quiz questions are served by the backend API.";

    return respond(200, { mode, notice, questions });
  } catch (err) {
    console.error("Quiz question error:", err);
    return respond(500, { error: "Unable to load quiz questions" });
  }
};
