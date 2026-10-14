import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { format, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import {
  ScanLine, Wallet, Receipt as ReceiptIcon, Percent, ShieldCheck, ChevronRight, AlertTriangle,
  Store as StoreIcon, ArrowUpRight, TrendingUp, TrendingDown, Layers, Target, PiggyBank, Flame,
} from "lucide-react";
import { useApp } from "../lib/store";
import { fmtEUR, relDate, monthKey, cls } from "../lib/util";
import type { Ticket } from "../types";
import { CatIcon, EmptyState, Button, CountUp, Dot } from "../components/ui";
import TicketDetail from "../components/TicketDetail";
import { setPending } from "../lib/pending";

interface MonthRow {
  key: string;
  short: string;
  full: string;
  total: number;
  count: number;
  byCat: { id: string; name: string; color: string; total: number; pct: number }[];
}

export default function Dashboard() {
  const { tickets, categories, accent, settings } = useApp();
  const nav = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = format(now, "yyyy-MM");
    const prevMonth = format(subMonths(now, 1), "yyyy-MM");
    const sum = (xs: Ticket[]) => xs.reduce((a, t) => a + t.total, 0);

    const months: MonthRow[] = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      const key = format(d, "yyyy-MM");
      const list = tickets.filter((t) => monthKey(t.date) === key);
      const total = sum(list);
      return {
        key,
        short: format(d, "MMM", { locale: es }).replace(".", ""),
        full: format(d, "LLLL yyyy", { locale: es }),
        total: Math.round(total * 100) / 100,
        count: list.length,
        byCat: categories
          .map((c) => ({ ...c, total: Math.round(sum(list.filter((t) => t.category === c.id)) * 100) / 100 }))
          .filter((c) => c.total > 0)
          .map((c) => ({ id: c.id, name: c.name, color: c.color, total: c.total, pct: total > 0 ? (c.total / total) * 100 : 0 }))
          .sort((a, b) => b.total - a.total),
      };
    });

    const cur = months[5];
    const prev = months[4];
    const prevSum = tickets.filter((t) => monthKey(t.date) === prevMonth).reduce((a, t) => a + t.total, 0);
    const delta = prevSum > 0 ? ((cur.total - prevSum) / prevSum) * 100 : null;
    const avg = months.reduce((a, m) => a + m.total, 0) / 6;

    // top tiendas (todo el archivo)
    const byStore = new Map<string, { total: number; count: number }>();
    for (const t of tickets) {
      const s = byStore.get(t.store) || { total: 0, count: 0 };
      s.total += t.total;
      s.count++;
      byStore.set(t.store, s);
    }
    const topStores = [...byStore.entries()]
      .map(([store, v]) => ({ store, total: Math.round(v.total * 100) / 100, count: v.count, avg: v.total / v.count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    // garantías
    let active = 0, soon = 0;
    for (const t of tickets)
      for (const it of t.items) {
        if (!it.warrantyMonths) continue;
        const end = new Date(t.date + "T00:00:00");
        end.setMonth(end.getMonth() + it.warrantyMonths);
        const days = (end.getTime() - Date.now()) / 86400000;
        if (days >= 0) active++;
        if (days >= 0 && days < 60) soon++;
      }

    const recent = [...tickets].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 6);
    return { months, cur, prev, delta, avg, topStores, active, soon, recent };
  }, [tickets, categories]);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const recentWithPhoto = stats.recent.some((t) => t.photo);
  const selected = tickets.find((t) => t.id === selectedId) || null;
  const budget = settings.budget && settings.budget > 0 ? settings.budget : null;
  const budgetPct = budget ? (stats.cur.total / budget) * 100 : 0;

  const openCat = (id: string) => {
    setPending({ cat: id });
    nav("/tickets");
  };
  const openStore = (name: string) => {
    // al llegar a Tickets, la lista ya viene filtrada para mostrar
    // únicamente los tickets de esa tienda
    setPending({ store: name });
    nav("/tickets");
  };

  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={<ReceiptIcon size={26} />}
        title="Todavía no hay tickets archivados"
        desc="Escanea tu primer ticket con la cámara o sube una foto: TicketBox detectará el total, la fecha y la tienda en tu propio dispositivo."
        action={
          <Link to="/scan">
            <Button size="lg"><ScanLine size={17} /> Escanear mi primer ticket</Button>
          </Link>
        }
      />
    );
  }

  const tiles = [
    {
      label: `Gasto en ${stats.cur.full.split(" ")[0]}`, num: stats.cur.total, fmt: fmtEUR, icon: Wallet,
      extra: stats.delta !== null ? (
        <span className={cls("inline-flex items-center gap-1 text-[12px] font-mono font-semibold", stats.delta > 0 ? "text-warn" : "text-ok")}>
          {stats.delta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {Math.abs(stats.delta).toFixed(0)}% vs mes anterior
        </span>
      ) : <span className="text-[12px] text-mut">sin datos del mes anterior</span>,
    },
    {
      label: "Tickets este mes", num: stats.cur.count, icon: ReceiptIcon,
      extra: <span className="text-[12px] text-mut">{tickets.length} en total</span>,
    },
    budget
      ? {
          label: "Presupuesto mensual", num: 0, icon: budgetPct > 100 ? Flame : PiggyBank, isBudget: true as const,
          extra: null as never,
        }
      : {
          label: "Ticket medio", num: stats.cur.count ? stats.cur.total / stats.cur.count : 0, fmt: fmtEUR, icon: Percent,
          extra: <span className="text-[12px] text-mut">en el mes en curso</span>,
        },
    {
      label: "Garantías activas", num: stats.active, icon: ShieldCheck,
      extra: stats.soon > 0
        ? <span className="text-[12px] font-mono font-semibold text-warn">{stats.soon} caducan pronto</span>
        : <span className="text-[12px] text-mut">todo en vigor</span>,
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {tiles.map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.2 }}
            className="bg-card border border-line rounded-xl p-4 hover:shadow-print hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-medium text-mut">{t.label}</p>
              <t.icon size={16} className="text-acc" />
            </div>
            {"isBudget" in t && t.isBudget ? (
              <>
                <p className="font-mono font-semibold text-[22px] mt-1.5 tracking-tight leading-none tnum">
                  <CountUp value={budgetPct} format={(n) => `${Math.round(n)}%`} />
                </p>
                <div className="mt-2.5 h-1.5 rounded-full bg-card2 overflow-hidden">
                  <motion.div
                    className={cls("h-full rounded-full", budgetPct > 100 ? "bg-danger" : budgetPct > 80 ? "bg-warn" : "bg-acc")}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(budgetPct, 100)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
                  />
                </div>
                <p className={cls("text-[11.5px] mt-1.5 font-mono tnum", budgetPct > 100 ? "text-danger font-semibold" : "text-mut")}>
                  {budgetPct > 100
                    ? `${fmtEUR(stats.cur.total - budget!)} por encima`
                    : `quedan ${fmtEUR(budget! - stats.cur.total)}`}
                </p>
              </>
            ) : (
              <>
                <p className="font-mono font-semibold text-[24px] mt-1.5 tracking-tight leading-none tnum">
                  <CountUp value={("num" in t ? t.num : 0) as number} format={("fmt" in t ? t.fmt : undefined) as ((n: number) => string) | undefined} />
                </p>
                <div className="mt-2">{"extra" in t ? t.extra : null}</div>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {/* fila 1: ritmo + composición */}
      <div className="grid lg:grid-cols-5 gap-4">
        <motion.section
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.2 }}
          className="lg:col-span-3 bg-card border border-line rounded-xl p-5 hover:shadow-print transition-shadow"
        >
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="font-display font-extrabold text-[17px] tracking-[-0.01em]">Ritmo de gasto</h2>
              <p className="text-[12px] text-mut mt-0.5">últimos 6 meses</p>
            </div>
            <div className="text-right">
              <p className="font-mono font-semibold text-[20px] leading-none tnum">
                <CountUp value={stats.cur.total} format={fmtEUR} />
              </p>
              <p className="text-[11px] text-mut mt-1">
                {stats.delta !== null ? (
                  <span className={stats.delta > 0 ? "text-warn" : "text-ok"}>
                    {stats.delta > 0 ? "▲" : "▼"} {Math.abs(stats.delta).toFixed(0)}%
                  </span>
                ) : "—"}{" "}
                vs {stats.prev.short}
              </p>
            </div>
          </div>
          <div className="h-[248px] mt-2">
            <RhythmChart months={stats.months} accent={accent} avg={stats.avg} />
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.2 }}
          className="lg:col-span-2 bg-card border border-line rounded-xl p-5 hover:shadow-print transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display font-extrabold text-[17px] tracking-[-0.01em] flex items-center gap-2"><Layers size={15} className="text-acc" /> En qué se va</h2>
              <p className="text-[12px] text-mut mt-0.5">composición por categoría · mes a mes</p>
            </div>
          </div>
          <CompositionChart months={stats.months} onCat={openCat} />
        </motion.section>
      </div>

      {/* fila 2: top tiendas + actividad */}
      <div className="grid lg:grid-cols-5 gap-4">
        <motion.section
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.2 }}
          className="lg:col-span-3 bg-card border border-line rounded-xl p-5 hover:shadow-print transition-shadow"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="font-display font-extrabold text-[17px] tracking-[-0.01em] flex items-center gap-2"><StoreIcon size={15} className="text-acc" /> Top tiendas</h2>
              <p className="text-[12px] text-mut mt-0.5">dónde más gastas · todo el archivo</p>
            </div>
            <span className="text-[12px] text-mut font-mono">{stats.topStores.length} tiendas</span>
          </div>
          <ul className="space-y-1.5">
            {stats.topStores.map((s, i) => {
              const max = stats.topStores[0].total || 1;
              const pct = (s.total / max) * 100;
              return (
                <li key={s.store}>
                  <button
                    onClick={() => openStore(s.store)}
                    className="relative w-full overflow-hidden rounded-lg border border-line hover:border-line2 hover:bg-card2/60 transition-all group text-left cursor-pointer"
                  >
                    <motion.span
                      initial={{ width: 0 }}
                      whileInView={{ width: `${pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.06 + i * 0.04 }}
                      className="absolute inset-y-0 left-0 bg-acc/10 group-hover:bg-acc/16 transition-colors"
                    />
                    <span className="relative flex items-center gap-3 px-3.5 py-2.5">
                      <span className={cls("font-mono text-[11.5px] w-6 shrink-0 tnum", i === 0 ? "text-acc font-bold" : "text-mut")}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display font-semibold text-[14px] truncate group-hover:text-acc transition-colors">{s.store}</span>
                        <span className="block text-[11.5px] text-mut tnum">{s.count} ticket{s.count > 1 ? "s" : ""} · media {fmtEUR(s.avg)}</span>
                      </span>
                      <span className="font-mono font-semibold text-[14.5px] tnum">{fmtEUR(s.total)}</span>
                      <ArrowUpRight size={15} className="text-mut opacity-0 group-hover:opacity-100 group-hover:text-acc transition-all shrink-0" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-[11.5px] text-mut mt-3">Toca una tienda para ver sus tickets.</p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.2 }}
          className="lg:col-span-2 bg-card border border-line rounded-xl p-5 hover:shadow-print transition-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-display font-extrabold text-[17px] tracking-[-0.01em]">Actividad reciente</h2>
              <p className="text-[12px] text-mut mt-0.5">toca un ticket para abrirlo</p>
            </div>
            <Link to="/tickets" className="text-[12.5px] text-acc font-medium hover:underline">Ver todos</Link>
          </div>
          <ul className="space-y-1">
            {stats.recent.map((t, i) => {
              const cat = catById.get(t.category);
              return (
                <motion.li
                  key={t.id}
                  initial={{ opacity: 0, x: 6 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                >
                  <button
                    onClick={() => setSelectedId(t.id)}
                    className="w-full flex items-center gap-3 px-2.5 py-2 -mx-1 rounded-lg hover:bg-card2 transition-colors group cursor-pointer text-left"
                  >
                    {recentWithPhoto && (
                      <span className="w-9 h-9 rounded-md overflow-hidden border border-line bg-photobg shrink-0">
                        {t.photo ? <img src={t.photo} alt="" className="w-full h-full object-cover" loading="lazy" /> : <span className="w-full h-full flex items-center justify-center text-mut"><ReceiptIcon size={14} /></span>}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-[13.5px] font-semibold truncate group-hover:text-acc transition-colors">{t.store}</span>
                        {cat && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cat.color }} />}
                      </span>
                      <span className="block text-[11.5px] text-mut">{relDate(t.date)} · {cat?.name || "Otros"}</span>
                    </span>
                    <span className="font-mono font-semibold text-[13.5px] shrink-0 tnum">{fmtEUR(t.total)}</span>
                    <ChevronRight size={14} className="text-mut opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                </motion.li>
              );
            })}
          </ul>
          {!budget && (
            <p className="mt-3 pt-3 border-t border-line text-[11.5px] text-mut flex items-center gap-1.5">
              <Target size={12} className="text-acc shrink-0" />
              Consejo: define un presupuesto mensual en Ajustes y verás aquí tu consumo contra él.
            </p>
          )}
        </motion.section>
      </div>

      {/* garantías */}
      {stats.soon > 0 ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.2 }}>
          <Link to="/garantias" className="block bg-warn/8 border border-warn/25 rounded-xl px-5 py-4 hover:bg-warn/12 transition-colors">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-warn shrink-0" />
              <p className="text-[13.5px]">
                <strong className="text-warn font-semibold">{stats.soon} garantía{stats.soon > 1 ? "s" : ""} a punto de caducar</strong>
                <span className="text-mut"> — revisa tus productos antes de 60 días.</span>
              </p>
              <ChevronRight size={16} className="text-warn ml-auto shrink-0" />
            </div>
          </Link>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.2 }}>
          <div className="bg-ok/6 border border-ok/20 rounded-xl px-5 py-4 flex items-center gap-3">
            <ShieldCheck size={18} className="text-ok shrink-0" />
            <p className="text-[13.5px]"><strong className="text-ok font-semibold">Garantías bajo control</strong><span className="text-mut"> — ningún producto caduca en los próximos 60 días.</span></p>
          </div>
        </motion.div>
      )}

      <TicketDetail ticket={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

/* ── Barras de ritmo con hover y media ───────────────────────────────────── */
function RhythmChart({ months, accent, avg }: { months: MonthRow[]; accent: string; avg: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = months.map((m) => ({ ...m, name: m.short }));
  const max = Math.max(...months.map((m) => m.total), 1);

  const TipContent = ({ active, payload }: { active?: boolean; payload?: { payload: MonthRow }[] }) => {
    if (!active || !payload?.length) return null;
    const m = payload[0].payload;
    const idx = months.findIndex((x) => x.key === m.key);
    const prevT = idx > 0 ? months[idx - 1].total : 0;
    const d = prevT > 0 ? ((m.total - prevT) / prevT) * 100 : null;
    return (
      <div className="bg-card border border-line2 rounded-lg shadow-xl px-3.5 py-2.5 text-[12.5px] min-w-[150px]">
        <p className="font-display font-bold text-[13px] capitalize mb-1">{m.full}</p>
        <p className="font-mono font-semibold text-[15px] tnum">{fmtEUR(m.total)}</p>
        <p className="text-mut mt-0.5">
          {m.count} ticket{m.count !== 1 && "s"}
          {d !== null && (
            <span className={d > 0 ? "text-warn" : "text-ok"}> · {d > 0 ? "▲" : "▼"} {Math.abs(d).toFixed(0)}%</span>
          )}
        </p>
      </div>
    );
  };

  return (
    <div className="relative h-full">
      {avg > 0 && (
        <div
          className="absolute left-10 right-2 z-10 pointer-events-none"
          style={{ bottom: `calc(${((avg / (max * 1.12)) * 100).toFixed(1)}% )`, transform: "translateY(-14px)" }}
        >
          <div className="border-t border-dashed" style={{ borderColor: accent + "88" }} />
          <span className="absolute right-0 -top-[9px] text-[10px] font-mono px-1.5 rounded" style={{ color: accent, background: "var(--card)" }}>
            media {fmtEUR(avg)}
          </span>
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%" debounce={1}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11.5 }} dy={6} />
          <YAxis hide domain={[0, max * 1.12]} />
          <Tooltip cursor={{ fill: "var(--card2)" }} content={<TipContent />} />
          <Bar
            dataKey="total"
            radius={[7, 7, 2, 2]}
            onMouseLeave={() => setHover(null)}
            animationDuration={650}
            animationEasing="ease-out"
          >
            {data.map((m, i) => (
              <Cell
                key={m.key}
                fill={i === 5 ? accent : accent + "66"}
                fillOpacity={hover === null || hover === i ? 1 : 0.35}
                onMouseEnter={() => setHover(i)}
                style={{ transition: "fill-opacity .2s", cursor: "pointer" }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Composición por categoría (barras apiladas por mes) ─────────────────── */
function CompositionChart({ months, onCat }: { months: MonthRow[]; onCat: (id: string) => void }) {
  const [active, setActive] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; name: string; color: string; total: number; pct: number; month: string } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const totals = useMemo(() => {
    const m = new Map<string, { name: string; color: string; total: number }>();
    let grand = 0;
    for (const mo of months) {
      grand += mo.total;
      for (const c of mo.byCat) {
        const t = m.get(c.id) || { name: c.name, color: c.color, total: 0 };
        t.total = Math.round((t.total + c.total) * 100) / 100;
        m.set(c.id, t);
      }
    }
    return { rows: [...m.entries()].map(([id, v]) => ({ id, ...v, pct: grand > 0 ? (v.total / grand) * 100 : 0 })).sort((a, b) => b.total - a.total), grand };
  }, [months]);

  const move = (e: React.PointerEvent, c: MonthRow["byCat"][number], month: string) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, name: c.name, color: c.color, total: c.total, pct: c.pct, month });
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="mt-4 space-y-[9px]">
        {[...months].reverse().map((m, ri) => {
          const isCurrent = ri === 0;
          return (
            <div key={m.key} className="flex items-center gap-2.5">
              <span className={cls("w-9 text-[11px] font-mono shrink-0 capitalize", isCurrent ? "text-ink font-bold" : "text-mut")}>
                {m.short}
              </span>
              <div className={cls("flex-1 h-[19px] flex rounded-[5px] overflow-hidden", m.total === 0 && "bg-card2")}>
                {m.byCat.map((c) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, scaleX: 0.7 }}
                    whileInView={{ opacity: 1, scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 0.08 + ri * 0.03 }}
                    onPointerEnter={(e) => { setActive(c.id); move(e, c, m.full); }}
                    onPointerMove={(e) => move(e, c, m.full)}
                    onPointerLeave={() => { setActive(null); setTip(null); }}
                    onClick={() => onCat(c.id)}
                    className="h-full cursor-pointer origin-left"
                    style={{
                      width: `${Math.max(c.pct, 3.5)}%`,
                      background: c.color,
                      opacity: active === null || active === c.id ? 1 : 0.25,
                      transition: "opacity .18s",
                      boxShadow: active === c.id ? `0 0 0 1.5px var(--card) inset, 0 0 0 3px ${c.color} inset` : undefined,
                    }}
                  />
                ))}
              </div>
              <span className="w-[64px] text-right font-mono text-[11px] shrink-0 text-mut tnum">
                {m.total > 0 ? fmtEUR(m.total) : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {tip && (
        <div
          className="absolute z-20 pointer-events-none bg-ink text-paper border border-line2 rounded-lg px-3 py-2 shadow-xl"
          style={{ left: Math.min(tip.x + 12, (boxRef.current?.clientWidth || 300) - 170), top: tip.y - 62 }}
        >
          <p className="flex items-center gap-1.5 text-[12px] font-semibold">
            <Dot color={tip.color} /> {tip.name}
          </p>
          <p className="font-mono text-[13px] mt-0.5 tnum">{fmtEUR(tip.total)} <span className="opacity-60">· {tip.pct.toFixed(0)}% de {tip.month}</span></p>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-line">
        <p className="text-[11px] text-mut mb-2.5">Total 6 meses · <span className="font-mono text-ink tnum">{fmtEUR(totals.grand)}</span> — toca una categoría para ver sus tickets</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {totals.rows.map((r) => (
            <button
              key={r.id}
              onClick={() => onCat(r.id)}
              onMouseEnter={() => setActive(r.id)}
              onMouseLeave={() => setActive(null)}
              className="flex items-center gap-1.5 text-[12px] cursor-pointer transition-opacity"
              style={{ opacity: active === null || active === r.id ? 1 : 0.4 }}
            >
              <Dot color={r.color} />
              <span className="text-mut">{r.name}</span>
              <span className="font-mono text-ink tnum">{r.pct.toFixed(0)}%</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
