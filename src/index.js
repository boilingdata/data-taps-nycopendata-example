import { SSMClient } from "@aws-sdk/client-ssm";
import { getSSMParamString, putSSMParamString } from "./lib/ssm";
import { sendToDataTap } from "./lib/boilingdata";
import { getNYCOpenData } from "./lib/socrates_data_api";
import { getLatestTimestampPlusPlus } from "./lib/util";

// Source: REST API (socrates_data_api.js)
//   Sink: S3 through Data Tap (boilingdata.js)

const sleep = (waitMs) => new Promise((resolve) => setTimeout(resolve(), waitMs));
let recordsTotal = 0;
const WAIT_TIME_MS = 200; // don't bomard source API, wait time (ms) between calls
const MAX_RECORDS = process.env["MAX_RECORDS"];
const SSM_OFFSET = "/datataps/nyc-open-data/offsetPair";
const AWS_REGION = process.env["AWS_DEFAULT_REGION"] ?? process.env["AWS_REGION"] ?? "eu-west-1";
const ssmCli = new SSMClient({ region: AWS_REGION });

async function getParams(event) {
  const defTs = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 11) + "00:00:00.00";
  const def = `{"startTimestamp":"${defTs}","startOffset":0,"rounds":0}`;
  const offsetPair = JSON.parse((await getSSMParamString(ssmCli, SSM_OFFSET)) ?? def);
  const startTimestamp = event?.startTimestamp ?? offsetPair?.startTimestamp ?? defTs;
  const maxRecords = event?.maxRecords ?? MAX_RECORDS ?? 50_000;
  const limit = event?.limit ?? 1000; // batch size from API
  const offset = event?.offset ?? offsetPair?.startOffset ?? 0;
  const rounds = offsetPair?.rounds ?? 0;
  return { startTimestamp, offset, limit, maxRecords, rounds };
}

function ensureEnoughTime(limit, context) {
  if (!context || !context?.getRemainingTimeInMillis) return true; // testing, not Lambda
  const remainingMs = context.getRemainingTimeInMillis();
  console.log({ remainingMs, limit });
  return remainingMs > limit;
}

function looping(batch, context, limit, maxRecords) {
  recordsTotal += batch.length;
  return Array.isArray(batch) && batch.length >= limit && recordsTotal < maxRecords && ensureEnoughTime(5000, context);
}

export async function handler(event, context) {
  console.log({ event });
  if (!ensureEnoughTime(30_000, context)) throw new Error("AWS Lambda timeout must be at least 30s");
  let apiBatch = [];
  let { startTimestamp, limit, offset, maxRecords, rounds } = await getParams(event);
  console.log({ startTimestamp, limit, offset, maxRecords });
  let latestIncrementedTimestamp = startTimestamp;

  do {
    apiBatch = await getNYCOpenData(limit, offset, startTimestamp);
    console.log({ receivedApiBatchSize: apiBatch?.length });
    // console.log(apiBatch);
    if (apiBatch?.length == 0) break;
    // Spend at least WAIT_TIME_MS here to avoid bombarding the source API too hard
    const [dataTapResponse, _] = await Promise.all([sendToDataTap(apiBatch), sleep(WAIT_TIME_MS)]);
    console.log({ dataTapResponse });
    offset += limit;
    latestIncrementedTimestamp = getLatestTimestampPlusPlus(apiBatch, "received_date");
  } while (looping(apiBatch, context, limit, maxRecords));

  if (startTimestamp != latestIncrementedTimestamp) {
    console.log({ message: "Storing lastest inc. ts:", latestIncrementedTimestamp });
    const val = JSON.stringify({ startTimestamp: latestIncrementedTimestamp, startOffset: 0, rounds: ++rounds });
    await putSSMParamString(ssmCli, SSM_OFFSET, val);
  }
  return recordsTotal;
}
