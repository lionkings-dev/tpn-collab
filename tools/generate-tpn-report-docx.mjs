import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from "docx";
import { marked } from "marked";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const vaultRoot = "/home/lionkings/Documents/Lionkings/03 Project/TPN_Report_Writing";
const assetsRoot = path.join(vaultRoot, "assets");
const outputPath = path.join(vaultRoot, "TPN Final Report Draft.docx");

const TH_FONT = "TH Sarabun New";
const EN_FONT = "Arial";
const PAGE = {
  width: 11906,
  height: 16838,
  margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
};

const FRONT_MATTER = {
  titleTh: "เครื่องมือแก้ไขไทม์เพทริเน็ตแบบทำงานร่วมกันผ่านเว็บ",
  titleEn: "A WEB-BASED COLLABORATIVE TIMED PETRI NET EDITOR",
  authorTh: "นายสิงหราช มาตย์แสง",
  authorEn: "Mr. Singharat Matsang",
  degreeTh: "วิทยาศาสตรบัณฑิต สาขาวิชาวิทยาการคอมพิวเตอร์",
  degreeEn: "Bachelor of Science in Computer Science",
  facultyTh: "คณะวิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยธรรมศาสตร์",
  facultyEn: "Faculty of Science and Technology, Thammasat University",
  academicYearTh: "ปีการศึกษา 2568",
  academicYearEn: "Academic Year 2025",
  advisorTh: "ผศ.ดร.เด่นดวง ประดับสุวรรณ",
  advisorEn: "Asst. Prof. Denduang Pradubsuwun, D.Eng.",
  committee: ["ผศ.ดร.อรจิรา สิทธิศักดิ์", "ผศ.ดร.ปกรณ์ ลี้สุทธิพรชัย"],
  approvalDateTh: "1 ธันวาคม พ.ศ. 2568",
};

const ABBREVIATIONS = [
  ["PNML", "Petri Net Markup Language"],
  ["PPP", "รูปแบบไฟล์ที่ใช้ในบริบทเดิมของงาน"],
  ["CRDT", "Conflict-free Replicated Data Type"],
  ["API", "Application Programming Interface"],
  ["UI", "User Interface"],
  ["Yjs", "ไลบรารีสำหรับ shared document state แบบเรียลไทม์"],
  ["WebSocket", "โปรโตคอลสื่อสารสองทิศทางแบบเรียลไทม์"],
];

const CHAPTER_FILES = [
  "01 Chapter 1 - Introduction.md",
  "02 Chapter 2 - Literature Review and Related Work.md",
  "03 Chapter 3 - Methodology Design and Implementation.md",
  "04 Chapter 4 - Results and Evaluation.md",
  "05 Chapter 5 - Conclusion and Recommendations.md",
  "06 Appendix - Supporting Materials.md",
].map((name) => path.join(vaultRoot, name));

const DEFAULT_RUN = {
  font: TH_FONT,
  size: 32,
};

marked.setOptions({ gfm: true, breaks: false });

function stripFrontmatter(markdown) {
  if (!markdown.startsWith("---\n")) return markdown;
  const end = markdown.indexOf("\n---", 4);
  if (end === -1) return markdown;
  return markdown.slice(end + 4).trimStart();
}

function escapeObsidianImages(markdown) {
  return markdown.replace(/!\[\[([^\]]+)\]\]/g, (_, target) => `![](${`obsidian:${target.trim()}`})`);
}

function readMarkdown(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return escapeObsidianImages(stripFrontmatter(raw));
}

function pngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error("Only PNG images are supported in this generator");
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function scaleImage(width, height, maxWidth = 520) {
  if (width <= maxWidth) return { width, height };
  const ratio = maxWidth / width;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function resolveAsset(target) {
  if (target.startsWith("obsidian:")) {
    const relative = target.replace(/^obsidian:/, "");
    return path.join(vaultRoot, relative);
  }
  return path.resolve(assetsRoot, target);
}

function paragraph(text, options = {}) {
  const content = text ?? "";
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: content, ...DEFAULT_RUN, ...(options.run || {}) })],
    ...options.paragraph,
  });
}

function centered(text, size = 36, bold = false) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text, font: TH_FONT, size, bold })],
  });
}

