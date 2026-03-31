export function formatPnmlXml(xmlContent: string): string {
  const trimmed = xmlContent.trim();
  if (!trimmed) {
    throw new Error("pnml_format_empty_input");
  }

  const declarationMatch = trimmed.match(/^<\?xml[^?]*\?>/i);
  const declaration = declarationMatch ? declarationMatch[0] : null;
  const body = declaration ? trimmed.slice(declaration.length).trim() : trimmed;

  const tokens = body.match(/<[^>]+>|[^<]+/g) || [];
  const lines: string[] = [];
  let depth = 0;
  const indentUnit = "  ";

  for (const token of tokens) {
    const value = token.trim();
    if (!value) continue;

    const isComment = /^<!--/.test(value);
    const isClosingTag = /^<\//.test(value);
    const isSelfClosingTag = /^<[^!?][^>]*\/>$/.test(value);
    const isOpeningTag = /^<[^!?/][^>]*>$/.test(value);
    const isDoctype = /^<!DOCTYPE/i.test(value);

    if (isClosingTag) {
      depth = Math.max(0, depth - 1);
      lines.push(`${indentUnit.repeat(depth)}${value}`);
      continue;
    }

    lines.push(`${indentUnit.repeat(depth)}${value}`);

    if (isOpeningTag && !isSelfClosingTag && !isComment && !isDoctype) {
      depth += 1;
    }
  }

  if (declaration) {
    return `${declaration}\n${lines.join("\n")}\n`;
  }

  return `${lines.join("\n")}\n`;
}
