import fetch from "node-fetch";
import aretry from "async-retry";
import { getSodaQueryParams } from "./socrates_data_api";
import { SSMClient } from "@aws-sdk/client-ssm"; // ES Modules import
import { getSSMParamString } from "./ssm";
import { getRetryPolicy } from "./util";
import { getValidTapToken } from "./boilingdata";

// Source: API
// "NYC Housing Maintenance Code Complaints and Problems"
// https://dev.socrata.com/foundry/data.cityofnewyork.us/ygpa-z7cr
const soda_url = "https://data.cityofnewyork.us/resource/ygpa-z7cr.json";
const soda_username = process.env["SODA_USERNAME"];
const soda_password = process.env["SODA_PASSWORD"];
const soda_appToken = process.env["SODA_APPTOKEN"];
const soda_auth = `Basic ${Buffer.from(`${soda_username}:${soda_password}`).toString("base64")}`;

// Sink: Data Tap
// Tap token is auth token for sending data to the Tap.
// bd_tapowner is ourselves, since it is our own Data Tap.
const bd_tapTokenUrl = process.env["TAP_URL"];

const SSM_OFFSET = "/datataps/nyc-open-data/offsetPair";
const AWS_REGION = process.env["AWS_DEFAULT_REGION"] ?? process.env["AWS_REGION"] ?? "eu-west-1";
const ssmCli = new SSMClient({ region: AWS_REGION });

async function getNYCOpenData(query) {
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

export default handler = async (event, context) => {
  console.log({ event });
  // Ensure we have enough time to run
  if (context && context?.getRemainingTimeInMillis) {
    const remainingMs = context.getRemainingTimeInMillis();
    if (remainingMs < 30_000) throw new Error("Have at least 30s timeout with AWS Lambda");
  }
  // store last ingestion point by using SSM Parameter Store
  const offsetPair = JSON.parse(
    (await getSSMParamString(ssmCli, SSM_OFFSET)) ?? '{"startTimeStamp":"2024-04-01T00:00:00.00","startOffset":"0"}'
  );
  const START = event?.startTimestamp
    ? event.startTimestamp
    : offsetPair?.startTimestamp ??
      new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 11) + "00:00:00.00"; // 1 week back
  const maxRecords = event?.maxRecords ? event.maxRecords : 5000;
  const limit = event?.limit ? event.limit : 1000; // batch size
  let offset = event?.offset ? event.offset : offsetPair?.offset ?? "0";
  console.log({
    apiStartTimestamp: START,
    apiStartOffset: offset,
    apiBatchLimit: limit,
    maxRecordsToProcess: maxRecords,
  });
  let recordsTotal = 0;
  let apiBatch = [];
  do {
    const soda_query = getSodaQueryParams(limit, offset, `received_date>='${START}'`, "received_date");
    apiBatch = await getNYCOpenData(soda_query);
    // don't bombard the API!
    await new Promise((resolve) => setTimeout(resolve(), 200));
    if (apiBatch?.error || apiBatch?.errorCode) {
      console.error(apiBatch);
      throw new Error(apiBatch);
    }
    console.log({ receivedApiBatchSize: apiBatch?.length });
    recordsTotal += apiBatch.length;
    const ndjson = apiBatch?.map((r) => JSON.stringify(r)).join("\n");
    const dataTapResponse = await sendToDataTap(ndjson);
    console.log({ dataTapResponse });
    offset += limit;
  } while (
    Array.isArray(apiBatch) &&
    apiBatch.length >= limit &&
    recordsTotal < maxRecords &&
    (!context ||
      context.getRemainingTimeInMillis ||
      (context.getRemainingTimeInMillis && context.getRemainingTimeInMillis() > 5000))
  );
  // TODO: Persist timestamp and offset to SSM
  // NOTE: timestamp and offset are a pair, they can't be separated
  return recordsTotal;
};
