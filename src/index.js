import fetch from "node-fetch";
import aretry from "async-retry";
import { BoilingData } from "@boilingdata/node-boilingdata";
import * as fs from "fs/promises";
import jwt from "jsonwebtoken";

// Source: API
// "NYC Housing Maintenance Code Complaints and Problems"
// https://dev.socrata.com/foundry/data.cityofnewyork.us/ygpa-z7cr
const soda_url = "https://data.cityofnewyork.us/resource/ygpa-z7cr.json";
const soda_username = process.env["SODA_USERNAME"];
const soda_password = process.env["SODA_PASSWORD"];
const soda_appToken = process.env["SODA_APPTOKEN"];
const soda_auth = `Basic ${Buffer.from(`${soda_username}:${soda_password}`).toString("base64")}`;
const soda_query = "?$limit=1000&$offset=0&$order=:id&received_date=2017-08-01T03:42:04.000";

// Sink: Data Tap
// Tap token is auth token for sending data to the Tap.
// bd_tapowner is ourselves, since it is our own Data Tap.
const TAP_TOKEN_FILE = "/tmp/.taptoken";
const bd_tapTokenUrl = process.env["TAP_URL"];
const bd_username = process.env["BD_USERNAME"];
const bd_password = process.env["BD_PASSWORD"];
const bd_tapowner = bd_username;

async function getValidTapToken(fetch = true) {
  try {
    const jwtToken = Buffer.from(await fs.readFile(TAP_TOKEN_FILE)).toString("utf8"); // locally cached
    const decoded = jwt.decode(jwtToken);
    if (decoded.exp * 1000 - 60 * 1000 <= Date.now()) throw new Error("Expired local JWT token");
    return jwtToken;
  } catch (err) {
    // expired or local cached file not exists
    if (!fetch) throw err;
    const bd_Instance = new BoilingData({ username: bd_username, password: bd_password });
    const bd_tapClientToken = await bd_Instance.getTapClientToken("24h", bd_tapowner);
    await fs.writeFile(TAP_TOKEN_FILE, bd_tapClientToken);
    return getValidTapToken(false);
  }
}

function getRetryPolicy(retries) {
  return { retries };
}

async function getNYCOpenData(query) {
  return await aretry(async (_bail) => {
    const res = await fetch(soda_url + query, {
      method: "GET",
      headers: { "X-App-Token": soda_appToken, Authorization: soda_auth },
    });
    return await res.json();
  }, getRetryPolicy(5));
}

async function sendToDataTap(rows) {
  const bd_tapClientToken = Buffer.from(await getValidTapToken()).toString("utf8");
  return await aretry(async (_bail) => {
    const res = await fetch(bd_tapTokenUrl, {
      method: "POST",
      headers: {
        "x-bd-authorizatoin": bd_tapClientToken,
        "Content-Type": "application/x-ndjson",
      },
      body: JSON.stringify(rows),
    });
    return await res.json();
  }, getRetryPolicy(3));
}

export default handler = async (_event, _context) => {
  const arr = await getNYCOpenData(soda_query);
  const ndjson = arr.map((r) => JSON.stringify(r)).join("\n");
  return await sendToDataTap(ndjson);
};