function blank() {
  return new Paragraph({ children: [new TextRun({ text: "", ...DEFAULT_RUN })] });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function headingForDepth(depth) {
  if (depth === 1) return HeadingLevel.HEADING_1;
  if (depth === 2) return HeadingLevel.HEADING_2;
  if (depth === 3) return HeadingLevel.HEADING_3;
  return HeadingLevel.HEADING_4;
}

function withStyle(run, style) {
  const next = { ...run };
  if (style.bold !== undefined) next.bold = style.bold;
  if (style.italics !== undefined) next.italics = style.italics;
  if (style.underline !== undefined) next.underline = style.underline;
  if (style.font !== undefined) next.font = style.font;
  return next;
}

function inlineRuns(tokens = [], style = {}) {
  const runs = [];
  for (const token of tokens) {
    if (token.type === "text" || token.type === "escape") {
      if (token.text) runs.push(new TextRun(withStyle({ text: token.text, ...DEFAULT_RUN }, style)));
      continue;
    }
    if (token.type === "codespan") {
      runs.push(new TextRun(withStyle({ text: token.text, font: EN_FONT, size: 30 }, style)));
      continue;
    }
    if (token.type === "strong") {
      runs.push(...inlineRuns(token.tokens, { ...style, bold: true }));
      continue;
    }
    if (token.type === "em") {
      runs.push(...inlineRuns(token.tokens, { ...style, italics: true }));
      continue;
    }
    if (token.type === "link") {
      const label = token.text || token.href;
      runs.push(new TextRun(withStyle({ text: label, color: "0563C1", underline: { type: UnderlineType.SINGLE }, ...DEFAULT_RUN }, style)));
      continue;
    }
    if (token.type === "image") {
      continue;
    }
    if (token.raw) {
      runs.push(new TextRun(withStyle({ text: token.raw, ...DEFAULT_RUN }, style)));
    }
  }
  if (runs.length === 0) runs.push(new TextRun({ text: "", ...DEFAULT_RUN }));
  return runs;
}

function imageParagraph(href) {
  const filePath = resolveAsset(href);
  const buffer = fs.readFileSync(filePath);
  const { width, height } = scaleImage(...Object.values(pngDimensions(buffer)));
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [
      new ImageRun({
        type: "png",
        data: buffer,
        transformation: { width, height },
        altText: {
          title: path.basename(filePath),
          description: path.basename(filePath),
          name: path.basename(filePath),
        },
      }),
    ],
  });
}

function tableFromToken(token) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" };
  const rows = [];
  const headerCells = token.header.map((cell) =>
    new TableCell({
      borders: { top: border, bottom: border, left: border, right: border },
      shading: { fill: "EAEAEA", type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: inlineRuns(cell.tokens ?? [{ type: "text", text: cell.text }], { bold: true }) })],
    }),
  );
  rows.push(new TableRow({ tableHeader: true, children: headerCells }));
  for (const row of token.rows) {
    rows.push(
      new TableRow({
        children: row.map((cell) =>
          new TableCell({
            borders: { top: border, bottom: border, left: border, right: border },
            children: [new Paragraph({ children: inlineRuns(cell.tokens ?? [{ type: "text", text: cell.text }]) })],
          }),
        ),
      }),
    );
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

function codeBlockTable(text) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" };
  const lines = text.split("\n");
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: { top: border, bottom: border, left: border, right: border },
            shading: { fill: "F7F7F7", type: ShadingType.CLEAR },
            children: lines.map((line) =>
              new Paragraph({ children: [new TextRun({ text: line, font: "Courier New", size: 24 })] }),
            ),
          }),
        ],
      }),
    ],
  });
}

function listParagraph(itemToken, reference) {
  const tokens = itemToken.tokens?.[0]?.tokens ?? [{ type: "text", text: itemToken.text || "" }];
  return new Paragraph({
    numbering: { reference, level: 0 },
    children: inlineRuns(tokens),
  });
}

function blocksFromMarkdown(markdown) {
  const tokens = marked.lexer(markdown, { gfm: true });
  const blocks = [];
  for (const token of tokens) {
    if (token.type === "space") continue;
    if (token.type === "heading") {
      blocks.push(
        new Paragraph({
          heading: headingForDepth(token.depth),
          spacing: { before: token.depth === 1 ? 240 : 160, after: 120 },
          children: inlineRuns(token.tokens),
        }),
      );
      continue;
    }
    if (token.type === "paragraph") {
      const imageToken = token.tokens?.length === 1 ? token.tokens[0] : null;
      if (imageToken?.type === "image") {
        blocks.push(imageParagraph(imageToken.href));
      } else {
        blocks.push(new Paragraph({ spacing: { after: 120 }, children: inlineRuns(token.tokens) }));
      }
      continue;
    }
    if (token.type === "list") {
      const reference = token.ordered ? "numbered-main" : "bullet-main";
      for (const item of token.items) blocks.push(listParagraph(item, reference));
      continue;
    }
    if (token.type === "table") {
      blocks.push(tableFromToken(token));
      blocks.push(blank());
      continue;
    }
    if (token.type === "code") {
      blocks.push(codeBlockTable(token.text));
      blocks.push(blank());
      continue;
    }
    if (token.type === "hr") {
      blocks.push(blank());
    }
  }
  return blocks;
}

