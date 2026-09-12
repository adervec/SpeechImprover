// Turn a dropped document into plain text for a reading project.
// ponytail: TXT/MD/HTML natively; PDF via pdf.js pulled from cdnjs on demand (zero
// bundle cost, needs network once). DOCX/EPUB are zips — paste the text for now;
// add a DecompressionStream zip reader if it comes up.

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
export const ACCEPT = '.txt,.md,.markdown,.text,.html,.htm,.pdf';

export async function fileToText(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return tidy(await pdfToText(file));
  const raw = await file.text();
  if (name.endsWith('.html') || name.endsWith('.htm') || file.type === 'text/html') return tidy(htmlToText(raw));
  return tidy(raw);
}

export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,nav,header,footer,aside').forEach((n) => n.remove());
  doc.querySelectorAll('br').forEach((n) => n.replaceWith('\n'));
  doc.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,tr,blockquote,pre').forEach((n) => n.append('\n\n'));
  return doc.body.textContent;
}

async function pdfToText(file) {
  const pdfjs = await import(/* @vite-ignore */ PDFJS);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS.replace('pdf.min.mjs', 'pdf.worker.min.mjs');
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const content = await (await pdf.getPage(i)).getTextContent();
    let s = '';
    for (const it of content.items) s += it.str + (it.hasEOL ? '\n' : ' ');
    pages.push(s);
  }
  // ponytail: one paragraph per page — pdf.js gives lines, not paragraphs. The
  // chunker fills on sentence boundaries anyway, so reading passages stay sane.
  return pages.join('\n\n');
}

// Normalise whatever came out: CRLF, hyphenated line breaks, runaway blank lines.
export function tidy(text) {
  return (text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .replace(/[ \t\xa0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function demo() {
  const t = tidy('Line one\r\n\r\n\r\n  spaced   out   con-\r\ntinued.  ');
  console.assert(t === 'Line one\n\nspaced out continued.', `tidy: ${JSON.stringify(t)}`);
  console.assert(tidy('') === '', 'empty stays empty');
  return t;
}
