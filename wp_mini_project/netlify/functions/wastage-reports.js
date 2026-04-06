const { randomUUID } = require("crypto");
const { preflight, respond, readJsonFile, writeJsonFile, clamp, haversineKm, parseQuery } = require("./shared");

exports.handler = async (event) => {
  const cors = preflight(event);
  if (cors) return cors;

  if (event.httpMethod === "GET") {
    return handleGet(event);
  }
  if (event.httpMethod === "POST") {
    return handlePost(event);
  }

  return respond(405, { error: "Method not allowed" });
};

async function handleGet(event) {
  try {
    const query = parseQuery(event);
    const lat = parseFloat(query.lat);
    const lng = parseFloat(query.lng);
    const radiusKm = clamp(parseFloat(query.radiusKm) || 5, 1, 50);

    const localReports = readJsonFile("wastage-reports.json", []);

    const combined = localReports.map((r) => ({
      ...r,
      distanceKm:
        Number.isFinite(lat) && Number.isFinite(lng)
          ? haversineKm(lat, lng, Number(r.lat), Number(r.lng))
          : null,
    }));

    const filtered = combined
      .filter((r) => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)))
      .filter((r) => r.distanceKm === null || r.distanceKm <= radiusKm)
      .sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER));

    return respond(200, {
      reports: filtered,
      meta: {
        radiusKm,
        total: filtered.length,
        localCount: localReports.length,
        externalCount: 0,
      },
    });
  } catch (err) {
    console.error("Wastage reports read error:", err);
    return respond(500, { error: "Unable to load nearby reports" });
  }
}

async function handlePost(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const type = String(body.type || "").trim();
    const description = String(body.description || "").trim();
    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (!type || !description) {
      return respond(400, { error: "Type and description are required" });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return respond(400, { error: "Valid latitude and longitude are required" });
    }

    const reports = readJsonFile("wastage-reports.json", []);
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
    writeJsonFile("wastage-reports.json", reports);

    return respond(201, { saved: true, report });
  } catch (err) {
    console.error("Wastage report write error:", err);
    return respond(500, { error: "Unable to save report" });
  }
}