function extractCaptions(notePath, regex) {
  const content = readMarkdown(notePath);
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => regex.test(line));
}

function buildListSection(title, items) {
  return [
    centered(title, 34, true),
    blank(),
    ...items.map((item) => paragraph(item, { paragraph: { spacing: { after: 80 } } })),
    pageBreak(),
  ];
}

function buildCoverPages() {
  const p = [];
  p.push(blank(), blank(), blank());
  p.push(centered(FRONT_MATTER.titleTh, 40, true));
  p.push(blank(), blank());
  p.push(centered("โดย", 32, false));
  p.push(centered(FRONT_MATTER.authorTh, 34, false));
  p.push(blank(), blank(), blank());
  p.push(centered("โครงงานพิเศษนี้เป็นส่วนหนึ่งของการศึกษาตามหลักสูตร", 30));
  p.push(centered(FRONT_MATTER.degreeTh, 30));
  p.push(centered(FRONT_MATTER.facultyTh, 30));
  p.push(centered(FRONT_MATTER.academicYearTh, 30));
  p.push(pageBreak());

  p.push(centered(FRONT_MATTER.titleEn, 34, true));
  p.push(blank(), blank());
  p.push(centered("BY", 30, false));
  p.push(centered(FRONT_MATTER.authorEn, 30, false));
  p.push(blank(), blank(), blank());
  p.push(centered("A FINAL-YEAR PROJECT REPORT SUBMITTED IN PARTIAL FULFILLMENT", 24));
  p.push(centered(`OF THE REQUIREMENTS FOR THE DEGREE OF ${FRONT_MATTER.degreeEn.toUpperCase()}`, 24));
  p.push(centered(FRONT_MATTER.facultyEn.toUpperCase(), 24));
  p.push(centered(FRONT_MATTER.academicYearEn.toUpperCase(), 24));
  p.push(pageBreak());

  p.push(centered("หน้ารับรองโครงงาน", 34, true));
  p.push(blank());
  p.push(centered(FRONT_MATTER.titleTh, 30, true));
  p.push(blank());
  p.push(paragraph(`ผู้จัดทำ: ${FRONT_MATTER.authorTh}`));
  p.push(paragraph(`อาจารย์ที่ปรึกษา: ${FRONT_MATTER.advisorTh}`));
  p.push(paragraph(`กรรมการสอบโครงงาน: ${FRONT_MATTER.committee.join("; ")}`));
  p.push(paragraph(`วันอนุมัติ: ${FRONT_MATTER.approvalDateTh}`));
  p.push(pageBreak());

  return p;
}

