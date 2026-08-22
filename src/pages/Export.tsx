import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FileSpreadsheet, Download, Loader2, ScanLine, CheckCircle2, Image as ImageIcon, Table2, FileOutput } from "lucide-react";
import { useApp } from "../lib/store";
import { exportExcel, type ExportResult } from "../lib/excel";
import { fmtEUR } from "../lib/util";
import { Button, Toggle, Dot, EmptyState } from "../components/ui";

export default function Export() {
  const { tickets, categories, toast } = useApp();
  const [includePhotos, setIncludePhotos] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);

  const preview = useMemo(() => {
    const sheets = [{ name: "Global", count: tickets.length, color: "#22282a", total: tickets.reduce((a, t) => a + t.total, 0) }];
    for (const c of categories) {
      if (c.id === "otros") continue;
      const list = tickets.filter((t) => t.category === c.id);
      if (list.length) sheets.push({ name: c.name, count: list.length, color: c.color, total: list.reduce((a, t) => a + t.total, 0) });
    }
    const otros = tickets.filter((t) => t.category === "otros");
    if (otros.length) sheets.push({ name: "Otros", count: otros.length, color: "#64748b", total: otros.reduce((a, t) => a + t.total, 0) });
    return sheets;
  }, [tickets, categories]);

  const photosIn = tickets.filter((t) => t.photo).length;

  const run = async () => {
    setExporting(true);
    setResult(null);
    try {
      const r = await exportExcel(tickets, categories, { includePhotos });
      setResult(r);
      toast("ok", `Excel descargado: ${r.fileName}`);
    } catch (e) {
      toast("danger", "No se pudo generar el Excel. Inténtalo de nuevo.");
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={<FileSpreadsheet size={26} />}
        title="Nada que exportar todavía"
        desc="Archiva al menos un ticket y aquí podrás descargar un Excel con una hoja global, una hoja por categoría, filas coloreadas y la foto incrustada."
        action={<Link to="/scan"><Button size="lg"><ScanLine size={17} /> Escanear ticket</Button></Link>}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-card border border-line rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-acc/12 text-acc flex items-center justify-center shrink-0"><FileSpreadsheet size={22} /></div>
          <div>
            <h2 className="font-display font-bold text-lg">Libro Excel con todo el archivo</h2>
            <p className="text-mut text-sm mt-1 leading-relaxed">
              Se genera con <strong className="text-ink">ExcelJS</strong> directamente en tu navegador: una hoja <strong className="text-ink">Global</strong> más
              una hoja por cada categoría con datos, cada fila tintada con su color y el total al pie.
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 border border-line rounded-lg px-4 py-3 bg-card2/50">
          <div className="flex items-center gap-3">
            <ImageIcon size={17} className={includePhotos ? "text-acc" : "text-mut"} />
            <div>
              <p className="text-[13.5px] font-medium">Incrustar fotos en la columna «Foto»</p>
              <p className="text-[12px] text-mut">{photosIn} de {tickets.length} tickets tienen foto · se convierten a JPEG</p>
            </div>
          </div>
          <Toggle on={includePhotos} onChange={setIncludePhotos} label="Incrustar fotos" />
        </div>

        <div className="mt-5">
          <p className="text-[11px] font-display font-semibold uppercase tracking-[0.08em] text-mut mb-2">Hojas que se generarán</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {preview.map((s, i) => (
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

        <div className="mt-6 flex items-center gap-3">
          <Button size="lg" onClick={run} disabled={exporting} className="flex-1 sm:flex-none sm:min-w-[240px]">
            {exporting ? <><Loader2 size={17} className="animate-spin" /> Generando libro…</> : <><Download size={17} /> Descargar .xlsx</>}
          </Button>
          {exporting && <span className="text-[12.5px] text-mut">Convirtiendo fotos y montando hojas…</span>}
        </div>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-ok/8 border border-ok/30 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="text-ok shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-display font-semibold text-[15px] text-ok">{result.fileName}</p>
              <p className="text-mut mt-1">
                {result.sheets.length} hojas ({result.sheets.map((s) => s.name).join(", ")}), {result.sheets.reduce((a, s) => a + s.rows, 0)} tickets
                {includePhotos && <> y <strong className="text-ink">{result.photos} fotos incrustadas</strong></>}. Revisa la carpeta de descargas.
              </p>
              <button onClick={run} className="mt-2 inline-flex items-center gap-1.5 text-acc font-medium hover:underline cursor-pointer text-[13px]">
                <FileOutput size={14} /> Volver a descargar
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="bg-card border border-line rounded-xl p-5 text-[13px] text-mut leading-relaxed">
        <p className="font-display font-semibold text-ink text-[13.5px] mb-1.5 flex items-center gap-2"><Dot color="var(--accent)" /> Qué contiene cada hoja</p>
        Columnas <span className="font-mono text-ink">Fecha · Tienda · Conceptos · Total · Foto</span>, cabecera en tinta, filas tintadas con el color de la
        categoría, importes con formato <span className="font-mono">1.234,56 €</span> y una fila de total con fórmula SUMA al pie. Los productos con garantía
        se marcan con «(garantía N m)» en Conceptos.
      </div>
    </div>
  );
}
