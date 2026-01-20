import { defineEventHandler, getQuery } from 'h3';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const title = decodeURIComponent((query.title as string) || 'Documentation');
  const description = decodeURIComponent((query.description as string) || '');
  
  // Truncate text to fit (approximate character limits)
  const displayTitle = title.length > 60 ? title.substring(0, 57) + '...' : title;
  const displayDescription = description.length > 120 ? description.substring(0, 117) + '...' : description;
  
  // Split title into lines if needed (max ~35 chars per line for 64px font)
  const titleLines = splitIntoLines(displayTitle, 35);
  const descLines = description ? splitIntoLines(displayDescription, 50) : [];
  
  // Generate SVG-based OG image matching the reference design
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <!-- White background -->
  <rect width="1200" height="630" fill="#FFFFFF"/>
  
  <!-- Blue accent line above title -->
  <line x1="80" y1="120" x2="200" y2="120" stroke="#3B82F6" stroke-width="4" stroke-linecap="round"/>
  
  <!-- Title -->
  ${titleLines.map((line, i) => 
    `<text x="80" y="${180 + (i * 80)}" font-family="ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace" font-size="64" font-weight="700" fill="#000000">${escapeXml(line)}</text>`
  ).join('\n  ')}
  
  <!-- Description -->
  ${descLines.map((line, i) => 
    `<text x="80" y="${280 + (titleLines.length - 1) * 80 + (i * 40)}" font-family="ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace" font-size="32" fill="#4B5563">${escapeXml(line)}</text>`
  ).join('\n  ')}
  
  <!-- Author with blue dot -->
  <circle cx="80" cy="550" r="6" fill="#3B82F6"/>
  <text x="100" y="558" font-family="ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace" font-size="24" fill="#000000">by Private Connect</text>
  
  <!-- Domain -->
  <text x="1120" y="558" font-family="ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace" font-size="24" fill="#000000" text-anchor="end">privateconnect.co</text>
</svg>`.trim();
  
  event.node.res.setHeader('Content-Type', 'image/svg+xml');
  event.node.res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return svg;
});

function splitIntoLines(text: string, maxChars: number): string[] {
  if (!text) return [];
  
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length > maxChars && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.length > 0 ? lines : [text];
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
