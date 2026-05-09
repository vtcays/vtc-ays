const crypto = require("crypto");
const https  = require("https");

const CLIENT_ID    = "uFzcEpGQU6rNLGVANXpFCqWGieO86oRZ-WeFXLSESfU";
const REDIRECT_URI = "https://vtc-ays.netlify.app/";

function makeJWT() {
  let key = (process.env.REVOLUT_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  
  // Si pas de sauts de ligne → reconstruire depuis le base64
  if ((key.match(/\n/g)||[]).length < 5) {
    // Extraire le contenu base64 entre les headers
    const match = key.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----(.+?)-----END (?:RSA )?PRIVATE KEY-----/s);
    if (match) {
      const b64 = match[1].replace(/\s/g, "");
      const isRSA = key.includes("RSA PRIVATE KEY");
      const hdr = isRSA ? "RSA PRIVATE KEY" : "PRIVATE KEY";
      // Découper le base64 en lignes de 64 chars
      const lines = b64.match(/.{1,64}/g).join("\n");
      key = `-----BEGIN ${hdr}-----\n${lines}\n-----END ${hdr}-----\n`;
    }
  }
  
  console.log("Key length:", key.length);
  console.log("Key start:", JSON.stringify(key.substring(0, 60)));
  console.log("Newlines:", (key.match(/\n/g)||[]).length);

  const header  = Buffer.from(JSON.stringify({ alg:"RS256", typ:"JWT" })).toString("base64url");
  const now     = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: "vtc-ays.netlify.app",
    sub: CLIENT_ID,
    aud: "https://revolut.com",
    iat: now,
    exp: now + 300,
  })).toString("base64url");

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(key, "base64url");

  return `${header}.${payload}.${sig}`;
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({ raw: d }); } });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const h = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: h, body: "" };
  try {
    const { code } = JSON.parse(event.body || "{}");
    if (!code) return { statusCode: 400, headers: h, body: JSON.stringify({ error: "No code" }) };

    const jwt    = makeJWT();
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: jwt,
    });

    const data = await post("https://b2b.revolut.com/api/1.0/auth/token", params.toString());
    return { statusCode: 200, headers: h, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 500, headers: h, body: JSON.stringify({ error: e.message, stack: e.stack }) };
  }
};
