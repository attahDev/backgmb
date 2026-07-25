/**
 * Strips markdown formatting out of AI-generated text so it reads cleanly
 * in a plain chat bubble instead of showing raw `**`, `#`, `|`, `---`, etc.
 *
 * Used for every AI agent's reply — both the external HF Space responses
 * (which we can't control the formatting of) and Groq responses (which we
 * prompt to avoid markdown, but LLMs don't always fully comply, so this is
 * the safety net either way).
 */
export function sanitizeAiText(input: string): string {
  if (!input) return input;

  let text = input;

  // Fenced code blocks: drop the ``` fences, keep the content.
  text = text.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '');

  // Headers: "### Title" / "## Title" -> "Title"
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Horizontal rules: lines that are only -, *, or _ (markdown <hr>)
  text = text.replace(/^\s*([-*_])\1{2,}\s*$/gm, '');

  // Bold / italic / bold-italic: **text**, __text__, *text*, _text_
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
  text = text.replace(/___(.+?)___/g, '$1');
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/__(.+?)__/g, '$1');
  text = text.replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, '$1');
  text = text.replace(/(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])/g, '$1');

  // Inline code: `code` -> code
  text = text.replace(/`([^`]+)`/g, '$1');

  // Markdown tables: turn each row into a plain "cell — cell — cell" line
  // and drop the |---|---| separator rows entirely.
  text = text.replace(/^\|?\s*[-:]+[-:| ]*\|?\s*$/gm, '__TABLE_SEPARATOR__');
  text = text.replace(/^\|(.+)\|\s*$/gm, (_match, row: string) => {
    return row
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean)
      .join(' — ');
  });
  text = text
    .split('\n')
    .filter((line) => line.trim() !== '__TABLE_SEPARATOR__')
    .join('\n');

  // Markdown links: [text](url) -> text (url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');

  // Bullet markers: "- item" / "* item" / "• item" -> "- item" (consistent)
  text = text.replace(/^[ \t]*[*•][ \t]+/gm, '- ');

  // Blockquotes: "> text" -> "text"
  text = text.replace(/^>\s?/gm, '');

  // Collapse 3+ blank lines down to a max of one blank line
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}
