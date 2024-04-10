import fetch from "node-fetch";
import aretry from "async-retry";
import * as fs from "fs/promises";
import jwt from "jsonwebtoken";
import { BoilingData } from "@boilingdata/node-boilingdata";
import { getRetryPolicy } from "./util";

const TAP_TOKEN_FILE = "/tmp/.taptoken";
const bd_username = process.env["BD_USERNAME"];
const bd_password = process.env["BD_PASSWORD"];
const bd_tapowner = bd_username;
const bd_tapTokenUrl = process.env["TAP_URL"];

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

export async function sendToDataTap(rows) {
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
