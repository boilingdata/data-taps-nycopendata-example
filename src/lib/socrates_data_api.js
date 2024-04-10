import fetch from "node-fetch";
import aretry from "async-retry";
import { getRetryPolicy } from "./util";

// "NYC Housing Maintenance Code Complaints and Problems"
// https://dev.socrata.com/foundry/data.cityofnewyork.us/ygpa-z7cr
const soda_url = "https://data.cityofnewyork.us/resource/ygpa-z7cr.json";
const soda_username = process.env["SODA_USERNAME"];
const soda_password = process.env["SODA_PASSWORD"];
const soda_appToken = process.env["SODA_APPTOKEN"];
const soda_auth = `Basic ${Buffer.from(`${soda_username}:${soda_password}`).toString("base64")}`;

export function getSodaQueryParams(limit = 1000, offset = 0, filter = "", order = ":id") {
  return (
    `?$limit=${limit}` +
    `&$offset=${offset}` +
    `&$order=${encodeURIComponent(order)}` +
    (filter ? `&$where=${encodeURIComponent(filter)}` : "")
  );
}

export async function getNYCOpenData(query) {
  try {
    return await aretry(async (_bail) => {
      const res = await fetch(soda_url + query, {
        method: "GET",
        headers: { "X-App-Token": soda_appToken, Authorization: soda_auth },
      });
      return await res.json();
    }, getRetryPolicy(3));
  } catch (err) {
    console.error({ getNYCOpenDataError: err });
  }
}
