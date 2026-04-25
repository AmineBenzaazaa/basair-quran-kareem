export type TextRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  highlight: boolean;
};

export function parseRichText(input: string): TextRun[] | null {
  if (!input || !/<[^>]+>/.test(input)) return null;

  const runs: TextRun[] = [];
  let bold = 0;
  let italic = 0;
  let underline = 0;
  let strikethrough = 0;
  let highlight = 0;
  let pos = 0;

  const tagRe = /<(\/?)(\w+)[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(input)) !== null) {
    if (match.index > pos) {
      const text = decodeEntities(input.slice(pos, match.index));
      if (text) {
        runs.push({
          text,
          bold: bold > 0,
          italic: italic > 0,
          underline: underline > 0,
          strikethrough: strikethrough > 0,
          highlight: highlight > 0,
        });
      }
    }
    pos = match.index + match[0].length;

    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    const delta = closing ? -1 : 1;

    if (tag === "strong" || tag === "b") bold = Math.max(0, bold + delta);
    else if (tag === "em" || tag === "i") italic = Math.max(0, italic + delta);
    else if (tag === "u") underline = Math.max(0, underline + delta);
    else if (tag === "s" || tag === "strike" || tag === "del") strikethrough = Math.max(0, strikethrough + delta);
    else if (tag === "mark") highlight = Math.max(0, highlight + delta);
  }

  if (pos < input.length) {
    const text = decodeEntities(input.slice(pos));
    if (text) {
      runs.push({
        text,
        bold: bold > 0,
        italic: italic > 0,
        underline: underline > 0,
        strikethrough: strikethrough > 0,
        highlight: highlight > 0,
      });
    }
  }

  return runs.length > 0 ? runs : null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