function buildAbstractPages() {
  const thaiAbstract = [
    "โครงงานนี้มีวัตถุประสงค์เพื่อพัฒนาเครื่องมือแก้ไขไทม์เพทริเน็ตบนเว็บที่รองรับการทำงานร่วมกันแบบเรียลไทม์ เพื่อแก้ข้อจำกัดของเครื่องมือแบบติดตั้งบนเครื่องที่เข้าถึงยากและไม่เอื้อต่อการทำงานร่วมกันในปัจจุบัน ระบบที่พัฒนาขึ้นช่วยให้ผู้ใช้หลายคนสามารถสร้าง แก้ไข และแชร์แบบจำลองเดียวกันได้ผ่านเว็บเบราว์เซอร์ พร้อมรองรับการจัดเก็บห้องทำงาน การบันทึกความเป็นเจ้าของห้อง และการนำเข้าและส่งออกข้อมูลในรูปแบบ PNML และ PPP",
    "ระบบพัฒนาขึ้นโดยใช้ React และ React Flow สำหรับส่วนติดต่อผู้ใช้ ใช้ Yjs และ y-websocket สำหรับซิงโครไนซ์ข้อมูลร่วมแบบเรียลไทม์ และใช้ Express ร่วมกับ MongoDB สำหรับการจัดการห้องทำงาน ผู้ใช้ และการจัดเก็บสถานะของเอกสารร่วม ผลการดำเนินงานแสดงให้เห็นว่าระบบสามารถรองรับการสร้างแบบจำลอง การแก้ไขร่วมกัน การเชิญผู้ร่วมงาน การผูกห้องกับบัญชีผู้ใช้ และการแลกเปลี่ยนข้อมูลกับไฟล์ภายนอกได้ในระดับที่ใช้งานได้จริง",
    "ความสามารถที่สำคัญของระบบคือการรองรับ PPP ในลักษณะที่สามารถนำเข้าไฟล์ที่ไม่มีข้อมูลพิกัดเดิมแล้วสร้างแบบจำลองกลับขึ้นมาบน editor ได้โดยอัตโนมัติ แม้ยังมีข้อจำกัดในบางกรณีที่กราฟมีความสัมพันธ์ซับซ้อนมาก ระบบโดยรวมยังช่วยให้การทำแบบจำลองไทม์เพทริเน็ตมีความสะดวก ยืดหยุ่น และเหมาะกับการทำงานร่วมกันมากขึ้น",
  ];
  const englishAbstract = [
    "This project presents a web-based Timed Petri Net editor that supports real-time collaboration in order to address the limitations of traditional desktop-only tools. The developed system allows multiple users to create, edit, and share the same model through a web browser while also supporting room persistence, ownership workflow, and data exchange through PNML and PPP.",
    "The system is implemented with React and React Flow for the user interface, Yjs and y-websocket for collaborative synchronization, and Express with MongoDB for room, user, and persistence management. The resulting application supports model editing, collaborative sessions, room invitation, ownership claiming, and interoperable import/export workflows in a practically usable form.",
    "A key contribution of the system is PPP support, especially the ability to import coordinate-less PPP input and reconstruct it into an editable graph layout on the editor. Although some dense graph patterns still present visual limitations, the overall system demonstrates that browser-based collaborative Timed Petri Net modeling is practical and extensible.",
  ];
  const ack = [
    `ผู้จัดทำขอกราบขอบพระคุณ ${FRONT_MATTER.advisorTh} อาจารย์ที่ปรึกษาโครงงาน ที่ให้คำแนะนำ ข้อเสนอแนะ และการตรวจสอบเนื้อหาของโครงงานอย่างต่อเนื่อง ทำให้การพัฒนาระบบและการจัดทำรายงานฉบับนี้สำเร็จลุล่วงได้อย่างมีทิศทาง`,
    "ขอขอบคุณเพื่อนร่วมงาน ผู้ทดสอบระบบ และผู้ที่ให้ข้อเสนอแนะเกี่ยวกับการใช้งานจริงของระบบ ซึ่งมีส่วนช่วยให้สามารถปรับปรุงทั้งในด้านการทำงานร่วมกันแบบเรียลไทม์ การจัดการห้องทำงาน และการนำเข้าและส่งออกข้อมูลได้ดียิ่งขึ้น",
    "ท้ายที่สุดนี้ ผู้จัดทำขอขอบคุณครอบครัวและผู้ที่ให้การสนับสนุนตลอดระยะเวลาการศึกษาและการทำโครงงาน หากรายงานฉบับนี้มีข้อบกพร่องประการใด ผู้จัดทำขอน้อมรับไว้แต่เพียงผู้เดียว และหวังเป็นอย่างยิ่งว่าโครงงานนี้จะเป็นประโยชน์ต่อการเรียนการสอนและการวิจัยด้านระบบเวลาจริงและการสร้างแบบจำลองแบบทำงานร่วมกันต่อไป",
  ];

  const sections = [];
  sections.push(centered("บทคัดย่อ", 34, true));
  sections.push(blank());
  sections.push(paragraph(`หัวข้อโครงงานพิเศษ ${FRONT_MATTER.titleTh}`));
  sections.push(paragraph(`ชื่อผู้เขียน ${FRONT_MATTER.authorTh}`));
  sections.push(paragraph(`ชื่อปริญญา ${FRONT_MATTER.degreeTh}`));
  sections.push(paragraph(`อาจารย์ที่ปรึกษา ${FRONT_MATTER.advisorTh}`));
  sections.push(paragraph(`ปีการศึกษา 2568`));
  sections.push(blank());
  thaiAbstract.forEach((text) => sections.push(paragraph(text)));
  sections.push(paragraph("คำสำคัญ: ไทม์เพทริเน็ต, การทำงานร่วมกันแบบเรียลไทม์, เครื่องมือบนเว็บ, PNML, PPP"));
  sections.push(pageBreak());

  sections.push(centered("ABSTRACT", 34, true));
  sections.push(blank());
  sections.push(paragraph(`Thesis Title ${FRONT_MATTER.titleEn}`, { run: { font: EN_FONT }, paragraph: {} }));
  sections.push(paragraph(`Author ${FRONT_MATTER.authorEn}`, { run: { font: EN_FONT } }));
  sections.push(paragraph(`Degree ${FRONT_MATTER.degreeEn}`, { run: { font: EN_FONT } }));
  sections.push(paragraph(`Project Advisor ${FRONT_MATTER.advisorEn}`, { run: { font: EN_FONT } }));
  sections.push(paragraph(`Academic Year 2025`, { run: { font: EN_FONT } }));
  sections.push(blank());
  englishAbstract.forEach((text) => sections.push(paragraph(text, { run: { font: EN_FONT } })));
  sections.push(paragraph("Keywords: Timed Petri Net, Real-time Collaboration, Web-based Editor, PNML, PPP", { run: { font: EN_FONT } }));
  sections.push(pageBreak());

  sections.push(centered("กิตติกรรมประกาศ", 34, true));
  sections.push(blank());
  ack.forEach((text) => sections.push(paragraph(text)));
  sections.push(paragraph(FRONT_MATTER.authorTh, { paragraph: { alignment: AlignmentType.RIGHT, spacing: { before: 240 } } }));
  sections.push(pageBreak());

  return sections;
}

