import fetch from "node-fetch";
import aretry from "async-retry";
import * as fs from "fs/promises";
import jwt from "jsonwebtoken";
import { BoilingData } from "@boilingdata/node-boilingdata";

const TAP_TOKEN_FILE = process.env["AWS_LAMBDA_FUNCTION_NAME"] != undefined ? "/tmp/.taptoken" : ".taptoken";
const bd_username = process.env["BD_USERNAME"];
const bd_password = process.env["BD_PASSWORD"];
const bd_tapTokenUrl = process.env["BD_TAPURL"];
const bd_tapowner = bd_username;

let jwtToken, decoded;
async function getValidTapToken(fetch = true) {
  try {
    jwtToken = jwtToken ?? Buffer.from(await fs.readFile(TAP_TOKEN_FILE)).toString("utf8"); // locally cached
    decoded = decoded ?? jwt.decode(jwtToken);
    if (decoded.exp * 1000 - 60 * 1000 <= Date.now()) throw new Error("Expired local JWT token");
    return jwtToken;
  } catch (err) {
    jwtToken = undefined;
    decoded = undefined;
    // expired or local cached file not exists or corrupted
    if (!fetch) {
      console.error(err);
      throw err;
    }
    const bd_Instance = new BoilingData({ username: bd_username, password: bd_password });
    const bd_tapClientToken = await bd_Instance.getTapClientToken("24h", bd_tapowner);
    await fs.writeFile(TAP_TOKEN_FILE, bd_tapClientToken);
    return getValidTapToken(false);
  }
}

export async function sendToDataTap(rows) {
  const body = rows?.map((r) => JSON.stringify(r)).join("\n"); // newline JSON
  const token = Buffer.from(await getValidTapToken()).toString("utf8");
  return await aretry(
    async (bail) => {
      const headers = { "x-bd-authorization": token, "Content-Type": "application/x-ndjson" };
      const res = await fetch(bd_tapTokenUrl, { method: "POST", headers, body });
      const jsonRes = await res.json();
      if (jsonRes?.statusCode == 403) bail("Unauthorized");
      return jsonRes;
    },
    { retries: 5, onRetry: (error, attempt) => console.log(`DataTap Retry -- attempt ${attempt}: ${error}`) }
  );
}
