import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FileCode, Download, Loader2, ScanLine, CheckCircle2, Image as ImageIcon, FileOutput } from "lucide-react";
import { useApp } from "../lib/store";
import { exportHTML, type ExportResult } from "../lib/exportHtml";
import { Button, EmptyState } from "../components/ui";

export default function Export() {
  const { tickets, categories, toast } = useApp();
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);

  const photosIn = tickets.filter((t) => t.photo).length;
  const totalAmount = tickets.reduce((a, t) => a + t.total, 0);

  const run = async () => {
    setExporting(true);
    setResult(null);
    try {
      const r = await exportHTML(tickets, categories);
      setResult(r);
      toast("ok", `Archivo HTML descargado: ${r.fileName}`);
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
        desc="Archiva al menos un ticket y aquí podrás descargar un archivo HTML interactivo con todas las fotos, filtros y búsqueda incluidos."
        action={<Link to="/scan"><Button size="lg"><ScanLine size={17} /> Escanear ticket</Button></Link>}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-line rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-acc/10 text-acc flex items-center justify-center shrink-0"><FileCode size={21} /></div>
          <div>
            <h2 className="font-display font-bold text-lg">Archivo HTML interactivo</h2>
            <p className="text-mut text-sm mt-1 leading-relaxed">
              Se genera en tu navegador: un archivo <strong className="text-ink">.html</strong> que puedes abrir en cualquier navegador.
              Incluye todas las fotos (clicables para ver en grande), filtros por categoría, búsqueda y diseño responsive.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
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
              <FileCode size={17} className="text-acc" />
              <div>
                <p className="text-[13.5px] font-medium">Gasto total</p>
                <p className="text-[12px] text-mut font-mono">{totalAmount.toFixed(2).replace('.', ',')} €</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 bg-card2/50 border border-line rounded-lg p-4">
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

        <div className="mt-6 flex items-center gap-3">
          <Button size="lg" onClick={run} disabled={exporting} className="flex-1 sm:flex-none sm:min-w-[240px]">
            {exporting ? <><Loader2 size={17} className="animate-spin" /> Generando archivo…</> : <><Download size={17} /> Descargar HTML</>}
          </Button>
          {exporting && <span className="text-[12.5px] text-mut">Preparando {tickets.length} tickets…</span>}
        </div>
      </motion.div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-ok/6 border border-ok/25 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="text-ok shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-display font-semibold text-[15px] text-ok">{result.fileName}</p>
              <p className="text-mut mt-1">
                Archivo generado con <strong className="text-ink">{result.ticketCount} tickets</strong>
                {result.withPhotos > 0 && <> (<strong className="text-ink">{result.withPhotos} con foto</strong>)</>}.
                Ábrelo en cualquier navegador para ver tu archivo interactivo.
              </p>
              <button onClick={run} className="mt-2 inline-flex items-center gap-1.5 text-acc font-medium hover:underline cursor-pointer text-[13px]">
                <FileOutput size={14} /> Volver a descargar
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="bg-card border border-line rounded-xl p-5 text-[13px] text-mut leading-relaxed">
        <p className="font-display font-semibold text-ink text-[13.5px] mb-1.5">Ventajas del formato HTML</p>
        <p>
          A diferencia de Excel, el archivo HTML es <strong className="text-ink">universal</strong>: se abre en cualquier navegador sin necesidad de software específico.
          Las fotos son <strong className="text-ink">clicables</strong> para verlas en grande, incluye <strong className="text-ink">filtros y búsqueda</strong> integrados,
          y el diseño es <strong className="text-ink">responsive</strong> para que puedas consultarlo desde el móvil o el escritorio.
          Además, es más <strong className="text-ink">ligero</strong> que un Excel con fotos incrustadas.
        </p>
      </div>
    </div>
  );
}
