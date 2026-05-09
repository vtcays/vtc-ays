const https = require("https");

exports.handler = async (event) => {
  const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  try {
    const token = (event.headers.authorization || "").replace("Bearer ", "");
    if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: "No token" }) };
    const { from, to } = event.queryStringParameters || {};
    const data = await new Promise((resolve, reject) => {
      const req = https.request({ hostname: "b2b.revolut.com", path: `/api/1.0/transactions?from=${from||""}&to=${to||""}&count=100`, method: "GET", headers: { "Authorization": `Bearer ${token}` } }, res => {
        let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(JSON.parse(d)));
      });
      req.on("error", reject); req.end();
    });
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (e) { return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }; }
};
