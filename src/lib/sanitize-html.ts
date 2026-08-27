/**
 * Allowlist sanitiser for instructor-authored lesson HTML.
 *
 * Article lessons are rendered with `dangerouslySetInnerHTML`, which makes this
 * the one place in the product where stored HTML becomes executable. Today that
 * HTML only comes from the seed, because the authoring flow was never built —
 * but "not reachable yet" is a property of the current feature set, not of the
 * renderer, and it stops being true the moment an editor ships. Sanitising at
 * the point of read means the renderer is safe regardless of what the writer
 * ever allows.
 *
 * It is an **allowlist**: everything not named here is dropped. A denylist of
 * dangerous tags is the version of this that always loses, because the attacker
 * only has to find one tag the list forgot.
 *
 * No dependency. `sanitize-html` and DOMPurify are both better general-purpose
 * tools, but both are considerably larger than the fixed, tiny grammar that
 * lesson content actually uses — and DOMPurify needs a DOM, which this does not
 * have on the server.
 */

/** Exactly the tags the article stylesheet knows how to render. */
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "a",
  "code",
  "pre",
  "blockquote",
  "hr",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
]);

/** Attributes permitted, per tag. Everything else is stripped. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
};

/** Void elements, which must not be given a closing tag. */
const VOID_TAGS = new Set(["br", "hr", "img"]);

/**
 * Schemes a link may use.
 *
 * `javascript:` is the obvious exclusion; `data:` is the less obvious one, and
 * matters just as much, because `data:text/html` in an href executes.
 */
const SAFE_HREF = /^(?:https?:|mailto:|#|\/(?!\/))/i;

/**
 * Schemes an image may use.
 *
 * `data:image/` is allowed where `data:` in an href is not: an inline image is
 * ordinary lesson content, and an image data URI cannot navigate or execute the
 * way `data:text/html` can.
 */
const SAFE_SRC = /^(?:https?:|\/(?!\/)|data:image\/(?:png|jpe?g|gif|webp|avif);base64,)/i;

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Parses an attribute list into the pairs that survive the allowlist. */
function keptAttributes(tag: string, raw: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed || !raw.trim()) return "";

  const kept: string[] = [];
  const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw)) !== null) {
    const name = (match[1] ?? "").toLowerCase();
    if (!allowed.has(name)) continue;

    const value = match[3] ?? match[4] ?? match[5] ?? "";

    if (name === "src") {
      const cleaned = value.replace(/[\u0000-\u0020\u007f]/g, "");
      if (!SAFE_SRC.test(cleaned)) continue;
      kept.push(`src="${escapeText(cleaned)}"`);
      continue;
    }

    if (name === "href") {
      // Whitespace and control characters are stripped first: `java\nscript:`
      // is a URL browsers happily execute and a naive prefix test misses.
      const cleaned = value.replace(/[\u0000-\u0020\u007f]/g, "");
      if (!SAFE_HREF.test(cleaned)) continue;
      kept.push(`href="${escapeText(cleaned)}"`);
      continue;
    }

    kept.push(`${name}="${escapeText(value)}"`);
  }

  if (tag === "img") {
    // An <img> that survived without a src is not an image; drop the element's
    // attributes entirely rather than emit a broken one.
    if (!kept.some((attr) => attr.startsWith('src="'))) return "";
    if (!kept.some((attr) => attr.startsWith('alt="'))) kept.push('alt=""');
    kept.push('loading="lazy"');
  }

  // External links get the treatment that stops the opened page reaching back
  // through `window.opener`.
  if (tag === "a" && kept.some((attr) => attr.startsWith('href="http'))) {
    kept.push('target="_blank"', 'rel="noopener noreferrer nofollow"');
  }

  return kept.length > 0 ? ` ${kept.join(" ")}` : "";
}

/**
 * Returns the input reduced to the allowed grammar.
 *
 * Unbalanced or unknown tags are dropped rather than repaired — the result is
 * always a subset of the input, never an invention.
 */
export function sanitizeLessonHtml(input: string | null | undefined): string | null {
  if (!input) return null;

  // Comments can hide markup from a naive tag scanner, and conditional
  // comments are executable in some engines. They carry nothing lessons need.
  let working = input.replace(/<!--[\s\S]*?-->/g, "");

  // Drop whole elements whose *content* is dangerous, not just their tags —
  // stripping `<script>` alone would leave its body behind as visible text
  // that some parsers re-interpret.
  working = working.replace(
    /<\s*(script|style|iframe|object|embed|template|noscript|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi,
    "",
  );
  // …and the unclosed forms of the same.
  working = working.replace(
    /<\s*\/?\s*(script|style|iframe|object|embed|template|noscript|svg|math)\b[^>]*>/gi,
    "",
  );

  const open: string[] = [];
  let output = "";
  let cursor = 0;

  const tagPattern = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(working)) !== null) {
    output += escapeText(working.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const closing = match[1] === "/";
    const tag = (match[2] ?? "").toLowerCase();
    const attrs = match[3] ?? "";

    if (!ALLOWED_TAGS.has(tag)) continue;

    if (VOID_TAGS.has(tag)) {
      if (closing) continue;

      // Void elements still carry attributes — an <img> without its src is
      // not a safer image, it is a broken one.
      const kept = keptAttributes(tag, attrs);

      // An element that needs attributes to mean anything and has none left
      // after the allowlist is dropped rather than emitted empty.
      if (tag === "img" && kept === "") continue;

      output += `<${tag}${kept} />`;
      continue;
    }

    if (closing) {
      // Only close a tag this pass actually opened, so a stray `</div>` in the
      // source cannot close a wrapper the page owns.
      const index = open.lastIndexOf(tag);
      if (index === -1) continue;
      while (open.length > index) output += `</${open.pop()}>`;
      continue;
    }

    open.push(tag);
    output += `<${tag}${keptAttributes(tag, attrs)}>`;
  }

  output += escapeText(working.slice(cursor));

  // Close anything the author left open, so the fragment cannot swallow the
  // markup that follows it on the page.
  while (open.length > 0) output += `</${open.pop()}>`;

  return output;
}
