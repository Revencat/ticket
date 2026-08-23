import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, PieChart, Pie, Cell,
} from "recharts";
import { format, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import {
  ScanLine, Wallet, Receipt as ReceiptIcon, Percent, ShieldCheck, ArrowRight, ChevronRight, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Image as ImageIcon,
} from "lucide-react";
import { useApp } from "../lib/store";
import { fmtEUR, relDate, cls } from "../lib/util";
import { CatIcon, EmptyState, Button, CountUp } from "../components/ui";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface MonthStat {
  key: string;
  label: string;
  full: string;
  total: number;
  count: number;
  prev: number | null;
}
interface CatStat {
  id: string;
  name: string;
  color: string;
  total: number;
}

/* ── chip de variación (▲ gasto = ámbar, ▼ gasto = verde) ─────────────────── */
function DeltaChip({ now, prev, dark }: { now: number; prev: number | null; dark?: boolean }) {
  if (prev === null || prev <= 0) {
    return <span className={cls("font-mono text-[11px]", dark ? "text-[#8b978f]" : "text-mut")}>—</span>;
  }
  const pct = ((now - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span
      className={cls(
        "inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold",
        dark ? (up ? "text-[#e8b45a]" : "text-[#5ecf9a]") : up ? "text-warn" : "text-ok"
      )}
    >
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

/* ── tooltip propio de la gráfica de barras ───────────────────────────────── */
function BarTip({ active, payload }: { active?: boolean; payload?: Array<{ payload: MonthStat }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2.5 shadow-xl pointer-events-none">
      <p className="text-[11px] font-mono text-mut">{d.full}</p>
      <p className="font-mono font-semibold text-[16px] leading-tight mt-0.5">{fmtEUR(d.total)}</p>
      <div className="flex items-center gap-2 mt-1 text-[11px] text-mut">
        <span>{d.count} ticket{d.count !== 1 && "s"}</span>
        <DeltaChip now={d.total} prev={d.prev} />
      </div>
    </div>
  );
}

function PieTip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CatStat }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/15 bg-[#262d34] px-3 py-2 shadow-xl pointer-events-none">
      <p className="text-[11px] text-[#9aa79f]">{d.name}</p>
      <p className="font-mono font-semibold text-[15px] text-white leading-tight mt-0.5">{fmtEUR(d.total)}</p>
    </div>
  );
}

export default function Dashboard() {
  const { tickets, categories, accent } = useApp();
  const [activeBar, setActiveBar] = useState<number | null>(null);
  const [activeCat, setActiveCat] = useState<number | null>(null);

  const stats = useMemo(() => {
    const now = new Date();
    const monthLabel = format(now, "LLLL", { locale: es });

    // 7 meses para poder calcular la variación del primero visible
    const months: MonthStat[] = Array.from({ length: 7 }, (_, i) => {
      const d = subMonths(now, 6 - i);
      const key = format(d, "yyyy-MM");
      const inMonth = tickets.filter((t) => t.date.startsWith(key));
      return {
        key,
        label: cap(format(d, "MMM", { locale: es })),
        full: `${cap(format(d, "LLLL", { locale: es }))} ${format(d, "yyyy")}`,
        total: Math.round(inMonth.reduce((a, t) => a + t.total, 0) * 100) / 100,
        count: inMonth.length,
        prev: null,
      };
    }).map((m, i, xs) => ({ ...m, prev: i === 0 ? null : xs[i - 1].total }));

    const chartData = months.slice(1); // 6 visibles, todos con `prev`
    const cur = months[6];
    const prevMonth = months[5];
    const avgMonth = Math.round((chartData.reduce((a, m) => a + m.total, 0) / 6) * 100) / 100;
    const peak = chartData.reduce((a, m) => (m.total > a.total ? m : a), chartData[0]);

    const byCat: CatStat[] = categories
      .map((c) => ({ id: c.id, name: c.name, color: c.color, total: Math.round(tickets.filter((t) => t.category === c.id && t.date.startsWith(cur.key)).reduce((a, t) => a + t.total, 0) * 100) / 100 }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);

    let warrantyActive = 0, warrantySoon = 0;
    for (const t of tickets)
      for (const it of t.items) {
        if (!it.warrantyMonths) continue;
        const end = new Date(t.date + "T00:00:00");
        end.setMonth(end.getMonth() + it.warrantyMonths);
        const days = (end.getTime() - Date.now()) / 86400000;
        if (days >= 0) warrantyActive++;
        if (days >= 0 && days < 60) warrantySoon++;
      }

    return {
      monthLabel,
      curSum: cur.total,
      curCount: cur.count,
      prevSum: prevMonth.total,
      avg: cur.count ? Math.round((cur.total / cur.count) * 100) / 100 : 0,
      chartData,
      avgMonth,
      peak,
      byCat,
      warrantyActive,
      warrantySoon,
      recent: [...tickets]
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
        .slice(0, 6),
    };
  }, [tickets, categories]);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

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

  const maxTotal = Math.max(...stats.chartData.map((m) => m.total), 1);
  const tiles = [
    {
      label: `Gasto en ${stats.monthLabel}`, num: stats.curSum, fmt: fmtEUR, icon: Wallet,
      extra: stats.prevSum > 0
        ? <span className="inline-flex items-center gap-1.5 text-[12px]"><DeltaChip now={stats.curSum} prev={stats.prevSum} /><span className="text-mut">vs mes anterior</span></span>
        : <span className="text-[12px] text-mut">sin datos del mes anterior</span>,
    },
    { label: "Tickets este mes", num: stats.curCount, icon: ReceiptIcon, extra: <span className="text-[12px] text-mut">{tickets.length} en total</span> },
    { label: "Ticket medio", num: stats.avg, fmt: fmtEUR, icon: Percent, extra: <span className="text-[12px] text-mut">en el mes en curso</span> },
    {
      label: "Garantías activas", num: stats.warrantyActive, icon: ShieldCheck,
      extra: stats.warrantySoon > 0
        ? <span className="text-[12px] font-mono font-semibold text-warn">{stats.warrantySoon} caducan pronto</span>
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
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-line rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-display font-semibold uppercase tracking-[0.08em] text-mut">{t.label}</p>
              <t.icon size={16} className="text-acc" />
            </div>
            <p className="font-mono font-semibold text-[22px] mt-2 tracking-tight">
              <CountUp value={t.num} format={t.fmt} />
            </p>
            <div className="mt-1">{t.extra}</div>
          </motion.div>
        ))}
      </div>

      {/* Ritmo de gasto + Por categoría */}
      <div className="grid lg:grid-cols-5 gap-3.5">
        <motion.section
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="lg:col-span-3 bg-card border border-line rounded-xl p-5 chart-glow hover:border-line2 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display font-bold text-[15px]">Ritmo de gasto</h2>
              <p className="text-[12px] text-mut mt-0.5">últimos 6 meses</p>
            </div>
            <div className="text-right">
              <p className="font-mono font-semibold text-[24px] leading-tight tracking-tight">
                <CountUp value={stats.curSum} format={fmtEUR} />
              </p>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <DeltaChip now={stats.curSum} prev={stats.prevSum} />
                <span className="text-[11px] text-mut">este mes</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3 text-[11px] text-mut">
            <svg width="26" height="6" aria-hidden><line x1="0" y1="3" x2="26" y2="3" stroke="var(--muted)" strokeOpacity="0.6" strokeDasharray="4 3" /></svg>
            <span>media <span className="font-mono text-ink">{fmtEUR(stats.avgMonth)}</span>/mes</span>
          </div>

          <div className="h-[252px] mt-2">
            <ResponsiveContainer>
              <BarChart
                data={stats.chartData}
                margin={{ top: 6, right: 6, left: -6, bottom: 0 }}
                barCategoryGap="26%"
                onMouseMove={(st) => {
                  const i = (st as { activeTooltipIndex?: number }).activeTooltipIndex;
                  setActiveBar(typeof i === "number" && i >= 0 ? i : null);
                }}
                onMouseLeave={() => setActiveBar(null)}
              >
                <defs>
                  <linearGradient id="tbBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={accent} stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 5" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11.5 }} dy={6} />
                <YAxis
                  tickLine={false} axisLine={false} width={40}
                  tick={{ fill: "var(--muted)", fontSize: 10.5 }}
                  tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace(".", ",")}k` : `${v}€`)}
                />
                <Tooltip cursor={{ fill: "var(--accent-soft)" }} content={<BarTip />} />
                <ReferenceLine y={stats.avgMonth} stroke="var(--muted)" strokeOpacity={0.5} strokeDasharray="5 5" />
                <Bar dataKey="total" radius={[7, 7, 2, 2]} maxBarSize={46} animationDuration={750}>
                  {stats.chartData.map((m, i) => (
                    <Cell
                      key={m.key}
                      cursor="pointer"
                      fill={activeBar === null || activeBar === i ? "url(#tbBar)" : `${accent}26`}
                      style={{ transition: "fill .18s" }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        {/* Donut por categoría — tarjeta oscura de contraste */}
        <motion.section
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          className="lg:col-span-2 card-ink relative overflow-hidden border border-white/10 rounded-xl p-5"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-25"
            style={{ background: `radial-gradient(circle, ${accent}, transparent 68%)` }}
          />
          <div className="relative flex items-start justify-between">
            <div>
              <h2 className="font-display font-bold text-[15px] text-white">Por categoría</h2>
              <p className="text-[12px] text-[#8b978f] mt-0.5 capitalize">{stats.monthLabel}</p>
            </div>
            <span className="font-mono text-[11px] text-[#8b978f] border border-white/10 rounded-md px-2 py-1">{stats.byCat.length} categoría{stats.byCat.length !== 1 && "s"}</span>
          </div>

          {stats.byCat.length === 0 ? (
            <p className="relative text-[#8b978f] text-sm py-16 text-center">Sin gasto registrado este mes.</p>
          ) : (
            <>
              <div className="relative h-[196px] mt-3">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={stats.byCat} dataKey="total" nameKey="name"
                      innerRadius="66%" outerRadius="94%" paddingAngle={3} cornerRadius={5}
                      strokeWidth={0} startAngle={90} endAngle={-270} animationDuration={800}
                    >
                      {stats.byCat.map((c, i) => (
                        <Cell
                          key={c.id} fill={c.color}
                          opacity={activeCat === null || activeCat === i ? 1 : 0.2}
                          style={{ transition: "opacity .18s", cursor: "pointer" }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <AnimatePresence mode="wait">
                    {activeCat === null ? (
                      <motion.div key="all" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }} className="text-center">
                        <p className="font-mono font-semibold text-[19px] text-white leading-tight">{fmtEUR(stats.curSum)}</p>
                        <p className="text-[11px] text-[#8b978f] mt-0.5">total del mes</p>
                      </motion.div>
                    ) : (
                      <motion.div key={stats.byCat[activeCat].id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }} className="text-center px-3">
                        <p className="font-mono font-semibold text-[19px] text-white leading-tight">{fmtEUR(stats.byCat[activeCat].total)}</p>
                        <p className="text-[11px] font-medium mt-0.5" style={{ color: stats.byCat[activeCat].color }}>
                          {stats.byCat[activeCat].name} · {Math.round((stats.byCat[activeCat].total / stats.curSum) * 100)}%
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <ul className="relative mt-3 space-y-0.5">
                {stats.byCat.map((c, i) => {
                  const pct = stats.curSum > 0 ? Math.round((c.total / stats.curSum) * 100) : 0;
                  return (
                    <li
                      key={c.id}
                      onMouseEnter={() => setActiveCat(i)}
                      onMouseLeave={() => setActiveCat(null)}
                      className={cls(
                        "flex items-center gap-2.5 rounded-lg px-2 py-1.5 -mx-2 transition-colors cursor-default",
                        activeCat === i && "bg-white/[0.06]"
                      )}
                    >
                      <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: c.color }} />
                      <span className="text-[13px] text-[#c6cec8] truncate">{c.name}</span>
                      <span className="ml-auto font-mono text-[11px] text-[#8b978f] w-9 text-right">{pct}%</span>
                      <span className="font-mono text-[12.5px] font-semibold text-white w-[74px] text-right">{fmtEUR(c.total)}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </motion.section>
      </div>

      {/* Actividad reciente + Comparativa mensual */}
      <div className="grid lg:grid-cols-5 gap-3.5">
        <motion.section
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
          className="lg:col-span-3 bg-card border border-line rounded-xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="font-display font-bold text-[15px]">Actividad reciente</h2>
            <Link to="/tickets" className="group/link text-[12.5px] text-acc font-medium inline-flex items-center gap-1 hover:underline">
              Ver todos <ArrowRight size={13} className="transition-transform group-hover/link:translate-x-0.5" />
            </Link>
          </div>
          <ul className="px-2.5 pb-2.5">
            {stats.recent.map((t, i) => {
              const cat = catById.get(t.category);
              return (
                <motion.li key={t.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.28 + i * 0.04 }}>
                  <Link
                    to="/tickets"
                    className="group flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-card2 transition-all"
                  >
                    <span className="w-11 h-11 rounded-lg overflow-hidden border border-line bg-white shrink-0 flex items-center justify-center">
                      {t.photo ? (
                        <img src={t.photo} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                      ) : (
                        <ImageIcon size={16} className="text-mut" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold truncate leading-tight">{t.store}</span>
                      <span className="flex items-center gap-1.5 mt-0.5 text-[11.5px] text-mut">
                        <span className="font-mono">{relDate(t.date)}</span>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-1 truncate" style={{ color: cat?.color }}>
                          <CatIcon id={t.category} size={11} /> {cat?.name || "Otros"}
                        </span>
                      </span>
                    </span>
                    <span className="font-mono font-semibold text-[14px] w-[76px] text-right shrink-0">{fmtEUR(t.total)}</span>
                    <ChevronRight size={15} className="text-acc opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0" />
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
          className="lg:col-span-2 bg-card border border-line rounded-xl p-5 flex flex-col"
        >
          <div className="flex items-baseline justify-between">
            <h2 className="font-display font-bold text-[15px]">Comparativa mensual</h2>
            <span className="text-[11.5px] font-mono text-mut">vs mes anterior</span>
          </div>
          <ul className="mt-3 space-y-2.5 flex-1">
            {stats.chartData.map((m, i) => (
              <li key={m.key}>
                <div className="flex items-center justify-between text-[12.5px] mb-1">
                  <span className="font-medium">{m.label} <span className="text-mut font-normal">{m.count} tk</span></span>
                  <span className="inline-flex items-center gap-2">
                    <DeltaChip now={m.total} prev={m.prev} />
                    <span className="font-mono font-semibold">{fmtEUR(m.total)}</span>
                  </span>
                </div>
                <div className="h-[7px] rounded-full bg-card2 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: i === stats.chartData.length - 1 ? accent : `${accent}52` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(m.total / maxTotal) * 100}%` }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 + i * 0.05 }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[12px] text-mut">
            <span>Media <span className="font-mono text-ink">{fmtEUR(stats.avgMonth)}</span></span>
            <span>Tope en <span className="text-ink font-medium">{stats.peak.label}</span> · <span className="font-mono text-ink">{fmtEUR(stats.peak.total)}</span></span>
          </div>
        </motion.section>
      </div>

      {/* aviso de garantías */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        {stats.warrantySoon > 0 ? (
          <Link to="/garantias" className="group flex items-center gap-3 rounded-xl border border-warn/30 bg-warn/8 hover:bg-warn/14 px-4 py-3 transition-colors">
            <span className="w-9 h-9 rounded-lg bg-warn/15 text-warn flex items-center justify-center shrink-0"><AlertTriangle size={17} /></span>
            <span className="flex-1 min-w-0">
              <span className="block font-display font-semibold text-[13.5px] text-warn">{stats.warrantySoon} garantía{stats.warrantySoon > 1 ? "s" : ""} a punto de caducar</span>
              <span className="block text-[12px] text-mut">Revisa esos productos antes de 60 días para no perder la cobertura.</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-warn shrink-0">Revisar <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" /></span>
          </Link>
        ) : (
          <Link to="/garantias" className="group flex items-center gap-3 rounded-xl border border-ok/25 bg-ok/6 hover:bg-ok/12 px-4 py-3 transition-colors">
            <span className="w-9 h-9 rounded-lg bg-ok/12 text-ok flex items-center justify-center shrink-0"><ShieldCheck size={17} /></span>
            <span className="flex-1 min-w-0">
              <span className="block font-display font-semibold text-[13.5px] text-ok">Garantías bajo control</span>
              <span className="block text-[12px] text-mut">Ningún producto caduca en los próximos 60 días.</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ok shrink-0">Ver <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" /></span>
          </Link>
        )}
      </motion.div>
    </div>
  );
}
