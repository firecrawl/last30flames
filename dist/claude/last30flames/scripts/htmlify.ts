// htmlify.ts
// Converts a markdown brief (the agent's synthesis, with numbered citations
// and a Sources list) into a self-contained dark-mode HTML file: inline CSS,
// no JavaScript, no external assets, so it works offline and drops cleanly
// into Slack, email, or Notion. Like the rest of the engine this does no LLM
// work and adds no dependencies - the markdown subset the brief uses is small
// enough to convert by hand.
//
//   bun run scripts/htmlify.ts brief.md              # writes brief.html
//   bun run scripts/htmlify.ts brief.md -o out.html  # explicit output path

const args = process.argv.slice(2);

const outFlag = args.indexOf("-o");
let outPath: string | undefined;
if (outFlag !== -1) {
  outPath = args[outFlag + 1];
  if (!outPath) {
    console.error("Missing value for -o.");
    process.exit(1);
  }
  args.splice(outFlag, 2);
}

const inPath = args[0];
if (!inPath) {
  console.error("Usage: bun run scripts/htmlify.ts <brief.md> [-o <brief.html>]");
  process.exit(1);
}
if (!outPath) outPath = inPath.replace(/\.md$/i, "") + ".html";

const markdown = await Bun.file(inPath).text();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Inline markdown → HTML on already-escaped text. Handles the subset a brief
// actually uses: code spans, links, bold, italic, and bare [N] citations,
// which become anchors jumping to the matching Sources entry.
function inline(escaped: string): string {
  let s = escaped;
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2">$1</a>',
  );
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  // Citation like [3] (not followed by "(" - that form was already a link).
  s = s.replace(/\[(\d+)\](?!\()/g, '<a class="cite" href="#src-$1">[$1]</a>');
  return s;
}

// A Sources line: "[1] [Title](url) - domain". Rendered as a list item whose
// id is the citation anchor target.
const SOURCE_LINE = /^\[(\d+)\]\s+(.*)$/;

const lines = markdown.split(/\r?\n/);
const body: string[] = [];
let title = "Research brief";
let sawTitle = false;
let paragraph: string[] = [];
let listOpen: "ul" | "ol" | null = null;

function flushParagraph() {
  if (paragraph.length) {
    body.push(`<p>${inline(escapeHtml(paragraph.join(" ")))}</p>`);
    paragraph = [];
  }
}
function closeList() {
  if (listOpen) {
    body.push(`</${listOpen}>`);
    listOpen = null;
  }
}

for (const raw of lines) {
  const line = raw.trimEnd();
  const heading = line.match(/^(#{1,4})\s+(.*)$/);
  const bullet = line.match(/^[-*]\s+(.*)$/);
  const source = line.match(SOURCE_LINE);

  if (!line.trim()) {
    flushParagraph();
    closeList();
  } else if (heading) {
    flushParagraph();
    closeList();
    const level = heading[1]!.length;
    const text = heading[2]!;
    if (!sawTitle && level === 1) {
      title = text;
      sawTitle = true;
    }
    body.push(`<h${level}>${inline(escapeHtml(text))}</h${level}>`);
  } else if (line.match(/^(-{3,}|\*{3,})$/)) {
    flushParagraph();
    closeList();
    body.push("<hr>");
  } else if (source) {
    flushParagraph();
    if (listOpen !== "ol") {
      closeList();
      body.push('<ol class="sources">');
      listOpen = "ol";
    }
    body.push(
      `<li id="src-${source[1]}" value="${source[1]}">${inline(escapeHtml(source[2]!))}</li>`,
    );
  } else if (bullet) {
    flushParagraph();
    if (listOpen !== "ul") {
      closeList();
      body.push("<ul>");
      listOpen = "ul";
    }
    body.push(`<li>${inline(escapeHtml(bullet[1]!))}</li>`);
  } else {
    closeList();
    paragraph.push(line.trim());
  }
}
flushParagraph();
closeList();

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0;
    padding: 2.5rem 1.25rem 4rem;
    background: #141414;
    color: #dbdbdb;
    font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  main { max-width: 42rem; margin: 0 auto; }
  h1, h2, h3, h4 { color: #f9f9f9; line-height: 1.3; }
  h1 { font-size: 1.6rem; margin-bottom: 0.5rem; }
  h2 { font-size: 1.2rem; margin-top: 2rem; }
  a { color: #fa5d19; text-decoration: none; }
  a:hover { text-decoration: underline; }
  a.cite {
    font-size: 0.8em;
    vertical-align: super;
    line-height: 0;
    padding: 0 0.1em;
  }
  code {
    background: #262626;
    border-radius: 4px;
    padding: 0.1em 0.35em;
    font-size: 0.9em;
  }
  hr { border: 0; border-top: 1px solid #2a2a2a; margin: 2rem 0; }
  ol.sources {
    padding-left: 1.5rem;
    border-top: 1px solid #2a2a2a;
    margin-top: 2rem;
    padding-top: 1rem;
  }
  ol.sources li { margin: 0.35rem 0; overflow-wrap: anywhere; }
  li:target { color: #f9f9f9; }
</style>
</head>
<body>
<main>
${body.join("\n")}
</main>
</body>
</html>
`;

await Bun.write(outPath, html);
console.log(outPath);
