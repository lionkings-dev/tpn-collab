import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function printUsage() {
  console.log(
    "Usage: npm run pnml:format -- <input-file> [--out <output-file>] [--stdout]",
  );
}

function formatXml(xmlContent) {
  const trimmed = xmlContent.trim();
  if (!trimmed) {
    throw new Error("pnml_format_empty_input");
  }

  const declarationMatch = trimmed.match(/^<\?xml[^?]*\?>/i);
  const declaration = declarationMatch ? declarationMatch[0] : null;
  const body = declaration ? trimmed.slice(declaration.length).trim() : trimmed;

  const tokens = body.match(/<[^>]+>|[^<]+/g) || [];
  const lines = [];
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

function parseArgs(argv) {
  const args = [...argv];
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return { help: true };
  }

  const inputPath = args[0];
  if (!inputPath || inputPath.startsWith("--")) {
    throw new Error("pnml_format_missing_input");
  }

  let outputPath = null;
  let printToStdout = false;

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--stdout") {
      printToStdout = true;
      continue;
    }

    if (arg === "--out") {
      const nextArg = args[index + 1];
      if (!nextArg || nextArg.startsWith("--")) {
        throw new Error("pnml_format_missing_out_path");
      }

      outputPath = nextArg;
      index += 1;
      continue;
    }

    throw new Error(`pnml_format_unknown_arg:${arg}`);
  }

  return {
    help: false,
    inputPath,
    outputPath,
    printToStdout,
  };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    printUsage();
    return;
  }

  const absoluteInputPath = resolve(parsed.inputPath);
  const inputContent = await readFile(absoluteInputPath, "utf8");
  const formatted = formatXml(inputContent);

  if (parsed.printToStdout) {
    process.stdout.write(formatted);
    return;
  }

  const outputPath = parsed.outputPath
    ? resolve(parsed.outputPath)
    : absoluteInputPath;
  await writeFile(outputPath, formatted, "utf8");

  if (parsed.outputPath) {
    console.log(`Formatted PNML written to ${outputPath}`);
    return;
  }

  console.log(`Formatted PNML in place: ${outputPath}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "pnml_format_failed";
  console.error(`PNML format failed: ${message}`);
  process.exitCode = 1;
});
