import fetch from "node-fetch";
import aretry from "async-retry";

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

export async function getNYCOpenData(limit, offset, startTimestamp) {
  try {
    const soda_query = getSodaQueryParams(limit, offset, `received_date>='${startTimestamp}'`, "received_date");
    const res = await aretry(
      async (_bail) => {
        const res = await fetch(soda_url + soda_query, {
          method: "GET",
          headers: { "X-App-Token": soda_appToken, Authorization: soda_auth },
        });
        return await res.json();
      },
      { retries: 3 }
    );
    if (res?.error || res?.errorCode) throw new Error(res);
    return res;
  } catch (err) {
    console.error({ getNYCOpenDataError: err });
    throw err;
  }
}
