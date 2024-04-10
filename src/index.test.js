import handler from "./index";

describe("handler", () => {
  it("handler", async () => {
    await expect(handler()).resolves.toMatchObject({ statusCode: 200, body: '{"m":"OK"}' });
  });
});
