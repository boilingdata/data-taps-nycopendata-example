import { getSodaQueryParams } from "./lib/socrates_data_api";
import { SSMClient } from "@aws-sdk/client-ssm"; // ES Modules import
import { getSSMParamString } from "./lib/ssm";
import { sendToDataTap } from "./lib/boilingdata";
import { getNYCOpenData } from "./lib/socrates_data_api";

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
  const def = `{"startTimeStamp":"${defTs}","startOffset":"0"}`;
  const offsetPair = JSON.parse((await getSSMParamString(ssmCli, SSM_OFFSET)) ?? def);
  const startTimestamp = event?.startTimestamp ?? offsetPair?.startTimestamp ?? def;
  const maxRecords = event?.maxRecords ?? MAX_RECORDS ?? 5000;
  const limit = event?.limit ?? 1000; // batch size
  let offset = event?.offset ?? offsetPair?.offset ?? "0";
  const retParams = { startTimestamp, offset, limit, maxRecords };
  console.log(retParams);
  return retParams;
}

function ensureEnoughTime(limit, context) {
  if (!context || !context?.getRemainingTimeInMillis) return true; // testing, not Lambda
  const remainingMs = context.getRemainingTimeInMillis();
  return remainingMs < limit;
}

function looping(batch, context, limit, maxRecords) {
  recordsTotal += batch.length;
  return Array.isArray(batch) && batch.length >= limit && recordsTotal < maxRecords && ensureEnoughTime(5000, context);
}

export default handler = async (event, context) => {
  console.log({ event });
  if (!ensureEnoughTime(30_000, context)) throw new Error("AWS Lambda timeout must be at least 30s");
  let apiBatch = [];
  let { startTimestamp, limit, offset, maxRecords } = await getParams(event);

  do {
    const soda_query = getSodaQueryParams(limit, offset, `received_date>='${startTimestamp}'`, "received_date");
    apiBatch = await getNYCOpenData(soda_query);
    if (apiBatch?.error || apiBatch?.errorCode) throw new Error(apiBatch);
    console.log({ receivedApiBatchSize: apiBatch?.length });
    const ndjson = apiBatch?.map((r) => JSON.stringify(r)).join("\n");
    // Spend at least WAIT_TIME_MS here to avoid bombarding the source API too hard
    const [dataTapResponse, _] = await Promise.all([sendToDataTap(ndjson), sleep(WAIT_TIME_MS)]);
    console.log({ dataTapResponse });
    offset += limit;
  } while (looping(apiBatch, context, limit, maxRecords));

  // TODO: Persist timestamp and offset to SSM
  // NOTE: timestamp and offset are a pair, they can't be separated. Also, the timestamp
  //       should be probably reset to the latest (unique) one and offset set to 0.
  return recordsTotal;
};
