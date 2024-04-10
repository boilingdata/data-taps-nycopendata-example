//import https from "https";
import fetch from "node-fetch";
import aretry from "async-retry";
import { BoilingData } from "@boilingdata/node-boilingdata";

const soda_username = process.env["SODA_USERNAME"];
const soda_password = process.env["SODA_PASSWORD"];
const soda_appToken = process.env["SODA_APPTOKEN"];
const soda_auth = `Basic ${Buffer.from(`${soda_username}:${soda_password}`).toString("base64")}`;
// "Housing Maintenance Code Complaints and Problems"
// https://dev.socrata.com/foundry/data.cityofnewyork.us/ygpa-z7cr
const soda_url = "https://data.cityofnewyork.us/resource/ygpa-z7cr.json";
const query = "?received_date=2017-08-01T03:42:04.000";

const bd_tapTokenUrl = process.env["TAP_URL"];
const bd_Instance = new BoilingData({ username: process.env["BD_USERNAME"], password: process.env["BD_PASSWORD"] });
const bd_tapClientToken = await bd_Instance.getTapClientToken("24h", process.env["BD_USERNAME"]); // our own Data Tap

function getRetryPolicy(retries) {
  return { retries };
}

async function getNYCOpenData() {
  return await aretry(async (_bail) => {
    const res = await fetch(soda_url + query, {
      method: "GET",
      headers: { "X-App-Token": soda_appToken, Authorization: soda_auth },
    });
    const data = await res.text();
    const rows = JSON.parse(data)
      .map((r) => JSON.stringify(r))
      .join("\n"); // newline JSON as input for Data Tap
    return rows;
  }, getRetryPolicy(5));
}

async function sendToDataTap(rows) {
  console.log({ bd_tapClientToken, rows });
  await aretry(async (_bail) => {
    const res = await fetch(bd_tapTokenUrl, {
      method: "POST",
      headers: {
        "x-bd-authorizatoin": bd_tapClientToken,
        "Content-Type": "application/x-ndjson",
      },
      body: JSON.stringify(rows),
    });
    console.log({ res });
  }, getRetryPolicy(3));
}

async function handler(_event, _context) {
  const ndjson = await getNYCOpenData();
  await sendToDataTap(ndjson);
}

handler();
