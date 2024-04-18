import { handler } from "./index";

describe("handler", () => {
  it("2000 records starting from 2024-04-01", async () => {
    await expect(
      handler({ startTimestamp: "2024-04-01T00:00:00.00", maxRecords: 2000, offset: 100, limit: 1500 })
    ).resolves.toEqual(3000);
  }, 60_000);
});
