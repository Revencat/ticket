import ExcelJS from "exceljs";
import type { Category, Ticket } from "../types";
import { fmtDate, toJpeg, todayISO } from "./util";

function hexARGB(hex: string, alpha = "FF") {
  return alpha + hex.replace("#", "").toUpperCase().padStart(6, "0");
}
/** Mezcla un color con blanco para obtener un tinte suave de fondo. */
function tint(hex: string, amount = 0.85) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return "FF" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase();
}

const INK = "FF22282A";

export interface ExportResult {
  fileName: string;
  sheets: { name: string; rows: number }[];
  photos: number;
}

export async function exportExcel(
  tickets: Ticket[],
  categories: Category[],
  opts: { includePhotos: boolean }
): Promise<ExportResult> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TicketBox";
  wb.created = new Date();

  const catById = new Map(categories.map((c) => [c.id, c]));
  const byDate = [...tickets].sort((a, b) => a.date.localeCompare(b.date));
  const sheets: ExportResult["sheets"] = [];
  let photos = 0;

  const buildSheet = async (name: string, list: Ticket[], fixedColor?: string) => {
    const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = [
      { header: "Fecha", key: "fecha", width: 13 },
      { header: "Tienda", key: "tienda", width: 24 },
      { header: "Conceptos", key: "conceptos", width: 56 },
      { header: "Total", key: "total", width: 12 },
      { header: "Foto", key: "foto", width: 17 },
    ];

    const header = ws.getRow(1);
    header.height = 22;
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
      cell.font = { bold: true, color: { argb: "FFF2F3EF" }, name: "Calibri", size: 11 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = { bottom: { style: "thin", color: { argb: INK } } };
    });

    for (const t of list) {
      const r = ws.addRow({
        fecha: fmtDate(t.date),
        tienda: t.store,
        conceptos: t.items.length
          ? t.items.map((i) => `${i.qty > 1 ? i.qty + " × " : ""}${i.name}${i.warrantyMonths ? `  (garantía ${i.warrantyMonths} m)` : ""}`).join("\n")
          : t.note || "—",
        total: t.total,
      });
      const cat = catById.get(t.category);
      const color = fixedColor || cat?.color || "#64748b";
      r.eachCell({ includeEmpty: false }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tint(color) } };
        cell.alignment = { vertical: "middle", wrapText: true };
        cell.border = { bottom: { style: "hair", color: { argb: "FFD8DDD6" } } };
      });
      const totalCell = r.getCell("total");
      totalCell.numFmt = '#,##0.00 "€"';
      totalCell.font = { bold: true, name: "Consolas", size: 11 };

      const conceptLines = Math.max(1, (t.items.length || 1));
      r.height = opts.includePhotos && t.photo ? 52 : Math.min(80, 16 + conceptLines * 13);

      if (opts.includePhotos && t.photo) {
        try {
          const jpeg = await toJpeg(t.photo);
          const id = wb.addImage({ base64: jpeg.replace(/^data:image\/\w+;base64,/, ""), extension: "jpeg" });
          ws.addImage(id, { tl: { col: 4, row: r.number - 1 } as never, ext: { width: 92, height: 64 }, editAs: "oneCell" });
          photos++;
        } catch {
          r.getCell("foto").value = "(foto no convertible)";
        }
      } else if (!opts.includePhotos) {
        r.getCell("foto").value = t.photo ? "sí" : "no";
      }
    }

    if (list.length) {
      const sum = list.reduce((a, t) => a + t.total, 0);
      const tr = ws.addRow({ tienda: `TOTAL · ${list.length} tickets`, total: { formula: `SUM(D2:D${ws.rowCount - 1})`, result: sum } as never });
      tr.height = 20;
      tr.eachCell({ includeEmpty: false }, (cell) => {
        cell.font = { bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7EAE4" } };
      });
      tr.getCell("tienda").alignment = { horizontal: "right" };
      tr.getCell("total").numFmt = '#,##0.00 "€"';
    }
    sheets.push({ name, rows: list.length });
  };

  await buildSheet("Global", byDate);
  for (const c of categories) {
    if (c.id === "otros") continue;
    const list = byDate.filter((t) => t.category === c.id);
    if (list.length) await buildSheet(c.name, list, c.color);
  }
  const otros = byDate.filter((t) => t.category === "otros" || !catById.has(t.category));
  if (otros.length) await buildSheet("Otros", otros);

  const fileName = `ticketbox_${todayISO()}.xlsx`;
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);

  return { fileName, sheets, photos };
}
