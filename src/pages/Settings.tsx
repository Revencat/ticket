import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, Plus, Trash2, Sparkles, Database, Palette, Store as StoreIcon, Tag, Download, Check, Camera, Cpu, Lock, FileSpreadsheet, EyeOff, Cloud, MapPin, PiggyBank } from "lucide-react";
import { useApp, THEMES } from "../lib/store";
import { cls, uid } from "../lib/util";
import { Button, Toggle, Modal, inputCls, CatIcon } from "../components/ui";

export default function Settings() {
  const { settings, setSettings, categories, setCategories, stores, setStores, tickets, loadDemo, clearAll, toast, accent } = useApp();
  const nav = useNavigate();
  const [confirmWipe, setConfirmWipe] = useState(false);

  const usedCategories = new Set(tickets.map((t) => t.category));

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Apariencia */}
      <section className="bg-card border border-line rounded-xl p-5">
        <h2 className="font-display font-bold text-[15px] flex items-center gap-2 mb-4"><Palette size={16} className="text-acc" /> Apariencia</h2>
        <p className="text-[13px] font-medium text-mut mb-2">Color de acento · 6 temas + propio</p>
        <div className="flex flex-wrap gap-2.5">
          {THEMES.map((t) => {
            const active = settings.theme === t.id;
            const color = t.id === "custom" ? settings.customColor || accent : t.color;
            return (
              <button
                key={t.id}
                onClick={() => setSettings({ theme: t.id })}
                className={cls(
                  "flex items-center gap-2 pl-1.5 pr-3 h-9 rounded-full border transition-all cursor-pointer",
                  active ? "border-acc bg-acc/8" : "border-line hover:border-line2"
                )}
                title={t.name}
              >
                <span className="w-6 h-6 rounded-full relative flex items-center justify-center border border-black/10" style={{ background: color }}>
                  {active && <Check size={12} className="text-white drop-shadow" />}
                </span>
                <span className="text-[12.5px] font-medium">{t.name}</span>
                {t.id === "custom" && (
                  <input
                    type="color"
                    value={settings.customColor || "#0f9d63"}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setSettings({ theme: "custom", customColor: e.target.value })}
                    className="w-6 h-6 rounded-full cursor-pointer border-0 bg-transparent p-0"
                    aria-label="Color personalizado"
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <div className="flex items-center gap-3">
            {settings.dark ? <Moon size={17} className="text-acc" /> : <Sun size={17} className="text-acc" />}
            <div>
              <p className="text-[13.5px] font-medium">Modo oscuro</p>
              <p className="text-[12px] text-mut">También con la tecla T</p>
            </div>
          </div>
          <Toggle on={settings.dark} onChange={(v) => setSettings({ dark: v })} label="Modo oscuro" />
        </div>
      </section>

      {/* Presupuesto mensual */}
      <section className="bg-card border border-line rounded-xl p-5">
        <h2 className="font-display font-bold text-[15px] flex items-center gap-2 mb-1"><PiggyBank size={16} className="text-acc" /> Presupuesto mensual</h2>
        <p className="text-[12.5px] text-mut mb-4">
          Si defines un tope de gasto, el panel te mostrará cuánto llevas del mes contra él y te avisará si te pasas.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <label className="block text-[13px] font-medium text-mut mb-1.5" htmlFor="tb-budget">Tope mensual (€)</label>
            <input
              id="tb-budget"
              type="number"
              min={0}
              step={10}
              placeholder="p. ej. 600"
              className={cls(inputCls, "font-mono tnum")}
              defaultValue={settings.budget ?? ""}
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                setSettings({ budget: Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : undefined });
                if (Number.isFinite(v) && v > 0) toast("ok", `Presupuesto fijado en ${v.toLocaleString("es-ES")} €/mes.`);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          </div>
          {settings.budget ? (
            <Button variant="ghost" onClick={() => { setSettings({ budget: undefined }); toast("info", "Presupuesto retirado."); }}>Quitar presupuesto</Button>
          ) : (
            <span className="text-[12px] text-mut pb-2.5">Sin presupuesto: el panel mostrará el ticket medio en su lugar.</span>
          )}
        </div>
      </section>

      {/* Categorías */}
      <section className="bg-card border border-line rounded-xl p-5">
        <h2 className="font-display font-bold text-[15px] flex items-center gap-2 mb-1"><Tag size={16} className="text-acc" /> Categorías</h2>
        <p className="text-[12.5px] text-mut mb-4">Cada ticket se clasifica en una; el OCR sugiere la categoría con estas palabras clave.</p>
        <ul className="space-y-2">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2.5">
              <input
                type="color"
                value={c.color}
                onChange={(e) => setCategories(categories.map((x) => (x.id === c.id ? { ...x, color: e.target.value } : x)))}
                className="w-8 h-8 rounded-lg cursor-pointer border border-line bg-transparent p-0.5"
                aria-label={`Color de ${c.name}`}
              />
              <input
                className={cls(inputCls, "flex-1")}
                value={c.name}
                onChange={(e) => setCategories(categories.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
              />
              <span className="hidden sm:flex items-center gap-1.5 text-[12px] text-mut"><CatIcon id={c.id} size={14} />{tickets.filter((t) => t.category === c.id).length}</span>
              <button
                onClick={() => {
                  if (usedCategories.has(c.id)) {
                    toast("warn", `No puedes borrar «${c.name}»: hay tickets que la usan. Cámbialos antes de categoría.`);
                    return;
                  }
                  setCategories(categories.filter((x) => x.id !== c.id));
                  toast("info", `Categoría «${c.name}» eliminada.`);
                }}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-mut hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                title="Eliminar categoría"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          variant="soft"
          className="mt-3"
          onClick={() => {
            const id = "cat-" + uid().slice(0, 6);
            setCategories([...categories, { id, name: "Nueva categoría", color: "#0e7490", keywords: [] }]);
          }}
        >
          <Plus size={13} /> Añadir categoría
        </Button>
      </section>

      {/* Tiendas */}
      <section className="bg-card border border-line rounded-xl p-5">
        <h2 className="font-display font-bold text-[15px] flex items-center gap-2 mb-1"><StoreIcon size={16} className="text-acc" /> Tiendas conocidas</h2>
        <p className="text-[12.5px] text-mut mb-4">Sirven al OCR para reconocer la tienda y asignarle su categoría automáticamente.</p>
        <ul className="space-y-2">
          {stores.map((s, i) => (
            <li key={s.name + i} className="flex items-center gap-2.5">
              <input
                className={cls(inputCls, "flex-1")}
                value={s.name}
                onChange={(e) => setStores(stores.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <select
                className={cls(inputCls, "w-40")}
                value={s.category}
                onChange={(e) => setStores(stores.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}
              >
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button
                onClick={() => { setStores(stores.filter((_, j) => j !== i)); toast("info", `«${s.name}» eliminada de la lista.`); }}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-mut hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                title="Eliminar tienda"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          variant="soft"
          className="mt-3"
          onClick={() => setStores([...stores, { name: "Nueva tienda", category: "otros", keywords: ["nueva tienda"] }])}
        >
          <Plus size={13} /> Añadir tienda
        </Button>
      </section>

      {/* Datos */}
      <section className="bg-card border border-line rounded-xl p-5">
        <h2 className="font-display font-bold text-[15px] flex items-center gap-2 mb-1"><Database size={16} className="text-acc" /> Datos</h2>
        <p className="text-[12.5px] text-mut mb-4">
          {tickets.length} tickets guardados en IndexedDB de este navegador. Nada se envía a servidores propios.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={async () => { const n = await loadDemo(); toast("ok", `${n} tickets de ejemplo añadidos.`); }}>
            <Sparkles size={15} /> Añadir datos de ejemplo
          </Button>
          <Button variant="outline" onClick={() => nav("/exportar")}>
            <Download size={15} /> Exportar todo
          </Button>
          <Button variant="danger" onClick={() => setConfirmWipe(true)}>
            <Trash2 size={15} /> Borrar todos los tickets
          </Button>
        </div>
      </section>

      {/* Dónde pasa tu foto */}
      <section className="bg-card border border-line rounded-xl p-5">
        <h2 className="font-display font-bold text-[15px] flex items-center gap-2 mb-1"><MapPin size={16} className="text-acc" /> Dónde pasa tu foto, paso a paso</h2>
        <p className="text-[12.5px] text-mut mb-5 leading-relaxed">
          Transparencia total: este es el recorrido exacto de la imagen de cada ticket, desde que la haces hasta que la exportas.
          <strong className="text-ink"> TicketBox no tiene servidores propios y no almacena tus fotos en ningún sitio.</strong>
        </p>

        <ol className="relative space-y-5 ml-1">
          <span className="absolute left-[15px] top-4 bottom-4 w-px bg-line" aria-hidden />
          {[
            {
              icon: Camera, title: "1 · Captura", badge: "En tu dispositivo", tone: "ok",
              text: "La foto se hace con tu cámara o se elige de tu galería. En este momento la imagen solo existe en tu móvil u ordenador; no se sube a ningún sitio.",
            },
            {
              icon: Cpu, title: "2 · Lectura del ticket (OCR)", badge: "En tu dispositivo", tone: "ok",
              text: "Tesseract.js lee el total, la fecha, la tienda y los productos dentro de tu navegador. La foto no se envía a ningún servidor. La única descarga (solo la primera vez) es el motor OCR y el idioma español (~4 MB) desde su CDN oficial; después funciona incluso sin conexión.",
            },
            {
              icon: Database, title: "3 · Guardado", badge: "En tu dispositivo", tone: "ok",
              text: "La foto se comprime (~900 px, JPEG) y se guarda en IndexedDB, el almacén privado de tu navegador, junto con los datos del ticket. Solo tú puedes acceder desde tu sesión de usuario de este dispositivo.",
            },
            {
              icon: Cloud, title: "4 · Sincronización entre dispositivos", badge: "Red · cifrado de extremo a extremo", tone: "warn",
              text: "Solo ocurre si creas una cuenta. La foto se cifra en tu dispositivo con AES-256-GCM (clave derivada de tu contraseña con PBKDF2, 80.000 iteraciones) y viaja por un relé MQTT público (broker.emqx.io, con TLS). El relé solo ve datos ilegibles y no guarda nada. Sin cuenta, este paso no existe.",
              optional: true,
            },
            {
              icon: FileSpreadsheet, title: "5 · Exportación a Excel", badge: "En tu dispositivo", tone: "ok",
              text: "El libro .xlsx se genera dentro de tu navegador con ExcelJS y la foto queda incrustada en el archivo que se descarga. No se transmite a ningún servidor.",
            },
            {
              icon: EyeOff, title: "6 · Sin seguimiento", badge: "Privacidad", tone: "mut",
              text: "No usamos analíticas, cookies de terceros ni llamadas externas, salvo las dos descritas (descarga inicial del OCR y sincronización opcional cifrada). Nadie más ve tus tickets.",
            },
          ].map((s) => (
            <li key={s.title} className="relative flex gap-4">
              <span className="relative z-10 w-8 h-8 rounded-full bg-card border border-line2 flex items-center justify-center shrink-0">
                <s.icon size={15} className="text-acc" />
              </span>
              <div className="pb-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display font-semibold text-[14px]">{s.title}</p>
                  <span
                    className={cls(
                      "text-[10.5px] font-semibold px-2 py-0.5 rounded-full border",
                      s.tone === "ok" && "text-ok bg-ok/8 border-ok/25",
                      s.tone === "warn" && "text-warn bg-warn/8 border-warn/25",
                      s.tone === "mut" && "text-mut bg-card2 border-line2"
                    )}
                  >
                    {s.badge}
                  </span>
                  {s.optional && <span className="text-[10.5px] text-mut italic">opcional</span>}
                </div>
                <p className="text-[12.5px] text-mut mt-1 leading-relaxed">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-5 border-t border-line pt-4 flex items-start gap-3">
          <Lock size={15} className="text-mut shrink-0 mt-0.5" />
          <p className="text-[12px] text-mut leading-relaxed">
            <strong className="text-ink">Tus datos son tuyos.</strong> Las fotos y tickets viven en tu navegador y en los dispositivos con los que los sincronices.
            Si borras un ticket, se elimina de tu dispositivo (y del resto si la sincronización está activa). Al cerrar esta web sin cuenta creada,
            no queda ninguna copia fuera de tu equipo.
          </p>
        </div>
      </section>

      <Modal open={confirmWipe} onClose={() => setConfirmWipe(false)}>
        <div className="p-6">
          <h3 className="font-display font-bold text-lg">¿Borrar {tickets.length} tickets?</h3>
          <p className="text-mut text-sm mt-2 leading-relaxed">
            Se eliminarán los tickets y sus fotos de este dispositivo. Esta acción no se puede deshacer; si quieres conservar los datos, expórtalos a Excel antes.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setConfirmWipe(false)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await clearAll();
                setConfirmWipe(false);
                toast("info", "Archivador vacío en este dispositivo.");
              }}
            >
              <Trash2 size={15} /> Sí, borrar todo
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
