import { describe, expect, test } from "vitest";
import {
  parseReviewContent,
  reviewPlainText,
  reviewVideoId,
  reviewYoutubeId,
} from "./review-content";

describe("structured review content", () => {
  test("preserves supported marks and derives a usable plain text body", () => {
    const content = parseReviewContent({
      blocks: [
        {
          type: "heading",
          align: "center",
          children: [{ text: "Great film", bold: true }],
        },
        {
          type: "bulletList",
          items: [
            [{ text: "Read", underline: true, href: "https://example.com" }],
          ],
        },
        { type: "youtube", url: "https://youtu.be/dQw4w9WgXcQ" },
      ],
    });
    expect(content).not.toBeNull();
    expect(reviewPlainText(content!)).toBe("Great film\nRead");
    expect(reviewYoutubeId(content)).toBe("dQw4w9WgXcQ");
  });
  test.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "/local",
    "https://user:pw@example.com",
  ])("rejects unsafe link %s", (href) => {
    expect(
      parseReviewContent({
        blocks: [{ type: "paragraph", children: [{ text: "link", href }] }],
      }),
    ).toBeNull();
  });
  test("only accepts known YouTube URLs and rejects unsupported blocks", () => {
    expect(reviewVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(
      reviewVideoId("https://www.youtube.com.evil.test/watch?v=dQw4w9WgXcQ"),
    ).toBeNull();
    expect(reviewVideoId("ftp://youtu.be/dQw4w9WgXcQ")).toBeNull();
    expect(
      parseReviewContent({
        blocks: [{ type: "rawHtml", html: "<script></script>" }],
      }),
    ).toBeNull();
  });
});
