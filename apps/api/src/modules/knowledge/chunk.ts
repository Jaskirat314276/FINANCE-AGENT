/**
 * Markdown chunker for the knowledge pipeline.
 * Splits a document along headings, splits over-long sections by paragraph,
 * and merges tiny fragments — so each chunk is one coherent passage to distill.
 * Pure and deterministic.
 */

export interface MarkdownChunk {
  /** The nearest heading text (empty for a preamble). */
  heading: string;
  /** The chunk body, prefixed with its heading. */
  text: string;
  index: number;
}

interface Section {
  heading: string;
  body: string[];
}

export function chunkMarkdown(md: string, opts: { maxChars?: number; minChars?: number } = {}): MarkdownChunk[] {
  const maxChars = opts.maxChars ?? 2400;
  const minChars = opts.minChars ?? 200;

  // 1) Split into heading-delimited sections.
  const sections: Section[] = [];
  let cur: Section = { heading: '', body: [] };
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      if (cur.heading || cur.body.join('').trim()) sections.push(cur);
      cur = { heading: h[2]!.trim(), body: [] };
    } else {
      cur.body.push(line);
    }
  }
  if (cur.heading || cur.body.join('').trim()) sections.push(cur);

  // 2) Emit chunks, splitting over-long section bodies by paragraph.
  const chunks: MarkdownChunk[] = [];
  let idx = 0;
  for (const s of sections) {
    const body = s.body.join('\n').trim();
    if (!body && !s.heading) continue;
    const full = s.heading ? `# ${s.heading}\n${body}`.trim() : body;

    if (full.length <= maxChars) {
      chunks.push({ heading: s.heading, text: full, index: idx++ });
      continue;
    }

    const head = s.heading ? `# ${s.heading}\n` : '';
    let buf = head;
    for (const para of body.split(/\n{2,}/)) {
      const candidate = buf.trim() ? `${buf}\n\n${para}` : `${head}${para}`;
      if (candidate.length > maxChars && buf.trim().length > head.length) {
        chunks.push({ heading: s.heading, text: buf.trim(), index: idx++ });
        buf = `${s.heading ? `# ${s.heading} (cont.)\n` : ''}${para}`;
      } else {
        buf = candidate;
      }
    }
    if (buf.trim()) chunks.push({ heading: s.heading, text: buf.trim(), index: idx++ });
  }

  // 3) Merge tiny adjacent chunks into the previous one when they fit.
  const merged: MarkdownChunk[] = [];
  for (const c of chunks) {
    const last = merged[merged.length - 1];
    if (last && last.text.length < minChars && last.text.length + c.text.length + 2 <= maxChars) {
      last.text = `${last.text}\n\n${c.text}`;
    } else {
      merged.push({ heading: c.heading, text: c.text, index: merged.length });
    }
  }
  return merged;
}
