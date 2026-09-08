import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs so saveImageUpload tests never write into public/uploads.
vi.mock("fs/promises", () => ({ writeFile: vi.fn() }));
import { writeFile } from "fs/promises";

import { MAX_FILE_SIZE, validateImageFile } from "@/lib/upload-limits";
import { saveImageUpload } from "@/lib/upload";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG_MAGIC = [0xff, 0xd8, 0xff];

function pngFile(bytes = 16, size?: number): File {
  const buf = Buffer.from([...PNG_MAGIC, ...new Array(bytes).fill(0)]);
  return new File([size !== undefined ? Buffer.alloc(size) : buf], "x.png", { type: "image/png" });
}

describe("validateImageFile (client pre-check)", () => {
  it("accepts small PNG and JPEG files (jpg/jpeg share image/jpeg)", () => {
    expect(validateImageFile(pngFile())).toBeNull();
    expect(
      validateImageFile(new File([Buffer.from(JPG_MAGIC)], "x.jpg", { type: "image/jpeg" })),
    ).toBeNull();
    expect(
      validateImageFile(new File([Buffer.from(JPG_MAGIC)], "x.jpeg", { type: "image/jpeg" })),
    ).toBeNull();
  });

  it("rejects non-PNG/JPEG MIME types with the Thai type message", () => {
    for (const type of ["image/gif", "image/webp", "image/svg+xml", "application/octet-stream", ""]) {
      const msg = validateImageFile(new File([Buffer.alloc(8)], "x.gif", { type }));
      expect(msg).toBe("อนุญาตเฉพาะไฟล์ JPG และ PNG เท่านั้น");
    }
  });

  it("rejects files over 5 MB with the Thai size message; exact 5 MB passes", () => {
    expect(validateImageFile(pngFile(16, MAX_FILE_SIZE + 1))).toBe("ขนาดไฟล์ต้องไม่เกิน 5MB");
    expect(validateImageFile(pngFile(16, MAX_FILE_SIZE))).toBeNull();
  });
});

describe("saveImageUpload (server gate — authoritative for both upload routes)", () => {
  beforeEach(() => {
    vi.mocked(writeFile).mockClear();
  });

  it("rejects a file over 5 MB before reading or writing anything", async () => {
    const result = await saveImageUpload(pngFile(16, MAX_FILE_SIZE + 1));
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(400);
      expect(await result.error.json()).toEqual({ error: "ขนาดไฟล์ต้องไม่เกิน 5MB" });
    }
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("accepts a real PNG magic signature and returns a /uploads/*.png url", async () => {
    const result = await saveImageUpload(pngFile());
    expect("url" in result).toBe(true);
    if ("url" in result) expect(result.url).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  it("accepts a real JPEG magic signature and returns a /uploads/*.jpg url", async () => {
    const result = await saveImageUpload(
      new File([Buffer.from([...JPG_MAGIC, 0, 0, 0, 0])], "x.jpg", { type: "image/jpeg" }),
    );
    expect("url" in result).toBe(true);
    if ("url" in result) expect(result.url).toMatch(/^\/uploads\/[0-9a-f-]+\.jpg$/);
  });

  it("rejects content whose magic bytes are neither PNG nor JPEG (spoofed MIME)", async () => {
    const result = await saveImageUpload(
      new File([Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])], "evil.gif", { type: "image/png" }),
    );
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(400);
      expect(await result.error.json()).toEqual({ error: "อนุญาตเฉพาะไฟล์ PNG และ JPG เท่านั้น" });
    }
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("lib/upload re-exports the single MAX_FILE_SIZE constant", async () => {
    const server = await import("@/lib/upload");
    expect(server.MAX_FILE_SIZE).toBe(MAX_FILE_SIZE);
  });
});
