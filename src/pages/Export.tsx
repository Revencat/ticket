import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FileCode, FileSpreadsheet, Download, Loader2, ScanLine, CheckCircle2, Image as ImageIcon, Table2, FileOutput } from "lucide-react";
import { useApp } from "../lib/store";
import { exportHTML, type ExportResult as HtmlResult } from "../lib/exportHtml";
import { exportExcel, type ExportResult as ExcelResult } from "../lib/excel";
import { fmtEUR } from "../lib/util";
import { Button, Toggle, EmptyState } from "../components/ui";

type ExportFormat = "html" | "excel";

export default function Export() {
  const { tickets, categories, toast, settings, setSettings } = useApp();
  const [format, setFormat] = useState<ExportFormat>("html");
  const [includePhotos, setIncludePhotosState] = useState(settings.exportPhotos !== false);
  const [exporting, setExporting] = useState(false);
  const [htmlResult, setHtmlResult] = useState<HtmlResult | null>(null);
  const [excelResult, setExcelResult] = useState<ExcelResult | null>(null);

  const setIncludePhotos = (v: boolean) => {
    setIncludePhotosState(v);
    setSettings({ exportPhotos: v });
  };

  const photosIn = tickets.filter((t) => t.photo).length;
  const totalAmount = tickets.reduce((a, t) => a + t.total, 0);

  const excelPreview = (() => {
    const sheets = [{ name: "Global", count: tickets.length, color: "#1c2541", total: tickets.reduce((a, t) => a + t.total, 0) }];
    for (const c of categories) {
      if (c.id === "otros") continue;
      const list = tickets.filter((t) => t.category === c.id);
      if (list.length) sheets.push({ name: c.name, count: list.length, color: c.color, total: list.reduce((a, t) => a + t.total, 0) });
    }
    const otros = tickets.filter((t) => t.category === "otros");
    if (otros.length) sheets.push({ name: "Otros", count: otros.length, color: "#64748b", total: otros.reduce((a, t) => a + t.total, 0) });
    return sheets;
  })();

  const run = async () => {
    setExporting(true);
    setHtmlResult(null);
    setExcelResult(null);
    try {
      if (format === "html") {
        const r = await exportHTML(tickets, categories);
        setHtmlResult(r);
        toast("ok", `Archivo HTML descargado: ${r.fileName}`);
      } else {
        const r = await exportExcel(tickets, categories, { includePhotos });
        setExcelResult(r);
        toast("ok", `Excel descargado: ${r.fileName}`);
      }
    } catch (e) {
      toast("danger", "No se pudo generar el archivo. Inténtalo de nuevo.");
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={<FileCode size={26} />}
        title="Nada que exportar todavía"
        desc="Archiva al menos un ticket y aquí podrás descargar tu archivo en HTML interactivo o Excel con fotos incrustadas."
        action={<Link to="/scan"><Button size="lg"><ScanLine size={17} /> Escanear ticket</Button></Link>}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Selector de formato */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-line rounded-xl p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-11 h-11 rounded-xl bg-acc/10 text-acc flex items-center justify-center shrink-0">
            {format === "html" ? <FileCode size={21} /> : <FileSpreadsheet size={21} />}
          </div>
          <div>
            <h2 className="font-display font-bold text-lg">
              {format === "html" ? "Archivo HTML interactivo" : "Libro Excel con todo el archivo"}
            </h2>
            <p className="text-mut text-sm mt-1 leading-relaxed">
              {format === "html"
                ? "Se genera en tu navegador: un archivo .html que puedes abrir en cualquier navegador. Incluye todas las fotos (clicables para ver en grande), filtros por categoría, búsqueda y diseño responsive."
                : "Se genera en tu navegador con ExcelJS: una hoja Global más una hoja por categoría, cada fila tintada con su color y el total al pie."}
            </p>
          </div>
        </div>

        {/* Selector de formato */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={() => setFormat("html")}
            className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              format === "html" ? "border-acc bg-acc/8" : "border-line hover:border-line2"
            }`}
          >
            <FileCode size={20} className={format === "html" ? "text-acc" : "text-mut"} />
            <div className="text-left">
              <p className="font-semibold text-[14px]">HTML interactivo</p>
              <p className="text-[12px] text-mut mt-0.5">Fotos clicables, filtros y búsqueda</p>
            </div>
            {format === "html" && (
              <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-acc flex items-center justify-center">
                <CheckCircle2 size={14} className="text-accink" />
              </span>
            )}
          </button>
          <button
            onClick={() => setFormat("excel")}
            className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              format === "excel" ? "border-acc bg-acc/8" : "border-line hover:border-line2"
            }`}
          >
            <FileSpreadsheet size={20} className={format === "excel" ? "text-acc" : "text-mut"} />
            <div className="text-left">
              <p className="font-semibold text-[14px]">Excel (.xlsx)</p>
              <p className="text-[12px] text-mut mt-0.5">Hojas por categoría con fotos</p>
            </div>
            {format === "excel" && (
              <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-acc flex items-center justify-center">
                <CheckCircle2 size={14} className="text-accink" />
              </span>
            )}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="border border-line rounded-lg px-4 py-3 bg-card2/50">
            <div className="flex items-center gap-3">
              <ImageIcon size={17} className="text-acc" />
              <div>
                <p className="text-[13.5px] font-medium">Fotos incluidas</p>
                <p className="text-[12px] text-mut">{photosIn} de {tickets.length} tickets</p>
              </div>
            </div>
          </div>
          <div className="border border-line rounded-lg px-4 py-3 bg-card2/50">
            <div className="flex items-center gap-3">
              {format === "html" ? <FileCode size={17} className="text-acc" /> : <FileSpreadsheet size={17} className="text-acc" />}
              <div>
                <p className="text-[13.5px] font-medium">Gasto total</p>
                <p className="text-[12px] text-mut font-mono">{fmtEUR(totalAmount)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Opciones específicas de Excel */}
        {format === "excel" && (
          <>
            <div className="flex items-center justify-between gap-4 border border-line rounded-lg px-4 py-3 bg-card2/50 mb-5">
              <div className="flex items-center gap-3">
                <ImageIcon size={17} className={includePhotos ? "text-acc" : "text-mut"} />
                <div>
                  <p className="text-[13.5px] font-medium">Incrustar fotos en la columna «Foto»</p>
                  <p className="text-[12px] text-mut">{photosIn} de {tickets.length} tickets tienen foto · se convierten a JPEG</p>
                </div>
              </div>
              <Toggle on={includePhotos} onChange={setIncludePhotos} label="Incrustar fotos" />
            </div>

            <div className="mb-5">
              <p className="text-[13px] font-medium text-mut mb-2">Hojas que se generarán</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {excelPreview.map((s, i) => (
                  <motion.div key={s.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center gap-3 border border-line rounded-lg px-3.5 py-2.5">
                    <span className="w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: s.color }}>
                      <Table2 size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-display font-semibold leading-tight">{s.name}</p>
                      <p className="text-[11.5px] text-mut font-mono">{s.count} filas · {fmtEUR(s.total)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Info específica de HTML */}
        {format === "html" && (
          <div className="bg-card2/50 border border-line rounded-lg p-4 mb-5">
            <p className="text-[13px] font-medium text-ink mb-2">¿Qué incluye el archivo?</p>
            <ul className="space-y-2 text-[12.5px] text-mut">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-ok shrink-0 mt-0.5" />
                <span>Todas las fotos de los tickets (clicables para ver en grande)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-ok shrink-0 mt-0.5" />
                <span>Filtros por categoría (Comida, Ropa, Gasolina, etc.)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-ok shrink-0 mt-0.5" />
                <span>Búsqueda por nombre de tienda o producto</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-ok shrink-0 mt-0.5" />
                <span>Diseño responsive (funciona en móvil y escritorio)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-ok shrink-0 mt-0.5" />
                <span>Estadísticas: total de tickets, gasto total, tickets con foto</span>
              </li>
            </ul>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button size="lg" onClick={run} disabled={exporting} className="flex-1 sm:flex-none sm:min-w-[240px]">
            {exporting ? <><Loader2 size={17} className="animate-spin" /> Generando archivo…</> : <><Download size={17} /> Descargar {format === "html" ? "HTML" : ".xlsx"}</>}
          </Button>
          {exporting && <span className="text-[12.5px] text-mut">Preparando {tickets.length} tickets…</span>}
        </div>
      </motion.div>

      {/* Resultado HTML */}
      {htmlResult && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-ok/6 border border-ok/25 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="text-ok shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-display font-semibold text-[15px] text-ok">{htmlResult.fileName}</p>
              <p className="text-mut mt-1">
                Archivo generado con <strong className="text-ink">{htmlResult.ticketCount} tickets</strong>
                {htmlResult.withPhotos > 0 && <> (<strong className="text-ink">{htmlResult.withPhotos} con foto</strong>)</>}.
                Ábrelo en cualquier navegador para ver tu archivo interactivo.
              </p>
              <button onClick={run} className="mt-2 inline-flex items-center gap-1.5 text-acc font-medium hover:underline cursor-pointer text-[13px]">
                <FileOutput size={14} /> Volver a descargar
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Resultado Excel */}
      {excelResult && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-ok/6 border border-ok/25 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="text-ok shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-display font-semibold text-[15px] text-ok">{excelResult.fileName}</p>
              <p className="text-mut mt-1">
                {excelResult.sheets.length} hojas ({excelResult.sheets.map((s) => s.name).join(", ")}), {excelResult.sheets.reduce((a, s) => a + s.rows, 0)} tickets
                {includePhotos && <> y <strong className="text-ink">{excelResult.photos} fotos incrustadas</strong></>}. Revisa la carpeta de descargas.
              </p>
              <button onClick={run} className="mt-2 inline-flex items-center gap-1.5 text-acc font-medium hover:underline cursor-pointer text-[13px]">
                <FileOutput size={14} /> Volver a descargar
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Info adicional */}
      {format === "excel" && (
        <div className="bg-card border border-line rounded-xl p-5 text-[13px] text-mut leading-relaxed">
          <p className="font-display font-semibold text-ink text-[13.5px] mb-1.5">Qué contiene cada hoja</p>
          Columnas <span className="font-mono text-ink">Fecha · Tienda · Categoría · Conceptos · Garantía · Total · Foto</span>, cabecera en tinta, filas tintadas con el color de la
          categoría, importes con formato <span className="font-mono">1.234,56 €</span> y una fila de total con fórmula SUMA al pie. Los productos con garantía
          se marcan con «(garantía N m)» en Conceptos.
        </div>
      )}

      {format === "html" && (
        <div className="bg-card border border-line rounded-xl p-5 text-[13px] text-mut leading-relaxed">
          <p className="font-display font-semibold text-ink text-[13.5px] mb-1.5">Ventajas del formato HTML</p>
          <p>
            A diferencia de Excel, el archivo HTML es <strong className="text-ink">universal</strong>: se abre en cualquier navegador sin necesidad de software específico.
            Las fotos son <strong className="text-ink">clicables</strong> para verlas en grande, incluye <strong className="text-ink">filtros y búsqueda</strong> integrados,
            y el diseño es <strong className="text-ink">responsive</strong> para que puedas consultarlo desde el móvil o el escritorio.
            Además, es más <strong className="text-ink">ligero</strong> que un Excel con fotos incrustadas.
          </p>
        </div>
      )}
    </div>
  );
}
