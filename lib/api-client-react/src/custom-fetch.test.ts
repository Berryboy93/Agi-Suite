import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  customFetch,
  setBaseUrl,
  setAuthTokenGetter,
  ApiError,
  ResponseParseError,
} from "./custom-fetch";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  setBaseUrl(null);
  setAuthTokenGetter(null);
});

describe("customFetch", () => {
  describe("base URL resolution", () => {
    it("should prepend base URL to relative paths", async () => {
      setBaseUrl("https://api.example.com");
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

      await customFetch("/healthz");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/healthz",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should not modify absolute URLs", async () => {
      setBaseUrl("https://api.example.com");
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

      await customFetch("https://other.com/healthz");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://other.com/healthz",
        expect.any(Object),
      );
    });
  });

  describe("auth token injection", () => {
    it("should attach bearer token when getter returns a token", async () => {
      setAuthTokenGetter(() => "token-123");
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

      await customFetch("/healthz");

      const call = mockFetch.mock.calls[0];
      expect(call[1].headers.get("authorization")).toBe("Bearer token-123");
    });

    it("should not attach auth header when getter returns null", async () => {
      setAuthTokenGetter(() => null);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

      await customFetch("/healthz");

      const call = mockFetch.mock.calls[0];
      expect(call[1].headers.has("authorization")).toBe(false);
    });

    it("should not override explicit authorization header", async () => {
      setAuthTokenGetter(() => "token-123");
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

      await customFetch("/healthz", {
        headers: { authorization: "Basic abc" },
      });

      const call = mockFetch.mock.calls[0];
      expect(call[1].headers.get("authorization")).toBe("Basic abc");
    });
  });

  describe("JSON content-type inference", () => {
    it("should set application/json for JSON-looking body", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"ok":true}', { status: 200 }),
      );

      await customFetch("/healthz", {
        method: "POST",
        body: '{"key":"value"}',
      });

      const call = mockFetch.mock.calls[0];
      expect(call[1].headers.get("content-type")).toBe("application/json");
    });

    it("should not override explicit content-type", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"ok":true}', { status: 200 }),
      );

      await customFetch("/healthz", {
        method: "POST",
        body: '{"key":"value"}',
        headers: { "content-type": "application/vnd.api+json" },
      });

      const call = mockFetch.mock.calls[0];
      expect(call[1].headers.get("content-type")).toBe(
        "application/vnd.api+json",
      );
    });
  });

  describe("GET/HEAD body rejection", () => {
    it("should throw on GET with body", async () => {
      await expect(customFetch("/healthz", { body: "data" })).rejects.toThrow(
        "GET requests cannot have a body",
      );
    });

    it("should throw on HEAD with body", async () => {
      await expect(
        customFetch("/healthz", { method: "HEAD", body: "data" }),
      ).rejects.toThrow("HEAD requests cannot have a body");
    });
  });

  describe("success response parsing", () => {
    it("should parse JSON response", async () => {
      const data = { status: "healthy" };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(data), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

      const result = await customFetch("/healthz", { responseType: "json" });
      expect(result).toEqual(data);
    });

    it("should parse text response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("plain text", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
      );

      const result = await customFetch("/healthz", { responseType: "text" });
      expect(result).toBe("plain text");
    });

    it("should return null for 204 No Content", async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
      const result = await customFetch("/healthz");
      expect(result).toBeNull();
    });
  });

  describe("error response handling", () => {
    it("should throw ApiError with parsed JSON error body", async () => {
      const errorBody = { title: "Not Found", detail: "Resource missing" };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 404,
          statusText: "Not Found",
          headers: { "content-type": "application/json" },
        }),
      );

      await expect(customFetch("/missing")).rejects.toSatisfy(
        (err: ApiError) => {
          expect(err).toBeInstanceOf(ApiError);
          expect(err.status).toBe(404);
          expect(err.data).toEqual(errorBody);
          expect(err.message).toContain("Not Found");
          expect(err.message).toContain("Resource missing");
          return true;
        },
      );
    });

    it("should throw ApiError with text error body", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Something went wrong", {
          status: 500,
          statusText: "Internal Server Error",
        }),
      );

      await expect(customFetch("/error")).rejects.toSatisfy((err: ApiError) => {
        expect(err.status).toBe(500);
        expect(err.data).toBe("Something went wrong");
        return true;
      });
    });

    it("should throw ApiError with null body for error with no content", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 500,
          statusText: "Internal Server Error",
        }),
      );
      await expect(customFetch("/noop")).rejects.toSatisfy((err: ApiError) => {
        expect(err.data).toBeNull();
        return true;
      });
    });
  });

  describe("JSON parse error handling", () => {
    it("should throw ResponseParseError for invalid JSON", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("not json", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

      await expect(
        customFetch("/healthz", { responseType: "json" }),
      ).rejects.toSatisfy((err: ResponseParseError) => {
        expect(err).toBeInstanceOf(ResponseParseError);
        expect(err.rawBody).toBe("not json");
        return true;
      });
    });
  });

  describe("auto response type inference", () => {
    it("should infer JSON from content-type", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"auto":true}', {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

      const result = await customFetch("/healthz", { responseType: "auto" });
      expect(result).toEqual({ auto: true });
    });

    it("should infer text from text/plain", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("auto text", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
      );

      const result = await customFetch("/healthz", { responseType: "auto" });
      expect(result).toBe("auto text");
    });
  });

  describe("BOM stripping", () => {
    it("should strip UTF-8 BOM from JSON response", async () => {
      const bomJson = "\uFEFF" + JSON.stringify({ bom: true });
      mockFetch.mockResolvedValueOnce(
        new Response(bomJson, {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

      const result = await customFetch("/healthz", { responseType: "json" });
      expect(result).toEqual({ bom: true });
    });
  });

  describe("error body blob fallback", () => {
    it("should return blob for non-JSON non-text error responses", async () => {
      const blob = new Blob(["png data"]);
      const response = new Response(blob, {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "content-type": "image/png" },
      });
      mockFetch.mockResolvedValueOnce(response);

      await expect(customFetch("/image")).rejects.toSatisfy((err: ApiError) => {
        expect(err.data).toBeInstanceOf(Blob);
        return true;
      });
    });

    it("should fall back to text when blob() is unavailable", async () => {
      const response = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers({ "content-type": "image/png" }),
        body: undefined,
        text: vi.fn().mockResolvedValue("error text"),
      };
      mockFetch.mockResolvedValueOnce(response);

      await expect(customFetch("/image")).rejects.toSatisfy((err: ApiError) => {
        expect(err.data).toBe("error text");
        return true;
      });
    });
  });

  describe("error body edge cases", () => {
    it("should return null for error with whitespace-only body", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("   \n\t  ", {
          status: 400,
          statusText: "Bad Request",
          headers: { "content-type": "text/plain" },
        }),
      );

      await expect(customFetch("/empty")).rejects.toSatisfy((err: ApiError) => {
        expect(err.data).toBeNull();
        return true;
      });
    });

    it("should return raw text when JSON parse fails in error body", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("{invalid}", {
          status: 400,
          statusText: "Bad Request",
          headers: { "content-type": "application/json" },
        }),
      );

      await expect(customFetch("/bad")).rejects.toSatisfy((err: ApiError) => {
        expect(err.data).toBe("{invalid}");
        return true;
      });
    });
  });

  describe("blob response handling", () => {
    it("should return blob for success with blob responseType", async () => {
      const blob = new Blob(["image data"]);
      mockFetch.mockResolvedValueOnce(
        new Response(blob, {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
      );

      const result = await customFetch("/image", { responseType: "blob" });
      expect(result).toBeInstanceOf(Blob);
    });

    it("should throw TypeError when blob is unsupported", async () => {
      const response = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png" }),
        body: undefined,
        text: vi.fn().mockResolvedValue(""),
      };
      mockFetch.mockResolvedValueOnce(response);

      await expect(
        customFetch("/image", { responseType: "blob" }),
      ).rejects.toThrow("Blob responses are not supported");
    });

    it("should infer blob from image content-type with auto", async () => {
      const blob = new Blob(["image data"]);
      const response = new Response(blob, {
        status: 200,
        headers: { "content-type": "image/png" },
      });
      mockFetch.mockResolvedValueOnce(response);

      const result = await customFetch("/image", { responseType: "auto" });
      expect(result).toBeInstanceOf(Blob);
    });
  });
});
