const { preflight, respond, readJsonFile } = require("./shared");

exports.handler = async (event) => {
  const cors = preflight(event);
  if (cors) return cors;

  if (event.httpMethod !== "GET") {
    return respond(405, { error: "Method not allowed" });
  }

  try {
    const metadata = readJsonFile("calculator-sources.json", {});
    return respond(200, metadata);
  } catch (err) {
    console.error("Calculator metadata error:", err);
    return respond(500, { error: "Unable to load calculator metadata" });
  }
};
