/**
 * Certificate serials.
 *
 * Pure functions, deliberately outside the `server-only` boundary: the seed
 * script needs the generator and the verification form needs the normaliser,
 * and neither touches a request, a session or a database.
 *
 * Randomness comes from the Web Crypto API rather than `node:crypto`. Both are
 * cryptographically secure, but `node:` imports cannot be bundled for the
 * browser — and this module is reached from a client component, so importing
 * the Node built-in would break the build for the sake of the same bytes.
 */

/**
 * Crockford base32 without I, L, O or U.
 *
 * Those four are excluded because a serial gets read aloud, written down and
 * retyped — 1/I and 0/O are the pairs people get wrong. U is dropped so a
 * random run cannot spell something unfortunate.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Twenty random characters over a 32-symbol alphabet: 100 bits of entropy.
 *
 * That matters more than it looks. The serial is the capability for the public
 * verification page, so a predictable one would let anyone enumerate other
 * people's credentials and the names printed on them.
 */
export function generateSerial(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);

  let body = "";
  for (const byte of bytes) {
    // A 256-value byte modulo 32 divides exactly, so no value is favoured.
    body += ALPHABET[byte % ALPHABET.length];
  }

  return `CRS-${body.slice(0, 5)}-${body.slice(5, 10)}-${body.slice(10, 15)}-${body.slice(15, 20)}`;
}

/** Normalises whatever someone typed into the verification form. */
export function normaliseSerial(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Whether a string is shaped like a Coursera serial.
 *
 * Both prefixes are accepted. `CRS-` is what the generator issues; `LUM-` is
 * what it issued before the product was renamed. A serial is a credential
 * someone may have printed or shared years earlier, so the verifier has to keep
 * recognising the old shape — refusing it would invalidate real certificates to
 * tidy up a regex.
 */
export function looksLikeSerial(input: string): boolean {
  return /^(CRS|LUM)(-[0-9A-HJ-KM-NP-TV-Z]{5}){4}$/.test(normaliseSerial(input));
}
