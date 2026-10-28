import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { format, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { ScanLine, Wallet, Receipt as ReceiptIcon, Percent, ChevronRight, Store as StoreIcon, ArrowUpRight, TrendingUp, TrendingDown, Layers, Target, PiggyBank, Flame, Image as ImageIcon } from "lucide-react";
import { useApp } from "../lib/store";
import { fmtEUR, relDate, monthKey, cls } from "../lib/util";
import type { Ticket } from "../types";
import { CatIcon, EmptyState, Button, CountUp, Dot } from "../components/ui";
import TicketDetail from "../components/TicketDetail";
import { setPending } from "../lib/pending";

interface MonthRow {
  key: string; short: string; full: string; total: number; count: number;
  byCat: { id: string; name: string; color: string; total: number; pct: number }[];
}

export default function Dashboard() {
  const { tickets, categories, settings } = useApp();
  const nav = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const now = new Date();
    const prevMonth = format(subMonths(now, 1), "yyyy-MM");
    const sum = (xs: Ticket[]) => xs.reduce((a, t) => a + t.total, 0);

    const months: MonthRow[] = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      const key = format(d, "yyyy-MM");
      const list = tickets.filter((t) => monthKey(t.date) === key);
      const total = sum(list);
      return {
        key, short: format(d, "MMM", { locale: es }).replace(".", ""), full: format(d, "LLLL yyyy", { locale: es }),
        total: Math.round(total * 100) / 100, count: list.length,
        byCat: categories.map((c) => ({ ...c, total: Math.round(sum(list.filter((t) => t.category === c.id)) * 100) / 100 }))
          .filter((c) => c.total > 0)
          .map((c) => ({ id: c.id, name: c.name, color: c.color, total: c.total, pct: total > 0 ? (c.total / total) * 100 : 0 }))
          .sort((a, b) => b.total - a.total),
      };
    });

    const cur = months[5], prev = months[4];
    const prevSum = tickets.filter((t) => monthKey(t.date) === prevMonth).reduce((a, t) => a + t.total, 0);
    const delta = prevSum > 0 ? ((cur.total - prevSum) / prevSum) * 100 : null;
    const avg = months.reduce((a, m) => a + m.total, 0) / 6;

    const byStore = new Map<string, { total: number; count: number }>();
    for (const t of tickets) { const s = byStore.get(t.store) || { total: 0, count: 0 }; s.total += t.total; s.count++; byStore.set(t.store, s); }
    const topStores = [...byStore.entries()].map(([store, v]) => ({ store, total: Math.round(v.total * 100) / 100, count: v.count, avg: v.total / v.count })).sort((a, b) => b.total - a.total).slice(0, 6);

    const recent = [...tickets].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 6);
    return { months, cur, prev, delta, avg, topStores, recent };
  }, [tickets, categories]);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const selected = tickets.find((t) => t.id === selectedId) || null;
  const budget = settings.budget && settings.budget > 0 ? settings.budget : null;
  const budgetPct = budget ? (stats.cur.total / budget) * 100 : 0;

  const openCat = (id: string) => { setPending({ cat: id }); nav("/tickets"); };
  const openStore = (name: string) => { setPending({ store: name }); nav("/tickets"); };

  if (tickets.length === 0) {
    return <EmptyState icon={<ReceiptIcon size={26} />} title="Todavía no hay tickets" desc="Escanea tu primer ticket con la cámara o sube una foto." action={<Link to="/scan"><Button size="lg"><ScanLine size={17} /> Escanear ticket</Button></Link>} />;
  }

  const tiles = [
    { label: `Gasto en ${stats.cur.full.split(" ")[0]}`, num: stats.cur.total, fmt: fmtEUR, icon: Wallet,
      extra: stats.delta !== null ? <span className={cls("inline-flex items-center gap-1 text-[12px] font-medium tabular-nums", stats.delta > 0 ? "text-[var(--warning)]" : "text-[var(--success)]")}>{stats.delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {Math.abs(stats.delta).toFixed(0)}%</span> : <span className="text-[12px] text-[var(--text-3)]">—</span> },
    { label: "Tickets este mes", num: stats.cur.count, icon: ReceiptIcon, extra: <span className="text-[12px] text-[var(--text-3)]">{tickets.length} en total</span> },
    budget ? { label: "Presupuesto", num: 0, icon: budgetPct > 100 ? Flame : PiggyBank, isBudget: true as const, extra: null as never }
           : { label: "Ticket medio", num: stats.cur.count ? stats.cur.total / stats.cur.count : 0, fmt: fmtEUR, icon: Percent, extra: <span className="text-[12px] text-[var(--text-3)]">este mes</span> },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((t, i) => (
          <motion.div key={t.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="surface p-4 hover:shadow-[var(--shadow-sm)] transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <p className="text-caption">{t.label}</p>
              <t.icon size={15} className="text-[var(--text-3)]" />
            </div>
            {"isBudget" in t && t.isBudget ? (
              <>
                <p className="text-[22px] font-semibold tabular-nums tracking-tight"><CountUp value={budgetPct} format={(n) => `${Math.round(n)}%`} /></p>
                <div className="mt-2 h-1 rounded-full bg-[var(--surface-3)] overflow-hidden">
                  <motion.div className={cls("h-full rounded-full", budgetPct > 100 ? "bg-[var(--danger)]" : budgetPct > 80 ? "bg-[var(--warning)]" : "bg-[var(--accent)]")}
                    initial={{ width: 0 }} animate={{ width: `${Math.min(budgetPct, 100)}%` }} transition={{ duration: 0.5, delay: 0.2 }} />
                </div>
                <p className={cls("text-[11px] mt-1.5 tabular-nums", budgetPct > 100 ? "text-[var(--danger)] font-medium" : "text-[var(--text-3)]")}>
                  {budgetPct > 100 ? `${fmtEUR(stats.cur.total - budget!)} por encima` : `quedan ${fmtEUR(budget! - stats.cur.total)}`}
                </p>
              </>
            ) : (
              <>
                <p className="text-[22px] font-semibold tabular-nums tracking-tight"><CountUp value={("num" in t ? t.num : 0) as number} format={("fmt" in t ? t.fmt : undefined) as ((n: number) => string) | undefined} /></p>
                <div className="mt-1">{t.extra}</div>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-5 gap-4">
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-3 surface p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-title-3">Ritmo de gasto</h2>
              <p className="text-footnote mt-0.5">Últimos 6 meses</p>
            </div>
            <div className="text-right">
              <p className="text-[18px] font-semibold tabular-nums"><CountUp value={stats.cur.total} format={fmtEUR} /></p>
              <p className="text-footnote mt-0.5">{stats.delta !== null ? <span className={stats.delta > 0 ? "text-[var(--warning)]" : "text-[var(--success)]"}>{stats.delta > 0 ? "▲" : "▼"} {Math.abs(stats.delta).toFixed(0)}%</span> : "—"} vs {stats.prev.short}</p>
            </div>
          </div>
          <div className="h-[220px]">
            <RhythmChart months={stats.months} avg={stats.avg} />
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="lg:col-span-2 surface p-5">
          <h2 className="text-title-3 flex items-center gap-2"><Layers size={15} className="text-[var(--accent)]" /> Por categoría</h2>
          <p className="text-footnote mt-0.5 mb-4">Composición del mes</p>
          <CompositionChart months={stats.months} onCat={openCat} />
        </motion.section>
      </div>

      {/* Top tiendas + Actividad */}
      <div className="grid lg:grid-cols-5 gap-4">
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-3 surface p-5">
          <h2 className="text-title-3 flex items-center gap-2"><StoreIcon size={15} className="text-[var(--accent)]" /> Top tiendas</h2>
          <p className="text-footnote mt-0.5 mb-4">Dónde más gastas</p>
          <ul className="space-y-1">
            {stats.topStores.map((s, i) => {
              const max = stats.topStores[0].total || 1;
              const pct = (s.total / max) * 100;
              return (
                <li key={s.store}>
                  <button onClick={() => openStore(s.store)} className="relative w-full overflow-hidden rounded-xl hover:bg-[var(--surface-2)] transition-colors group text-left cursor-pointer">
                    <motion.span initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: 0.05 + i * 0.04 }} className="absolute inset-y-0 left-0 bg-[var(--accent-soft)]" />
                    <span className="relative flex items-center gap-3 px-3 py-2.5">
                      <span className={cls("text-[11px] font-medium w-5 tabular-nums", i === 0 ? "text-[var(--accent)]" : "text-[var(--text-3)]")}>{String(i + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium truncate group-hover:text-[var(--accent)] transition-colors">{s.store}</span>
                        <span className="block text-[12px] text-[var(--text-3)] tabular-nums">{s.count} tickets · media {fmtEUR(s.avg)}</span>
                      </span>
                      <span className="text-[14px] font-semibold tabular-nums">{fmtEUR(s.total)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="lg:col-span-2 surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-title-3">Recientes</h2>
            <Link to="/tickets" className="text-[13px] text-[var(--accent)] font-medium hover:underline">Ver todos</Link>
          </div>
          <ul className="space-y-0.5">
            {stats.recent.map((t, i) => {
              const cat = catById.get(t.category);
              return (
                <motion.li key={t.id} initial={{ opacity: 0, x: 8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.03 }}>
                  <button onClick={() => setSelectedId(t.id)} className="w-full flex items-center gap-3 px-2 py-2 -mx-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors group cursor-pointer text-left">
                    <span className="w-9 h-9 rounded-lg overflow-hidden bg-[var(--surface-3)] shrink-0 flex items-center justify-center">
                      {t.photo ? <img src={t.photo} alt="" className="w-full h-full object-cover" loading="lazy" /> : <ImageIcon size={14} className="text-[var(--text-3)]" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium truncate group-hover:text-[var(--accent)] transition-colors">{t.store}</span>
                      <span className="block text-[12px] text-[var(--text-3)]">{relDate(t.date)} · {cat?.name || "Otros"}</span>
                    </span>
                    <span className="text-[14px] font-semibold tabular-nums">{fmtEUR(t.total)}</span>
                  </button>
                </motion.li>
              );
            })}
          </ul>
          {!budget && (
            <p className="mt-4 pt-3 border-t border-[var(--border)] text-[12px] text-[var(--text-3)] flex items-center gap-1.5">
              <Target size={11} className="text-[var(--accent)]" /> Define un presupuesto en Ajustes
            </p>
          )}
        </motion.section>
      </div>

      <TicketDetail ticket={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function RhythmChart({ months, avg }: { months: MonthRow[]; avg: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = months.map((m) => ({ ...m, name: m.short }));
  const max = Math.max(...months.map((m) => m.total), 1);
  const accent = "var(--accent)";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="24%">
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--text-3)", fontSize: 11 }} dy={4} />
        <YAxis hide domain={[0, max * 1.15]} />
        <Tooltip cursor={{ fill: "var(--surface-3)" }} content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const m = payload[0].payload as MonthRow;
          return <div className="surface-elevated px-3 py-2 text-[12px]"><p className="font-medium capitalize">{m.full}</p><p className="text-[15px] font-semibold tabular-nums mt-0.5">{fmtEUR(m.total)}</p><p className="text-[var(--text-3)]">{m.count} tickets</p></div>;
        }} />
        {avg > 0 && <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={600}>
          {data.map((m, i) => <Cell key={m.key} fill={i === 5 ? accent : `${accent}44`} fillOpacity={hover === null || hover === i ? 1 : 0.4} onMouseEnter={() => setHover(i)} style={{ transition: "fill-opacity .2s", cursor: "pointer" }} />)}
        </Bar>}
      </BarChart>
    </ResponsiveContainer>
  );
}

function CompositionChart({ months, onCat }: { months: MonthRow[]; onCat: (id: string) => void }) {
  const [active, setActive] = useState<string | null>(null);
  const totals = useMemo(() => {
    const m = new Map<string, { name: string; color: string; total: number }>();
    let grand = 0;
    for (const mo of months) { grand += mo.total; for (const c of mo.byCat) { const t = m.get(c.id) || { name: c.name, color: c.color, total: 0 }; t.total += c.total; m.set(c.id, t); } }
    return { rows: [...m.entries()].map(([id, v]) => ({ id, ...v, pct: grand > 0 ? (v.total / grand) * 100 : 0 })).sort((a, b) => b.total - a.total), grand };
  }, [months]);

  return (
    <div>
      <div className="space-y-2">
        {[...months].reverse().map((m) => (
          <div key={m.key} className="flex items-center gap-2">
            <span className="w-8 text-[10px] font-medium text-[var(--text-3)] tabular-nums">{m.short}</span>
            <div className="flex-1 h-4 flex rounded-md overflow-hidden bg-[var(--surface-3)]">
              {m.byCat.map((c) => (
                <div key={c.id} onClick={() => onCat(c.id)} onMouseEnter={() => setActive(c.id)} onMouseLeave={() => setActive(null)}
                  className="h-full cursor-pointer transition-opacity" style={{ width: `${Math.max(c.pct, 2)}%`, background: c.color, opacity: active === null || active === c.id ? 1 : 0.3 }} />
              ))}
            </div>
            <span className="w-14 text-right text-[10px] font-medium text-[var(--text-3)] tabular-nums">{m.total > 0 ? fmtEUR(m.total) : "—"}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-[var(--border)]">
        <p className="text-caption mb-2">Total 6 meses · {fmtEUR(totals.grand)}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {totals.rows.map((r) => (
            <button key={r.id} onClick={() => onCat(r.id)} onMouseEnter={() => setActive(r.id)} onMouseLeave={() => setActive(null)}
              className="flex items-center gap-1.5 text-[12px] cursor-pointer transition-opacity" style={{ opacity: active === null || active === r.id ? 1 : 0.4 }}>
              <Dot color={r.color} /> <span className="text-[var(--text-2)]">{r.name}</span> <span className="font-medium tabular-nums">{r.pct.toFixed(0)}%</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
