import { getSodaQueryParams } from "./lib/socrates_data_api";
import { SSMClient } from "@aws-sdk/client-ssm"; // ES Modules import
import { getSSMParamString } from "./lib/ssm";
import { sendToDataTap } from "./lib/boilingdata";
import { getNYCOpenData } from "./lib/socrates_data_api";

// Source: REST API (socrates_data_api.js)
//   Sink: S3 through Data Tap (boilingdata.js)

const WAIT_TIME_MS = 200; // don't bomard source API, wait time (ms) between calls
const SSM_OFFSET = "/datataps/nyc-open-data/offsetPair";
const AWS_REGION = process.env["AWS_DEFAULT_REGION"] ?? process.env["AWS_REGION"] ?? "eu-west-1";
const ssmCli = new SSMClient({ region: AWS_REGION });

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
    if (apiBatch?.error || apiBatch?.errorCode) {
      console.error(apiBatch);
      throw new Error(apiBatch);
    }
    console.log({ receivedApiBatchSize: apiBatch?.length });
    recordsTotal += apiBatch.length;
    const ndjson = apiBatch?.map((r) => JSON.stringify(r)).join("\n");
    // Spend at least WAIT_TIME_MS on this to avoid bombarding the source API too hard
    const [dataTapResponse, _] = await Promise.all([
      sendToDataTap(ndjson),
      new Promise((resolve) => setTimeout(resolve(), WAIT_TIME_MS)),
    ]);
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
  // NOTE: timestamp and offset are a pair, they can't be separated. Also, the timestamp
  //       should be probably reset to the latest (unique) one and offset set to 0.
  return recordsTotal;
};
