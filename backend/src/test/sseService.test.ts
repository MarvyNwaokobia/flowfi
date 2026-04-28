import { SseService } from "../services/sseService";

type MockRes = {
  write: jest.Mock;
  end: jest.Mock;
};

const createMockRes = (): MockRes => ({
  write: jest.fn(),
  end: jest.fn(),
});

describe("SseService", () => {
  let sse: SseService;

  beforeEach(() => {
    sse = new SseService();
  });

  test("test_subscribe_to_stream_events", () => {
    const res = createMockRes();
    sse.subscribeToStream("stream-1", res as any);

    sse.broadcastToStream("stream-1", { msg: "hello" });

    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining("hello")
    );
  });

  test("test_subscribe_to_user_events", () => {
    const res = createMockRes();
    sse.subscribeToUser("user-1", res as any);

    sse.broadcastToUser("user-1", { msg: "user event" });

    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining("user event")
    );
  });

  test("test_subscribe_all", () => {
    const res = createMockRes();
    sse.subscribeAll(res as any);

    sse.broadcastAll({ msg: "global" });

    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining("global")
    );
  });

  test("test_client_disconnect_cleaned_up", () => {
    const res = createMockRes();
    sse.subscribeToUser("user-1", res as any);

    sse.disconnect(res as any);

    expect(sse.getClientCount()).toBe(0);
  });

  test("test_broadcast_to_multiple_clients", () => {
    const res1 = createMockRes();
    const res2 = createMockRes();

    sse.subscribeToStream("stream-1", res1 as any);
    sse.subscribeToStream("stream-1", res2 as any);

    sse.broadcastToStream("stream-1", { msg: "multi" });

    expect(res1.write).toHaveBeenCalled();
    expect(res2.write).toHaveBeenCalled();
  });

  test("test_no_cross_user_leakage", () => {
    const resA = createMockRes();
    const resB = createMockRes();

    sse.subscribeToUser("user-A", resA as any);
    sse.subscribeToUser("user-B", resB as any);

    sse.broadcastToUser("user-A", { msg: "secret" });

    expect(resA.write).toHaveBeenCalled();
    expect(resB.write).not.toHaveBeenCalled();
  });
});