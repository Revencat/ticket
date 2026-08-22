import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { ScanLine, Wallet, Receipt as ReceiptIcon, Percent, ShieldCheck, ArrowRight, ChevronRight, AlertTriangle } from "lucide-react";
import { useApp } from "../lib/store";
import { fmtEUR, fmtDate, fmtMonth, cls } from "../lib/util";
import { CatIcon, EmptyState, Button, Dot } from "../components/ui";

export default function Dashboard() {
  const { tickets, categories, accent } = useApp();

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = format(now, "yyyy-MM");
    const lastMonth = format(subMonths(now, 1), "yyyy-MM");
    const inMonth = (k: string) => tickets.filter((t) => t.date.startsWith(k));
    const cur = inMonth(thisMonth);
    const prev = inMonth(lastMonth);
    const sum = (xs: typeof tickets) => xs.reduce((a, t) => a + t.total, 0);
    const curSum = sum(cur);
    const prevSum = sum(prev);

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      const key = format(d, "yyyy-MM");
      return {
        label: format(d, "MMM", { locale: es }),
        total: Math.round(sum(inMonth(key)) * 100) / 100,
      };
    });

    const byCat = categories
      .map((c) => ({ ...c, total: sum(cur.filter((t) => t.category === c.id)) }))
      .filter((c) => c.total > 0);

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

    return {
      monthLabel: format(now, "LLLL", { locale: es }),
      curSum,
      curCount: cur.length,
      avg: cur.length ? curSum / cur.length : 0,
      delta: prevSum > 0 ? ((curSum - prevSum) / prevSum) * 100 : null,
      months,
      byCat,
      active,
      soon,
      recent: [...tickets].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
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

  const tiles = [
    { label: `Gasto en ${stats.monthLabel}`, value: fmtEUR(stats.curSum), icon: Wallet, extra: stats.delta !== null ? (
        <span className={cls("text-[12px] font-mono font-semibold", stats.delta > 0 ? "text-danger" : "text-ok")}>
          {stats.delta > 0 ? "▲" : "▼"} {Math.abs(stats.delta).toFixed(0)}% vs mes anterior
        </span>
      ) : <span className="text-[12px] text-mut">sin datos del mes anterior</span> },
    { label: "Tickets este mes", value: String(stats.curCount), icon: ReceiptIcon, extra: <span className="text-[12px] text-mut">{tickets.length} en total</span> },
    { label: "Ticket medio", value: fmtEUR(stats.avg), icon: Percent, extra: <span className="text-[12px] text-mut">en el mes en curso</span> },
    { label: "Garantías activas", value: String(stats.active), icon: ShieldCheck, extra: stats.soon > 0 ? (
        <span className="text-[12px] font-mono font-semibold text-warn">{stats.soon} caducan pronto</span>
      ) : <span className="text-[12px] text-mut">todo en vigor</span> },
  ];

  return (
    <div className="space-y-6">
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
            <p className="font-mono font-semibold text-[22px] mt-2 tracking-tight">{t.value}</p>
            <div className="mt-1">{t.extra}</div>
          </motion.div>
        ))}
      </div>

      {/* gráficos */}
      <div className="grid lg:grid-cols-5 gap-3">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="lg:col-span-3 bg-card border border-line rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display font-bold text-[15px]">Últimos 6 meses</h2>
            <span className="text-[12px] text-mut font-mono">total por mes</span>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer>
              <BarChart data={stats.months} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(v: number) => `${v}€`} />
                <Tooltip
                  cursor={{ fill: "var(--accent-soft)" }}
                  formatter={(v: number | string) => [fmtEUR(Number(v)), "Gasto"]}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13 }}
                  labelStyle={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={46}>
                  {stats.months.map((m, i) => (
                    <Cell key={i} fill={i === stats.months.length - 1 ? accent : accent + "55"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="lg:col-span-2 bg-card border border-line rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-display font-bold text-[15px]">Por categoría</h2>
            <span className="text-[12px] text-mut font-mono">{stats.monthLabel}</span>
          </div>
          {stats.byCat.length === 0 ? (
            <p className="text-mut text-sm py-14 text-center">Sin gasto registrado este mes.</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-[190px] w-[150px] shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={stats.byCat} dataKey="total" nameKey="name" innerRadius={46} outerRadius={72} paddingAngle={3} strokeWidth={0}>
                      {stats.byCat.map((c) => (
                        <Cell key={c.id} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number | string) => fmtEUR(Number(v))} contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 space-y-2.5 min-w-0">
                {stats.byCat.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-[13px]">
                    <Dot color={c.color} />
                    <span className="text-mut truncate">{c.name}</span>
                    <span className="ml-auto font-mono font-semibold">{fmtEUR(c.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.section>
      </div>

      {/* recientes + aviso garantías */}
      <div className="grid lg:grid-cols-5 gap-3">
        <section className="lg:col-span-3 bg-card border border-line rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <h2 className="font-display font-bold text-[15px]">Últimos tickets</h2>
            <Link to="/tickets" className="text-[12.5px] text-acc font-medium inline-flex items-center gap-1 hover:underline">
              Ver todos <ArrowRight size={13} />
            </Link>
          </div>
          <ul className="px-5 pb-4 space-y-2">
            {stats.recent.map((t) => {
              const cat = catById.get(t.category);
              return (
                <li key={t.id}>
                  <Link
                    to="/tickets"
                    className="stub flex items-center gap-3 px-3 py-2.5 rounded-lg border border-line bg-card2/50 hover:border-line2 hover:bg-card2 transition-all group"
                  >
                    <span className="notch notch-t hidden sm:block" style={{ left: 55 }} />
                    <span className="notch notch-b hidden sm:block" style={{ left: 55 }} />
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: (cat?.color || "#64748b") + "1c", color: cat?.color || "#64748b" }}>
                      <CatIcon id={t.category} size={16} />
                    </span>
                    <div className="min-w-0 border-l border-dashed border-line2 pl-3">
                      <p className="text-[13.5px] font-semibold truncate">{t.store}</p>
                      <p className="text-[11.5px] text-mut">{fmtDate(t.date)} · {t.items.length} art.</p>
                    </div>
                    <span className="ml-auto font-mono font-semibold text-[14px]">{fmtEUR(t.total)}</span>
                    <ChevronRight size={15} className="text-mut group-hover:text-acc transition-colors shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="lg:col-span-2 space-y-3">
          <div className="bg-card border border-line rounded-xl p-5">
            <h2 className="font-display font-bold text-[15px] mb-3">Mes a mes</h2>
            <ul className="space-y-2">
              {stats.months.slice().reverse().slice(0, 4).map((m) => {
                const max = Math.max(...stats.months.map((x) => x.total), 1);
                return (
                  <li key={m.label} className="text-[13px]">
                    <div className="flex justify-between mb-1">
                      <span className="capitalize text-mut">{m.label}</span>
                      <span className="font-mono font-semibold">{fmtEUR(m.total)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-card2 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-acc"
                        initial={{ width: 0 }}
                        animate={{ width: `${(m.total / max) * 100}%` }}
                        transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {stats.soon > 0 ? (
            <Link to="/garantias" className="block bg-warn/10 border border-warn/30 rounded-xl p-4 hover:bg-warn/15 transition-colors">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-warn shrink-0 mt-0.5" />
                <div>
                  <p className="font-display font-semibold text-[14px] text-warn">{stats.soon} garantía{stats.soon > 1 ? "s" : ""} a punto de caducar</p>
                  <p className="text-[12.5px] text-mut mt-0.5">Revisa tus productos antes de 60 días.</p>
                </div>
              </div>
            </Link>
          ) : (
            <div className="bg-ok/8 border border-ok/25 rounded-xl p-4 flex items-start gap-3">
              <ShieldCheck size={18} className="text-ok shrink-0 mt-0.5" />
              <div>
                <p className="font-display font-semibold text-[14px] text-ok">Garantías bajo control</p>
                <p className="text-[12.5px] text-mut mt-0.5">Ningún producto caduca en los próximos 60 días.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
