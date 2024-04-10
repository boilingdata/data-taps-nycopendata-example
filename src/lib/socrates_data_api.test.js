import { getSodaQueryParams } from "./socrates_data_api";

describe("getSodaQuery", () => {
  it("getSodaQuery", async () => {
    expect(getSodaQueryParams()).toEqual("?$limit=1000&$offset=0&$order=%3Aid");
    expect(getSodaQueryParams(10)).toEqual("?$limit=10&$offset=0&$order=%3Aid");
    expect(getSodaQueryParams(10, 20)).toEqual("?$limit=10&$offset=20&$order=%3Aid");
    expect(getSodaQueryParams(10, 20, "received_date=2017-08-01T03:42:04.000", "received_date")).toEqual(
      "?$limit=10&$offset=20&$order=received_date&$where=received_date%3D2017-08-01T03%3A42%3A04.000"
    );
    expect(getSodaQueryParams(10, 20, "received_date>2020-01-01T00:00:00.000", "received_date")).toEqual(
      "?$limit=10&$offset=20&$order=received_date&$where=received_date%3E2020-01-01T00%3A00%3A00.000"
    );
  });
});
