import { useState } from "react";
import { Moon, Sun, Plus, Trash2, Sparkles, Database, Palette, Store as StoreIcon, Tag, Download, Check } from "lucide-react";
import { useApp, THEMES } from "../lib/store";
import { cls, uid } from "../lib/util";
import { Button, Toggle, Modal, Field, inputCls, CatIcon } from "../components/ui";

export default function Settings() {
  const { settings, setSettings, categories, setCategories, stores, setStores, tickets, loadDemo, clearAll, toast, accent } = useApp();
  const [confirmWipe, setConfirmWipe] = useState(false);

  const usedCategories = new Set(tickets.map((t) => t.category));

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Apariencia */}
      <section className="bg-card border border-line rounded-xl p-5">
        <h2 className="font-display font-bold text-[15px] flex items-center gap-2 mb-4"><Palette size={16} className="text-acc" /> Apariencia</h2>
        <p className="text-[11px] font-display font-semibold uppercase tracking-[0.08em] text-mut mb-2">Color de acento · 6 temas + propio</p>
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
                  active ? "border-acc bg-acc/10 shadow-sm" : "border-line hover:border-line2"
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
                    value={settings.customColor || "#12a374"}
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
          <Button variant="outline" onClick={() => toast("info", "Usa la página Exportar para descargar el Excel.")}>
            <Download size={15} /> Exportar todo
          </Button>
          <Button variant="danger" onClick={() => setConfirmWipe(true)}>
            <Trash2 size={15} /> Borrar todos los tickets
          </Button>
        </div>
      </section>

      <Modal open={confirmWipe} onClose={() => setConfirmWipe(false)}>
        <div className="p-6">
          <h3 className="font-display font-bold text-lg">¿Borrar {tickets.length} tickets?</h3>
          <p className="text-mut text-sm mt-2 leading-relaxed">
            Se eliminarán los tickets y sus fotos de IndexedDB. Esta acción no se puede deshacer; si quieres conservar los datos, expórtalos a Excel antes.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setConfirmWipe(false)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await clearAll();
                setConfirmWipe(false);
                toast("info", "Archivador vacío. Los datos de ejemplo volverán si recargas.");
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
