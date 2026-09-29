import { extractText, getDocumentProxy } from 'unpdf';

export async function extractPdfText(data: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  try {
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(text) ? text : [text];
    return pages.join('\n').split('\u0000').join('').trim();
  } finally {
    const cleanup = pdf as { destroy?: unknown };
    if (typeof cleanup.destroy === 'function') {
      await cleanup.destroy();
    }
  }
}
