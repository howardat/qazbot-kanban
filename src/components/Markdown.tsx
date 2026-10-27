import { Fragment } from "react";

// A small, safe Markdown renderer for assistant replies: paragraphs, headings, bullet and numbered
// lists, **bold**, *italic* and `code`. It builds React elements (never HTML strings), so nothing in a
// reply can inject markup. Anything it doesn't recognise stays as plain text.

function inline(text: string, key: string) {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${key}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k} className="font-semibold">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em]">{tok.slice(1, -1)}</code>);
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block = { kind: "p" | "h" | "ul" | "ol"; lines: string[]; level?: number };

export function Markdown({ text }: { text: string }) {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const number = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const last = blocks.at(-1);
    if (!line.trim()) blocks.push({ kind: "p", lines: [] });
    else if (heading) blocks.push({ kind: "h", lines: [heading[2]], level: heading[1].length });
    else if (bullet) {
      if (last?.kind === "ul") last.lines.push(bullet[1]);
      else blocks.push({ kind: "ul", lines: [bullet[1]] });
    } else if (number) {
      if (last?.kind === "ol") last.lines.push(number[1]);
      else blocks.push({ kind: "ol", lines: [number[1]] });
    }
    else if (last?.kind === "p") last.lines.push(line);
    else blocks.push({ kind: "p", lines: [line] });
  }
  return (
    <div className="space-y-3 leading-relaxed">
      {blocks
        .filter((b) => b.lines.length > 0)
        .map((b, i) => {
          const k = String(i);
          if (b.kind === "h") return <p key={k} className={b.level === 1 ? "text-base font-semibold" : "font-semibold"}>{inline(b.lines[0], k)}</p>;
          if (b.kind === "ul")
            return (
              <ul key={k} className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
                {b.lines.map((l, j) => <li key={j}>{inline(l, `${k}-${j}`)}</li>)}
              </ul>
            );
          if (b.kind === "ol")
            return (
              <ol key={k} className="list-decimal space-y-1 pl-5 marker:text-muted-foreground">
                {b.lines.map((l, j) => <li key={j}>{inline(l, `${k}-${j}`)}</li>)}
              </ol>
            );
          return (
            <p key={k}>
              {b.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {inline(l, `${k}-${j}`)}
                </Fragment>
              ))}
            </p>
          );
        })}
    </div>
  );
}
