import { describe, expect, it } from "vitest";

import { generateSerial, looksLikeSerial, normaliseSerial } from "@/lib/certificate-serial";

describe("generateSerial", () => {
  it("produces the documented shape", () => {
    expect(generateSerial()).toMatch(/^CRS(-[0-9A-HJ-KM-NP-TV-Z]{5}){4}$/);
  });

  it("never emits the ambiguous letters", () => {
    // I/1 and O/0 are the pairs people mistype; U is dropped so a random run
    // cannot spell something unfortunate.
    const sample = Array.from({ length: 200 }, generateSerial).join("");
    const body = sample.replaceAll("CRS", "").replaceAll("-", "");
    for (const letter of ["I", "L", "O", "U"]) {
      expect(body).not.toContain(letter);
    }
  });

  it("is unique across a large sample", () => {
    // The serial is the capability for public verification, so a collision is
    // not merely untidy — it would expose the wrong person's credential.
    const serials = new Set(Array.from({ length: 5000 }, generateSerial));
    expect(serials.size).toBe(5000);
  });

  it("is not derived from anything predictable", () => {
    // Two serials generated in the same millisecond must not share a prefix,
    // which they would if the source were a timestamp or a counter.
    const [first, second] = [generateSerial(), generateSerial()];
    expect(first.slice(0, 9)).not.toBe(second.slice(0, 9));
  });

  it("carries 20 random characters", () => {
    const body = generateSerial().replace("CRS-", "").replaceAll("-", "");
    expect(body).toHaveLength(20);
  });
});

describe("normaliseSerial", () => {
  it("uppercases and trims", () => {
    expect(normaliseSerial("  crs-abcde-fghjk-mnpqr-stvwx  ")).toBe("CRS-ABCDE-FGHJK-MNPQR-STVWX");
  });

  it("strips internal whitespace, so a pasted serial still resolves", () => {
    expect(normaliseSerial("CRS ABCDE FGHJK")).toBe("CRSABCDEFGHJK");
  });

  it("leaves an already-clean serial untouched", () => {
    const serial = generateSerial();
    expect(normaliseSerial(serial)).toBe(serial);
  });
});

describe("looksLikeSerial", () => {
  it("accepts a generated serial", () => {
    expect(looksLikeSerial(generateSerial())).toBe(true);
  });

  it("accepts one typed in lower case", () => {
    expect(looksLikeSerial(generateSerial().toLowerCase())).toBe(true);
  });

  it("rejects the wrong shape", () => {
    expect(looksLikeSerial("CRS-SYST-X7HWL0")).toBe(false);
    expect(looksLikeSerial("not-a-serial")).toBe(false);
    expect(looksLikeSerial("")).toBe(false);
  });

  it("rejects a serial containing an excluded letter", () => {
    expect(looksLikeSerial("CRS-ABCDI-FGHJK-MNPQR-STVWX")).toBe(false);
  });

  it("still recognises a serial issued under the previous brand", () => {
    // Certificates printed before the rename must keep verifying.
    expect(looksLikeSerial("LUM-ABCDE-FGHJK-MNPQR-STVWX")).toBe(true);
    expect(looksLikeSerial("lum-abcde-fghjk-mnpqr-stvwx")).toBe(true);
  });
});
