import { describe, expect, it } from "vitest";

import { sanitizeLessonHtml } from "@/lib/sanitize-html";

/**
 * A sanitiser is only worth having if the attacks it exists to stop are the
 * ones it is tested against. These are the standard payloads — not decorative
 * cases — plus the encoding tricks that defeat a naive prefix check.
 */

/** Anything that would execute, in any form the output could reach a browser. */
function looksExecutable(html: string): boolean {
  return /<\s*script|javascript:|\son\w+\s*=|<\s*iframe|<\s*object|<\s*embed|data:text\/html/i.test(
    html,
  );
}

describe("sanitizeLessonHtml", () => {
  it("keeps the markup lessons are actually written in", () => {
    const input =
      "<h2>Heading</h2><p>Some <strong>bold</strong> and <em>italic</em> text.</p><ul><li>One</li><li>Two</li></ul>";
    expect(sanitizeLessonHtml(input)).toBe(input);
  });

  it("returns null for empty input", () => {
    expect(sanitizeLessonHtml(null)).toBeNull();
    expect(sanitizeLessonHtml(undefined)).toBeNull();
    expect(sanitizeLessonHtml("")).toBeNull();
  });

  describe("script execution", () => {
    const payloads = [
      "<script>alert(1)</script>",
      "<SCRIPT>alert(1)</SCRIPT>",
      "<scr<script>ipt>alert(1)</script>",
      '<img src=x onerror="alert(1)">',
      "<img src=x onerror=alert(1)>",
      "<svg/onload=alert(1)>",
      "<body onload=alert(1)>",
      '<iframe src="javascript:alert(1)"></iframe>',
      '<object data="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="></object>',
      '<a href="javascript:alert(1)">click</a>',
      '<a href="JaVaScRiPt:alert(1)">click</a>',
      '<a href="java\nscript:alert(1)">click</a>',
      '<a href="  javascript:alert(1)">click</a>',
      '<a href="data:text/html,<script>alert(1)</script>">click</a>',
      '<style>body{background:url("javascript:alert(1)")}</style>',
      "<!--<script>alert(1)</script>-->",
      '<p onclick="alert(1)">text</p>',
      '<form action="javascript:alert(1)"><button>go</button></form>',
      "<math><mtext><script>alert(1)</script></mtext></math>",
      "<template><script>alert(1)</script></template>",
    ];

    for (const payload of payloads) {
      it(`neutralises ${payload.slice(0, 46)}`, () => {
        const output = sanitizeLessonHtml(payload) ?? "";
        expect(looksExecutable(output)).toBe(false);
      });
    }
  });

  describe("images", () => {
    it("keeps a legitimate image and its alt text", () => {
      const output = sanitizeLessonHtml('<img src="/diagram.png" alt="A diagram">') ?? "";
      expect(output).toContain('src="/diagram.png"');
      expect(output).toContain('alt="A diagram"');
      expect(output).toContain('loading="lazy"');
    });

    it("keeps the src through the void-element path", () => {
      // Regression: void tags were briefly emitted without their attributes,
      // which silently turned every lesson image into a blank element.
      expect(sanitizeLessonHtml('<img src="https://cdn.test/a.png">')).toContain(
        'src="https://cdn.test/a.png"',
      );
    });

    it("supplies an empty alt when the author omitted one", () => {
      expect(sanitizeLessonHtml('<img src="/x.png">')).toContain('alt=""');
    });

    it("drops the handler but keeps the image", () => {
      const output = sanitizeLessonHtml('<img src="/x.png" onerror="alert(1)">') ?? "";
      expect(output).toContain('src="/x.png"');
      expect(output).not.toContain("onerror");
    });

    it("allows an inline image data URI but not an inline document", () => {
      expect(sanitizeLessonHtml('<img src="data:image/png;base64,iVBORw0KGgo=">')).toContain(
        "data:image/png;base64",
      );
      expect(sanitizeLessonHtml('<img src="data:text/html,<script>alert(1)</script>">')).toBe("");
    });

    it("drops an image whose src did not survive", () => {
      expect(sanitizeLessonHtml('<img src="javascript:alert(1)" alt="x">')).toBe("");
    });
  });

  it("strips every attribute that is not explicitly allowed", () => {
    const output = sanitizeLessonHtml('<p class="x" style="color:red" id="y">text</p>') ?? "";
    expect(output).toBe("<p>text</p>");
  });

  it("keeps a safe href and drops an unsafe one, on the same element type", () => {
    expect(sanitizeLessonHtml('<a href="https://example.com">ok</a>')).toContain(
      'href="https://example.com"',
    );
    expect(sanitizeLessonHtml('<a href="javascript:alert(1)">no</a>')).toBe("<a>no</a>");
  });

  it("allows relative and anchor links but not protocol-relative ones", () => {
    expect(sanitizeLessonHtml('<a href="/courses">x</a>')).toContain('href="/courses"');
    expect(sanitizeLessonHtml('<a href="#section">x</a>')).toContain('href="#section"');
    // `//evil.test` inherits the page protocol and leaves the site silently.
    expect(sanitizeLessonHtml('<a href="//evil.test">x</a>')).toBe("<a>x</a>");
  });

  it("hardens external links against window.opener", () => {
    const output = sanitizeLessonHtml('<a href="https://example.com">x</a>') ?? "";
    expect(output).toContain('rel="noopener noreferrer nofollow"');
  });

  it("escapes text so it cannot become markup", () => {
    expect(sanitizeLessonHtml("5 < 6 && 7 > 6")).toBe("5 &lt; 6 &amp;&amp; 7 &gt; 6");
  });

  it("drops unknown tags but keeps their text", () => {
    expect(sanitizeLessonHtml("<div><span>kept</span></div>")).toBe("kept");
  });

  it("closes tags the author left open, so it cannot swallow the page", () => {
    expect(sanitizeLessonHtml("<p>unclosed")).toBe("<p>unclosed</p>");
  });

  it("ignores a stray closing tag it never opened", () => {
    expect(sanitizeLessonHtml("</p>text")).toBe("text");
  });

  it("renders void elements without a closing tag", () => {
    expect(sanitizeLessonHtml("a<br>b")).toBe("a<br />b");
  });

  it("is idempotent — sanitising twice changes nothing further", () => {
    const once = sanitizeLessonHtml('<p onclick="x()">a <a href="https://e.test">b</a></p>');
    expect(sanitizeLessonHtml(once)).toBe(once);
  });
});