function buildAbbreviationTable() {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ borders: { top: border, bottom: border, left: border, right: border }, shading: { fill: "EAEAEA", type: ShadingType.CLEAR }, children: [paragraph("คำย่อ", { paragraph: { alignment: AlignmentType.CENTER }, run: { bold: true } })] }),
          new TableCell({ borders: { top: border, bottom: border, left: border, right: border }, shading: { fill: "EAEAEA", type: ShadingType.CLEAR }, children: [paragraph("ความหมาย", { paragraph: { alignment: AlignmentType.CENTER }, run: { bold: true } })] }),
        ],
      }),
      ...ABBREVIATIONS.map(([abbr, desc]) =>
        new TableRow({
          children: [
            new TableCell({ borders: { top: border, bottom: border, left: border, right: border }, children: [paragraph(abbr, { run: { font: EN_FONT } })] }),
            new TableCell({ borders: { top: border, bottom: border, left: border, right: border }, children: [paragraph(desc)] }),
          ],
        }),
      ),
    ],
  });
}

function buildPrefaceLists() {
  const figureItems = CHAPTER_FILES.slice(2).flatMap((file) => extractCaptions(file, /^ภาพ[ที่ ก-ฮ0-9. ]/));
  const tableItems = CHAPTER_FILES.slice(2).flatMap((file) => extractCaptions(file, /^ตารางที่/));
  const preface = [];
  preface.push(centered("สารบัญ", 34, true));
  preface.push(blank());
  preface.push(new TableOfContents("", { hyperlink: true, headingStyleRange: "1-4" }));
  preface.push(pageBreak());
  preface.push(...buildListSection("สารบัญภาพ", figureItems));
  preface.push(...buildListSection("สารบัญตาราง", tableItems));
  preface.push(centered("รายการคำย่อ", 34, true));
  preface.push(blank());
  preface.push(buildAbbreviationTable());
  preface.push(pageBreak());
  return preface;
}

function buildChapterContent() {
  const children = [];
  CHAPTER_FILES.forEach((filePath, index) => {
    const markdown = readMarkdown(filePath);
    if (index > 0) children.push(pageBreak());
    children.push(...blocksFromMarkdown(markdown));
  });
  return children;
}

function makeDoc() {
  return new Document({
    creator: FRONT_MATTER.authorEn,
    title: FRONT_MATTER.titleEn,
    description: "TPN full report draft generated from Obsidian notes",
    styles: {
      default: {
        document: {
          run: { font: TH_FONT, size: 32 },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: TH_FONT, size: 38, bold: true },
          paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: TH_FONT, size: 34, bold: true },
          paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 1 },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: TH_FONT, size: 32, bold: true },
          paragraph: { spacing: { before: 140, after: 100 }, outlineLevel: 2 },
        },
        {
          id: "Heading4",
          name: "Heading 4",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: TH_FONT, size: 30, bold: true },
          paragraph: { spacing: { before: 120, after: 80 }, outlineLevel: 3 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "bullet-main",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT }],
        },
        {
          reference: "numbered-main",
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT }],
        },
      ],
    },
    sections: [
      {
        properties: { page: PAGE },
        children: [...buildCoverPages(), ...buildAbstractPages(), ...buildPrefaceLists()],
      },
      {
        properties: { page: PAGE, pageNumbers: { start: 1, formatType: "decimal" } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "Page ", font: EN_FONT, size: 22 }), new TextRun({ children: [PageNumber.CURRENT], font: EN_FONT, size: 22 })],
              }),
            ],
          }),
        },
        children: buildChapterContent(),
      },
    ],
  });
}

async function main() {
  const doc = makeDoc();
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
