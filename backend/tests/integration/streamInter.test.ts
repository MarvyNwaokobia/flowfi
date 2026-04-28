import request from "supertest";
import { app } from "../../../test/setup";
import { db } from "../../db/client";

describe("Streams Integration", () => {
  let streamId: string;
  let sseMessages: any[] = [];

  // 🔌 Mock SSE client
  const mockSseClient = () => {
    return {
      write: (data: string) => {
        try {
          const parsed = JSON.parse(data.replace(/^data:\s*/, ""));
          sseMessages.push(parsed);
        } catch {}
      },
      end: jest.fn(),
    };
  };

  beforeEach(() => {
    sseMessages = [];
  });

  test("POST /v1/streams creates stream + broadcasts SSE", async () => {
    const sseClient = mockSseClient();
    app.get("sseService").subscribeAll(sseClient);

    const res = await request(app)
      .post("/v1/streams")
      .send({
        sender: "addr1",
        recipient: "addr2",
        amount: 1000,
        rate: 1,
      });

    expect(res.status).toBe(201);
    streamId = res.body.id;

    // ✅ DB check
    const stream = await db.stream.findUnique({ where: { id: streamId } });
    expect(stream).toBeTruthy();

    // ✅ SSE broadcast check
    expect(sseMessages.length).toBeGreaterThan(0);
  });

  test("GET /v1/streams/{id} returns correct data", async () => {
    const res = await request(app).get(`/v1/streams/${streamId}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(streamId);
  });

  test("GET /v1/streams?sender filters correctly", async () => {
    const res = await request(app)
      .get("/v1/streams")
      .query({ sender: "addr1" });

    expect(res.status).toBe(200);
    expect(res.body.every((s: any) => s.sender === "addr1")).toBe(true);
  });

  test("GET /v1/streams/{id}/events paginates", async () => {
    const res = await request(app)
      .get(`/v1/streams/${streamId}/events`)
      .query({ limit: 10 });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test("Indexer processes TOPPED_UP event", async () => {
    await request(app)
      .post(`/v1/indexer/event`)
      .send({
        type: "TOPPED_UP",
        streamId,
        amount: 500,
      });

    const stream = await db.stream.findUnique({ where: { id: streamId } });

    expect(stream.depositedAmount).toBeGreaterThanOrEqual(1500);
  });

  test("Indexer processes CANCELLED event", async () => {
    await request(app)
      .post(`/v1/indexer/event`)
      .send({
        type: "CANCELLED",
        streamId,
      });

    const stream = await db.stream.findUnique({ where: { id: streamId } });

    expect(stream.status).toBe("cancelled");
  });
});