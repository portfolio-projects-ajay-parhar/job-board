import sanitizeHtml from "sanitize-html";

/**
 * Rich-text sanitizer (write-time pipeline).
 * Limited tag allowlist, no scripts/styles/iframes/events — render-time
 * sanitization also happens for defense in depth.
 */
export const sanitizeRichText = (html: string): string =>
  sanitizeHtml(html, {
    allowedTags: ["p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "h3", "h4", "blockquote", "a", "code", "pre"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
    disallowedTagsMode: "discard",
  });

/** Strip all tags to plain text (used for previews/excerpts). */
export const stripHtml = (html: string): string => sanitizeHtml(html, { allowedTags: [] }).trim();
