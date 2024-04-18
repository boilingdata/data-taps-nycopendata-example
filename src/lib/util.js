export function getLatestTimestampPlusPlus(rows, tsField) {
  // console.log({ getLatestTimestampPlusPlusRow: rows?.[0], tsField });
  const ts = rows
    .map((r) => r[tsField])
    .sort()
    .pop();
  if (ts) {
    // console.log({ latestTimeStamp: ts });
    const t1 = ts.substring(0, 13);
    const t2 = new Date(new Date(ts).getTime() + 1).toISOString().substring(13);
    const incrementedTimestamp = (t1 + t2).replaceAll("Z", "");
    // console.log({ incrementedTimestamp });
    return incrementedTimestamp;
  }
}
