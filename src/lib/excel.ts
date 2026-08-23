import ExcelJS from "exceljs";
import { format, parseISO, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import type { Category, Ticket } from "../types";
import { fmtDate, toJpeg, todayISO, monthKey } from "./util";

function hexARGB(hex: string) {
  return "FF" + hex.replace("#", "").toUpperCase().padStart(6, "0");
}
/** Tinte suave de un color sobre blanco (para fondos de fila). */
function tint(hex: string, amount = 0.88) {
  const n = parseInt(hex.replace("#", ""), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return "FF" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase();
}

const INK = "FF1A1B18";
const PAPER = "FFFBFBF9";
const ACCENT = "FFE0452A";
const ZEBRA = "FFF6F6F3";
const LINE = "FFE1E2DB";

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

  // 1) Convertir todas las fotos en paralelo (JPEG pequeño) → mucho más rápido
  const photoMap = new Map<string, string>();
  if (opts.includePhotos) {
    const jobs = byDate.filter((t) => t.photo).map(async (t) => {
      try {
        photoMap.set(t.id, await toJpeg(t.photo!, 520, 0.72));
      } catch {}
    });
    await Promise.all(jobs);
  }

  const styleHeader = (ws: ExcelJS.Worksheet) => {
    const header = ws.getRow(1);
    header.height = 24;
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
      cell.font = { bold: true, color: { argb: PAPER }, size: 11 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    const rule = ws.getRow(2);
    rule.height = 4;
    for (let c = 1; c <= ws.columnCount; c++) {
      const cell = rule.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
      cell.border = {};
    }
  };

  const buildTicketSheet = (name: string, list: Ticket[], tabColor: string) => {
    const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: "frozen", ySplit: 2 }] });
    ws.properties.tabColor = { argb: tabColor };
    ws.columns = [
      { header: "Fecha", key: "fecha", width: 13 },
      { header: "Tienda", key: "tienda", width: 22 },
      { header: "Categoría", key: "categoria", width: 13 },
      { header: "Conceptos", key: "conceptos", width: 52 },
      { header: "Garantía", key: "garantia", width: 10 },
      { header: "Total", key: "total", width: 12 },
      { header: "Foto", key: "foto", width: 14 },
    ];
    styleHeader(ws);

    list.forEach((t, idx) => {
      const cat = catById.get(t.category);
      const maxWarranty = Math.max(0, ...t.items.map((i) => i.warrantyMonths || 0));
      const r = ws.addRow({
        fecha: fmtDate(t.date),
        tienda: t.store,
        categoria: cat?.name || "Otros",
        conceptos: t.items.length
          ? t.items.map((i) => `${i.qty > 1 ? i.qty + " × " : ""}${i.name}${i.warrantyMonths ? `  (${i.warrantyMonths} m garantía)` : ""}`).join("\n")
          : t.note || "—",
        garantia: maxWarranty > 0 ? `${maxWarranty} m` : "",
        total: t.total,
      });

      const zebra = idx % 2 === 1 ? ZEBRA : PAPER;
      r.eachCell({ includeEmpty: false }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebra } };
        cell.alignment = { vertical: "middle", wrapText: true };
        cell.border = { bottom: { style: "hair", color: { argb: LINE } } };
        cell.font = { size: 10.5 };
      });
      // celda de categoría con el color de la categoría
      const catCell = r.getCell("categoria");
      if (cat) {
        catCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tint(cat.color, 0.7) } };
        catCell.font = { size: 10.5, bold: true, color: { argb: hexARGB(cat.color).slice(0, 2) === "FF" ? "FF3A3F3C" : "FF3A3F3C" } };
        catCell.alignment = { vertical: "middle", horizontal: "center" };
      }
      const totalCell = r.getCell("total");
      totalCell.numFmt = '#,##0.00 "€"';
      totalCell.font = { bold: true, size: 11 };
      r.getCell("garantia").alignment = { vertical: "middle", horizontal: "center" };
      r.getCell("fecha").alignment = { vertical: "middle" };

      const conceptLines = Math.max(1, t.items.length);
      const hasPhoto = opts.includePhotos && photoMap.has(t.id);
      r.height = hasPhoto ? 50 : Math.min(78, 15 + conceptLines * 12.5);

      if (hasPhoto) {
        const id = wb.addImage({ base64: photoMap.get(t.id)!.replace(/^image\/\w+;base64,/, ""), extension: "jpeg" });
        ws.addImage(id, { tl: { col: 6, row: r.number - 1 } as never, ext: { width: 86, height: 60 }, editAs: "oneCell" });
        photos++;
      } else {
        r.getCell("foto").value = t.photo ? "sí" : "no";
        r.getCell("foto").alignment = { vertical: "middle", horizontal: "center" };
        r.getCell("foto").font = { size: 10, color: { argb: "FF9AA196" } };
      }
    });

    // autofiltro sobre la cabecera
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };

    if (list.length) {
      const sum = list.reduce((a, t) => a + t.total, 0);
      const tr = ws.addRow({ tienda: `TOTAL · ${list.length} ticket${list.length > 1 ? "s" : ""}`, total: sum });
      tr.height = 22;
      tr.eachCell({ includeEmpty: false }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
        cell.font = { bold: true, color: { argb: PAPER }, size: 11 };
        cell.border = { top: { style: "medium", color: { argb: ACCENT } } };
      });
      tr.getCell("tienda").alignment = { horizontal: "right", vertical: "middle" };
      const tc = tr.getCell("total");
      tc.numFmt = '#,##0.00 "€"';
      tc.alignment = { vertical: "middle" };
    }
    sheets.push({ name, rows: list.length });
  };

  // ── Hoja Resumen ──────────────────────────────────────────────────────────
  const buildResumen = () => {
    const ws = wb.addWorksheet("Resumen", { views: [{ state: "frozen", ySplit: 2 }] });
    ws.properties.tabColor = { argb: ACCENT };
    ws.columns = [{ width: 26 }, { width: 14 }, { width: 14 }, { width: 14 }];

    ws.mergeCells("A1:D1");
    const t1 = ws.getCell("A1");
    t1.value = "TicketBox · Resumen del archivo";
    t1.font = { bold: true, size: 14, color: { argb: INK } };
    t1.alignment = { vertical: "middle" };
    ws.getRow(1).height = 26;
    const rule = ws.getRow(2);
    rule.height = 4;
    for (let c = 1; c <= 4; c++) rule.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };

    const head = (row: number, cells: string[]) => {
      const r = ws.getRow(row);
      r.values = cells;
      r.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
        cell.font = { bold: true, color: { argb: PAPER }, size: 10.5 };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
      r.height = 20;
    };

    // por categoría
    ws.getCell("A4").value = "Por categoría";
    ws.getCell("A4").font = { bold: true, size: 11.5 };
    head(5, ["Categoría", "Tickets", "Total", "% del gasto"]);
    const grand = byDate.reduce((a, t) => a + t.total, 0);
    let row = 6;
    for (const c of categories) {
      const list = byDate.filter((t) => t.category === c.id);
      if (!list.length) continue;
      const total = list.reduce((a, t) => a + t.total, 0);
      const r = ws.getRow(row);
      r.values = [c.name, list.length, total, grand > 0 ? total / grand : 0];
      r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: tint(c.color, 0.75) } };
      r.getCell(1).font = { bold: true, size: 10.5 };
      r.getCell(3).numFmt = '#,##0.00 "€"';
      r.getCell(4).numFmt = "0.0%";
      r.getCell(4).alignment = { horizontal: "center" };
      r.getCell(2).alignment = { horizontal: "center" };
      row++;
    }

    // por mes (últimos 12)
    row += 1;
    ws.getCell(`A${row}`).value = "Por mes (últimos 12)";
    ws.getCell(`A${row}`).font = { bold: true, size: 11.5 };
    row++;
    head(row, ["Mes", "Tickets", "Total", "Media/ticket"]);
    row++;
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i);
      const key = format(d, "yyyy-MM");
      const list = byDate.filter((t) => monthKey(t.date) === key);
      const total = list.reduce((a, t) => a + t.total, 0);
      const r = ws.getRow(row);
      const label = format(d, "LLLL yyyy", { locale: es });
      r.values = [label.charAt(0).toUpperCase() + label.slice(1), list.length, total, list.length ? total / list.length : 0];
      r.getCell(3).numFmt = '#,##0.00 "€"';
      r.getCell(4).numFmt = '#,##0.00 "€"';
      r.getCell(2).alignment = { horizontal: "center" };
      if (list.length === 0) r.getCell(1).font = { color: { argb: "FF9AA196" }, size: 10.5 };
      row++;
    }

    row += 1;
    const tot = ws.getRow(row);
    tot.values = ["TOTAL ARCHIVO", byDate.length, grand, byDate.length ? grand / byDate.length : 0];
    tot.eachCell({ includeEmpty: false }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
      cell.font = { bold: true, color: { argb: PAPER }, size: 11 };
      cell.border = { top: { style: "medium", color: { argb: ACCENT } } };
    });
    tot.getCell(3).numFmt = '#,##0.00 "€"';
    tot.getCell(4).numFmt = '#,##0.00 "€"';
    sheets.push({ name: "Resumen", rows: 0 });
  };

  buildResumen();
  buildTicketSheet("Global", byDate, ACCENT);
  for (const c of categories) {
    if (c.id === "otros") continue;
    const list = byDate.filter((t) => t.category === c.id);
    if (list.length) buildTicketSheet(c.name, list, hexARGB(c.color));
  }
  const otros = byDate.filter((t) => t.category === "otros" || !catById.has(t.category));
  if (otros.length) buildTicketSheet("Otros", otros, "FF64748B");

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
