import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, Clock, AlertTriangle, Package, ScanLine } from "lucide-react";
import { addMonths, differenceInDays, parseISO, format } from "date-fns";
import { es } from "date-fns/locale";
import { useApp } from "../lib/store";
import { fmtEUR, cls } from "../lib/util";
import { Button, EmptyState, Chip } from "../components/ui";

interface Warranty {
  key: string;
  product: string;
  store: string;
  ticketId: string;
  price: number;
  qty: number;
  purchase: string;
  months: number;
  end: Date;
  daysLeft: number;
}

type Tab = "todas" | "prontas" | "vencidas";

export default function Warranties() {
  const { tickets } = useApp();
  const [tab, setTab] = useState<Tab>("todas");

  const warranties = useMemo<Warranty[]>(() => {
    const out: Warranty[] = [];
    for (const t of tickets)
      for (const it of t.items) {
        if (!it.warrantyMonths) continue;
        const end = addMonths(parseISO(t.date), it.warrantyMonths);
        out.push({
          key: t.id + it.id,
          product: it.name,
          store: t.store,
          ticketId: t.id,
          price: it.price * it.qty,
          qty: it.qty,
          purchase: t.date,
          months: it.warrantyMonths,
          end,
          daysLeft: differenceInDays(end, new Date()),
        });
      }
    return out.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [tickets]);

  const prontas = warranties.filter((w) => w.daysLeft >= 0 && w.daysLeft < 60);
  const vencidas = warranties.filter((w) => w.daysLeft < 0);
  const visibles = tab === "todas" ? warranties : tab === "prontas" ? prontas : vencidas;

  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: "todas", label: "Todas", n: warranties.length },
    { id: "prontas", label: "Caducan pronto", n: prontas.length },
    { id: "vencidas", label: "Vencidas", n: vencidas.length },
  ];

  if (warranties.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck size={26} />}
        title="Sin garantías registradas"
        desc="Al escanear o editar un ticket, indica los meses de garantía de cada producto (por ejemplo 24 o 36) y TicketBox te avisará antes de que caduquen."
        action={<Link to="/scan"><Button size="lg"><ScanLine size={17} /> Escanear ticket</Button></Link>}
      />
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cls(
              "px-3.5 h-9 rounded-lg text-[13px] font-medium transition-colors cursor-pointer inline-flex items-center gap-2 border",
              tab === t.id ? "bg-acc text-accink border-transparent" : "bg-card border-line text-mut hover:text-ink"
            )}
          >
            {t.label}
            <span className={cls("font-mono text-[11px] px-1.5 rounded", tab === t.id ? "bg-white/20" : "bg-card2")}>{t.n}</span>
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="text-center text-mut text-sm py-14 border border-dashed border-line2 rounded-xl">
          {tab === "prontas" ? "Nada caduca en los próximos 60 días." : tab === "vencidas" ? "Ninguna garantía vencida." : "Sin garantías."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visibles.map((w, i) => {
            const totalDays = differenceInDays(w.end, parseISO(w.purchase));
            const elapsed = Math.min(100, Math.max(0, ((totalDays - w.daysLeft) / totalDays) * 100));
            const state = w.daysLeft < 0 ? "vencida" : w.daysLeft < 60 ? "pronta" : "ok";
            return (
              <motion.li
                key={w.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.35) }}
                className="bg-card border border-line rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <span className={cls(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    state === "vencida" ? "bg-danger/12 text-danger" : state === "pronta" ? "bg-warn/14 text-warn" : "bg-ok/12 text-ok"
                  )}>
                    {state === "vencida" ? <AlertTriangle size={17} /> : state === "pronta" ? <Clock size={17} /> : <Package size={17} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-display font-semibold text-[14.5px] truncate">{w.product}</p>
                      <Chip color={state === "vencida" ? "var(--danger)" : state === "pronta" ? "var(--warn)" : "var(--ok)"}>
                        {state === "vencida"
                          ? `Vencida hace ${Math.abs(w.daysLeft)} d`
                          : state === "pronta"
                            ? `Caduca en ${w.daysLeft} d`
                            : `Vigente · ${w.daysLeft} d`}
                      </Chip>
                    </div>
                    <p className="text-[12.5px] text-mut mt-1">
                      {w.store} · comprado el {format(parseISO(w.purchase), "d MMM yyyy", { locale: es })} · {w.months} meses de garantía · {fmtEUR(w.price)}
                    </p>
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-card2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${elapsed}%` }}
                          transition={{ duration: 0.7, ease: "easeOut" }}
                          className={cls("h-full rounded-full", state === "vencida" ? "bg-danger" : state === "pronta" ? "bg-warn" : "bg-ok")}
                        />
                      </div>
                      <span className="text-[11.5px] font-mono text-mut shrink-0">hasta el {format(w.end, "d MMM yyyy", { locale: es })}</span>
                    </div>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
