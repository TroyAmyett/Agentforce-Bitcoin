/**
 * Strips Markdown formatting for plain-text search matching.
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, '')       // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // links -> text
    .replace(/#{1,6}\s/g, '')              // headings
    .replace(/[*_~`]+/g, '')              // bold, italic, strikethrough, code
    .replace(/^\s*[-*+]\s/gm, '')          // list markers
    .replace(/^\s*\d+\.\s/gm, '')          // numbered list markers
    .replace(/\n{2,}/g, '\n')             // collapse whitespace
    .trim();
}
