import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { CvDocument } from "@/lib/workspace/model";
import { workspaceCopy } from "@/lib/workspace/copy";
const fonts = ["NotoSans-Regular.ttf", "NotoSans-Bold.ttf", "NotoSansArmenian-Regular.ttf", "NotoSansArmenian-Bold.ttf"].map(name => fs.readFileSync(path.join(process.cwd(), "lib/export/fonts", name)));
function text(doc: PDFKit.PDFDocument, value: string, size = 10, bold = false) {
  const runs = value.match(/[԰-֏ﬓ-ﬗ][԰-֏ﬓ-ﬗ\s]*|[^԰-֏ﬓ-ﬗ]+/gu) || [];
  runs.forEach((run, i) => {
    const font = /[԰-֏ﬓ-ﬗ]/u.test(run) ? (bold ? "armBold" : "arm") : (bold ? "latinBold" : "latin");
    doc.font(font).fontSize(size).fillColor("#111111").text(run, { continued: i < runs.length - 1, lineGap: 3 });
  });
}
export function buildCvPdf(cv: CvDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, autoFirstPage: true, info: { Title: cv.title, Author: cv.full_name } });
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(chunk)); doc.on("error", reject); doc.on("end", () => resolve(Buffer.concat(chunks)));
    try {
      ["latin", "latinBold", "arm", "armBold"].forEach((name, i) => doc.registerFont(name, fonts[i]));
      const c = workspaceCopy[cv.language];
      text(doc, cv.full_name || cv.title, 20, true);
      if (cv.position) text(doc, cv.position, 12);
      const contact = [cv.location, cv.phone, cv.email, cv.linkedin_url, cv.portfolio_url].filter(Boolean).join("  |  ");
      if (contact) { doc.moveDown(.4); text(doc, contact, 9); }
      for (const key of ["summary", "experience", "education", "skills", "projects", "languages"] as const) {
        if (!cv[key].trim()) continue;
        doc.moveDown(.8);
        if (doc.y > doc.page.height - 110) doc.addPage();
        text(doc, c[key], 11, true); doc.moveDown(.3); text(doc, cv[key]);
      }
      doc.end();
    } catch (error) { reject(error); doc.destroy(); }
  });
}
