const crypto = require("crypto");
const QRCode = require("qrcode");

const HMAC_SECRET = process.env.QR_SECRET || "replace_this_with_env_secret";

function signPayload(payload) {
  const payloadJson = JSON.stringify(payload);
  const sig = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(payloadJson)
    .digest("hex");
  return { p: payload, sig };
}

function verifySignedPayload(obj) {
  if (!obj || !obj.p || !obj.sig) return false;
  const payloadJson = JSON.stringify(obj.p);
  const expected = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(payloadJson)
    .digest("hex");
  return expected === obj.sig;
}

async function generateQrDataUrl(signedObj) {
  const json = JSON.stringify(signedObj);
  return QRCode.toDataURL(json);
}

module.exports = { signPayload, verifySignedPayload, generateQrDataUrl };
