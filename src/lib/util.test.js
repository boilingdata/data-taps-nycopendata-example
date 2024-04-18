import { getLatestTimestampPlusPlus } from "./util";

const testData = [
  {
    received_date: "2024-04-01T07:20:23.000",
    problem_id: "25379676",
    complaint_id: "12858558",
    building_id: "804183",
    borough: "MANHATTAN",
  },
  {
    received_date: "2024-04-01T07:20:23.101",
    problem_id: "25379677",
    complaint_id: "12858558",
    building_id: "804183",
    borough: "MANHATTAN",
  },
  {
    received_date: "2024-04-01T07:20:21.000",
    problem_id: "25379667",
    complaint_id: "12858555",
    building_id: "929357",
    borough: "QUEENS",
  },
  {
    received_date: "2024-04-01T07:20:21.000",
    problem_id: "25379668",
    complaint_id: "12858555",
    building_id: "929357",
    borough: "QUEENS",
  },
  {
    received_date: "2024-04-01T07:20:21.000",
    problem_id: "25379666",
    complaint_id: "12858555",
    building_id: "929357",
    borough: "QUEENS",
  },
  {
    received_date: "2024-04-01T07:20:21.000",
    problem_id: "25379669",
    complaint_id: "12858555",
    building_id: "929357",
    borough: "QUEENS",
  },
];
const tsField = "received_date";

describe("getLatestTimestampPlusPlus", () => {
  it("getLatestTimestampPlusPlus", async () => {
    expect(getLatestTimestampPlusPlus(testData, tsField)).toEqual("2024-04-01T07:20:23.102");
    const t = [{ received_date: "2029-04-11T07:20:21.999" }];
    expect(getLatestTimestampPlusPlus(t, tsField)).toEqual("2029-04-11T07:20:22.000");
  });
});
