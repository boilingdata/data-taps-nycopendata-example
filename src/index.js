//import https from "https";
import fetch from "node-fetch";
import aretry from "async-retry";
import { BoilingData } from "@boilingdata/node-boilingdata";

const nycod_username = process.env["NYCOD_USERNAME"];
const nycod_password = process.env["NYCOD_PASSWORD"];
const nycod_appToken = process.env["NYCOD_APPTOKEN"];
const nycod_auth = `Basic ${Buffer.from(`${nycod_username}:${nycod_password}`).toString("base64")}`;
const nycod_url = "https://data.seattle.gov/resource/jguv-t9rb.json";
const query = "?$query=SELECT%20*%20WHERE%20Species%20NOT%20IN%20(%27Cat%27%2C%20%27Dog%27)";

const bd_tapTokenUrl = process.env["TAP_URL"];
const bd_Instance = new BoilingData({ username: process.env["BD_USERNAME"], password: process.env["BD_PASSWORD"] });
const bd_tapClientToken = await bd_Instance.getTapClientToken("24h", process.env["BD_USERNAME"]); // our own Data Tap

function getRetryPolicy(retries) {
  return { retries };
}

async function getNYCOpenData() {
  return await aretry(async (_bail) => {
    const res = await fetch(nycod_url + query, {
      method: "GET",
      headers: { "X-App-Token": nycod_appToken, Authorization: nycod_auth },
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
