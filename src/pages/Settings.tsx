import { useState } from "react";
import { Moon, Sun, Plus, Trash2, Sparkles, Database, Store as StoreIcon, Tag, Download, PiggyBank, MapPin, Camera, Cpu, Lock, FileSpreadsheet, EyeOff, Cloud } from "lucide-react";
import { useApp } from "../lib/store";
import { cls, uid } from "../lib/util";
import { Button, Toggle, Modal, inputCls, CatIcon } from "../components/ui";

export default function Settings() {
  const { settings, setSettings, categories, setCategories, stores, setStores, tickets, loadDemo, clearAll, toast } = useApp();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const usedCategories = new Set(tickets.map((t) => t.category));

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Apariencia */}
      <section className="surface p-5">
        <h2 className="text-title-3 flex items-center gap-2 mb-4">Apariencia</h2>
        <div className="flex items-center justify-between py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            {settings.dark ? <Moon size={17} className="text-[var(--accent)]" /> : <Sun size={17} className="text-[var(--accent)]" />}
            <div>
              <p className="text-[14px] font-medium">Modo oscuro</p>
              <p className="text-footnote">También con la tecla T</p>
            </div>
          </div>
          <Toggle on={settings.dark} onChange={(v) => setSettings({ dark: v })} label="Modo oscuro" />
        </div>
      </section>

      {/* Presupuesto */}
      <section className="surface p-5">
        <h2 className="text-title-3 flex items-center gap-2 mb-4"><PiggyBank size={16} className="text-[var(--accent)]" /> Presupuesto mensual</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label className="block text-[13px] font-medium text-[var(--text-2)] mb-1.5">Tope (€)</label>
            <input type="number" min={0} step={10} placeholder="p. ej. 600" className={cls(inputCls, "tabular-nums")}
              defaultValue={settings.budget ?? ""}
              onBlur={(e) => { const v = parseFloat(e.target.value); setSettings({ budget: Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : undefined }); if (Number.isFinite(v) && v > 0) toast("ok", `Presupuesto: ${v} €/mes.`); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
          </div>
          {settings.budget ? <Button variant="tertiary" onClick={() => { setSettings({ budget: undefined }); toast("info", "Presupuesto retirado."); }}>Quitar</Button> : <span className="text-[12px] text-[var(--text-3)] pb-2.5">Sin presupuesto definido.</span>}
        </div>
      </section>

      {/* Categorías */}
      <section className="surface p-5">
        <h2 className="text-title-3 flex items-center gap-2 mb-1"><Tag size={16} className="text-[var(--accent)]" /> Categorías</h2>
        <p className="text-footnote mb-4">El OCR sugiere la categoría con estas palabras clave.</p>
        <ul className="space-y-2">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2.5">
              <input type="color" value={c.color} onChange={(e) => setCategories(categories.map((x) => (x.id === c.id ? { ...x, color: e.target.value } : x)))} className="w-8 h-8 rounded-lg cursor-pointer border border-[var(--border)] bg-transparent p-0.5" />
              <input className={cls(inputCls, "flex-1")} value={c.name} onChange={(e) => setCategories(categories.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))} />
              <span className="hidden sm:flex items-center gap-1.5 text-[12px] text-[var(--text-3)]"><CatIcon id={c.id} size={13} />{tickets.filter((t) => t.category === c.id).length}</span>
              <button onClick={() => { if (usedCategories.has(c.id)) { toast("warn", `No puedes borrar «${c.name}»: hay tickets que la usan.`); return; } setCategories(categories.filter((x) => x.id !== c.id)); toast("info", `«${c.name}» eliminada.`); }}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 cursor-pointer"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setCategories([...categories, { id: "cat-" + uid().slice(0, 6), name: "Nueva categoría", color: "#0e7490", keywords: [] }])}>
          <Plus size={13} /> Añadir categoría
        </Button>
      </section>

      {/* Tiendas */}
      <section className="surface p-5">
        <h2 className="text-title-3 flex items-center gap-2 mb-1"><StoreIcon size={16} className="text-[var(--accent)]" /> Tiendas conocidas</h2>
        <p className="text-footnote mb-4">Ayudan al OCR a reconocer la tienda automáticamente.</p>
        <ul className="space-y-2">
          {stores.map((s, i) => (
            <li key={s.name + i} className="flex items-center gap-2.5">
              <input className={cls(inputCls, "flex-1")} value={s.name} onChange={(e) => setStores(stores.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <select className={cls(inputCls, "w-36")} value={s.category} onChange={(e) => setStores(stores.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={() => { setStores(stores.filter((_, j) => j !== i)); toast("info", `«${s.name}» eliminada.`); }}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 cursor-pointer"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setStores([...stores, { name: "Nueva tienda", category: "otros", keywords: ["nueva tienda"] }])}>
          <Plus size={13} /> Añadir tienda
        </Button>
      </section>

      {/* Datos */}
      <section className="surface p-5">
        <h2 className="text-title-3 flex items-center gap-2 mb-1"><Database size={16} className="text-[var(--accent)]" /> Datos</h2>
        <p className="text-footnote mb-4">{tickets.length} tickets en IndexedDB. Nada se envía a servidores propios.</p>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="secondary" onClick={async () => { const n = await loadDemo(); toast("ok", `${n} tickets de ejemplo.`); }}><Sparkles size={14} /> Datos de ejemplo</Button>
          <Button variant="destructive" onClick={() => setConfirmWipe(true)}><Trash2 size={14} /> Borrar todo</Button>
        </div>
      </section>

      {/* Privacidad */}
      <section className="surface p-5">
        <h2 className="text-title-3 flex items-center gap-2 mb-1"><MapPin size={16} className="text-[var(--accent)]" /> Privacidad</h2>
        <p className="text-footnote mb-4">Tu foto nunca sale del dispositivo salvo que actives la sincronización.</p>
        <ol className="space-y-3 ml-1">
          {[
            { icon: Camera, title: "1 · Captura", badge: "En tu dispositivo", tone: "success", text: "La foto se hace con tu cámara o galería. No se sube a ningún sitio." },
            { icon: Cpu, title: "2 · OCR", badge: "En tu dispositivo", tone: "success", text: "Tesseract.js lee total, fecha, tienda y productos dentro de tu navegador." },
            { icon: Database, title: "3 · Guardado", badge: "En tu dispositivo", tone: "success", text: "La foto se guarda en IndexedDB, el almacén privado de tu navegador." },
            { icon: Cloud, title: "4 · Sincronización", badge: "Opcional · cifrado", tone: "warning", text: "Solo si creas cuenta. Cifrado AES-256-GCM con clave derivada de tu contraseña." },
            { icon: FileSpreadsheet, title: "5 · Exportación", badge: "En tu dispositivo", tone: "success", text: "El archivo se genera dentro de tu navegador." },
            { icon: EyeOff, title: "6 · Sin seguimiento", badge: "Privacidad", tone: "neutral", text: "Sin analíticas, cookies de terceros ni llamadas externas." },
          ].map((s) => (
            <li key={s.title} className="flex gap-3">
              <span className="w-8 h-8 rounded-full bg-[var(--surface-3)] flex items-center justify-center shrink-0"><s.icon size={14} className="text-[var(--accent)]" /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-medium">{s.title}</p>
                  <span className={cls("text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                    s.tone === "success" && "text-[var(--success)] bg-[var(--success)]/10",
                    s.tone === "warning" && "text-[var(--warning)] bg-[var(--warning)]/10",
                    s.tone === "neutral" && "text-[var(--text-3)] bg-[var(--surface-3)]"
                  )}>{s.badge}</span>
                </div>
                <p className="text-[12px] text-[var(--text-2)] mt-0.5 leading-relaxed">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-start gap-2">
          <Lock size={13} className="text-[var(--text-3)] shrink-0 mt-0.5" />
          <p className="text-[12px] text-[var(--text-3)] leading-relaxed"><strong className="text-[var(--text-2)]">Tus datos son tuyos.</strong> Si borras un ticket, se elimina de tu dispositivo.</p>
        </div>
      </section>

      {/* Créditos */}
      <section className="surface p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center"><span className="text-[var(--accent)] font-bold text-lg">R</span></div>
            <div>
              <p className="text-[14px] font-medium">Proyecto creado por <strong className="text-[var(--accent)]">Reven</strong></p>
              <p className="text-footnote">Versión 0.7 · En desarrollo</p>
            </div>
          </div>
          <p className="text-[11px] text-[var(--text-3)] font-mono">Build 2026.01</p>
        </div>
      </section>

      <Modal open={confirmWipe} onClose={() => setConfirmWipe(false)}>
        <div className="p-6">
          <h3 className="text-title-2">¿Borrar {tickets.length} tickets?</h3>
          <p className="text-[var(--text-2)] text-[14px] mt-2 leading-relaxed">Se eliminarán los tickets y sus fotos. Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setConfirmWipe(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => { await clearAll(); setConfirmWipe(false); toast("info", "Archivador vacío."); }}><Trash2 size={14} /> Borrar todo</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
