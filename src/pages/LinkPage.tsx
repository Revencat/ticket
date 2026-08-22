import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link2, Copy, Check, Smartphone, Monitor, Wifi, WifiOff, Send, RefreshCw, Lock, Receipt as ReceiptIcon, Inbox } from "lucide-react";
import { useApp } from "../lib/store";
import { connectLink, genCode, type LinkSession } from "../lib/link";
import { downscaleImage, fmtEUR, fmtDate, uid, cls } from "../lib/util";
import type { Ticket } from "../types";
import { Button, Chip, EmptyState } from "../components/ui";

type Status = "idle" | "connecting" | "online" | "error";

export default function LinkPage() {
  const { tickets, addTickets, toast } = useApp();
  const [code] = useState(genCode);
  const [status, setStatus] = useState<Status>("idle");
  const [detail, setDetail] = useState("");
  const [peer, setPeer] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [received, setReceived] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const sessionRef = useRef<LinkSession | null>(null);

  useEffect(() => () => sessionRef.current?.close(), []);

  const start = async () => {
    setStatus("connecting");
    setDetail("");
    try {
      const s = await connectLink(code, {
        onStatus: (st, d) => {
          setStatus(st);
          if (d) setDetail(d);
        },
        onPeer: (p) => {
          setPeer(p);
          if (p) toast("ok", "Otro dispositivo se ha unido al código.");
        },
        onTicket: (t) => {
          const withId = { ...t, id: uid(), source: "link" as const, createdAt: Date.now() };
          addTickets([withId]);
          setReceived((r) => [withId, ...r]);
          toast("ok", `Ticket de ${withId.store} recibido y archivado (${fmtEUR(withId.total)}).`);
        },
      });
      sessionRef.current = s;
    } catch {
      setStatus("error");
      setDetail("No se pudo iniciar la vinculación.");
    }
  };

  const stop = () => {
    sessionRef.current?.close();
    sessionRef.current = null;
    setStatus("idle");
    setPeer(false);
  };

  const sendSelected = async () => {
    const t = tickets.find((x) => x.id === selected);
    if (!t || !sessionRef.current) return;
    setSending(t.id);
    try {
      const photo = t.photo ? await downscaleImage(t.photo, 900, 0.72) : undefined;
      await sessionRef.current.sendTicket({ ...t, photo });
      toast("ok", `Ticket de ${t.store} enviado al otro dispositivo.`);
    } catch {
      toast("danger", "No se pudo enviar. Prueba de nuevo.");
    } finally {
      setSending(null);
    }
  };

  const recent = useMemo(() => [...tickets].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6), [tickets]);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* código */}
      <div className="bg-card border border-line rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex items-center gap-3">
            <span className={cls("w-11 h-11 rounded-xl flex items-center justify-center", status === "online" ? "bg-ok/12 text-ok" : "bg-acc/12 text-acc")}>
              {status === "online" ? <Wifi size={20} /> : status === "error" ? <WifiOff size={20} /> : <Link2 size={20} />}
            </span>
            <div>
              <h2 className="font-display font-bold text-lg leading-tight">Vincula móvil y ordenador</h2>
              <p className="text-mut text-[12.5px] mt-0.5">
                {status === "idle" && "Genera un código y ábrelo en el otro dispositivo."}
                {status === "connecting" && "Conectando con el relé…"}
                {status === "online" && (peer ? "Otro dispositivo está conectado." : "Esperando al otro dispositivo…")}
                {status === "error" && (detail || "Sin conexión.")}
              </p>
            </div>
          </div>
          <div className="sm:ml-auto flex items-center gap-2">
            {status === "idle" || status === "error" ? (
              <Button size="lg" onClick={start}><Link2 size={16} /> Crear sala</Button>
            ) : (
              <Button size="lg" variant="outline" onClick={stop}>Cerrar sala</Button>
            )}
          </div>
        </div>

        {status !== "idle" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-5 pt-5 border-t border-line">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="text-center">
                <p className="text-[11px] font-display font-semibold uppercase tracking-[0.1em] text-mut mb-2">Código de la sala</p>
                <div className="flex items-center gap-1.5">
                  {code.split("").map((c, i) => (
                    <motion.span
                      key={i}
                      initial={{ y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: i * 0.06 }}
                      className="w-12 h-14 rounded-lg border border-line2 bg-card2 font-mono font-semibold text-[26px] flex items-center justify-center"
                    >
                      {c}
                    </motion.span>
                  ))}
                </div>
              </div>
              <div className="flex-1 w-full">
                <div className="flex items-center gap-2 mb-3">
                  <Chip color={status === "online" ? "var(--ok)" : status === "error" ? "var(--danger)" : "var(--warn)"}>
                    {status === "online" ? "conectado" : status === "connecting" ? "conectando…" : "sin conexión"}
                  </Chip>
                  <Chip color={peer ? "var(--ok)" : undefined}>{peer ? "2 dispositivos" : "1 dispositivo"}</Chip>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(code).then(() => {
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1600);
                      });
                    }}
                    className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-acc font-medium hover:underline cursor-pointer"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />} Copiar código
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                  <div className="border border-line rounded-lg p-3 bg-card2/50">
                    <Smartphone size={15} className="text-acc mb-1.5" />
                    <p className="text-mut leading-relaxed"><strong className="text-ink">En el móvil:</strong> abre TicketBox, entra aquí y teclea el mismo código.</p>
                  </div>
                  <div className="border border-line rounded-lg p-3 bg-card2/50">
                    <Monitor size={15} className="text-acc mb-1.5" />
                    <p className="text-mut leading-relaxed"><strong className="text-ink">En el PC:</strong> deja esta sala abierta y elige qué tickets enviar.</p>
                  </div>
                </div>
                <p className="flex items-center gap-1.5 text-[11.5px] text-mut mt-3">
                  <Lock size={12} className="shrink-0" /> Tráfico cifrado AES-256-GCM con clave derivada del código, a través de un relé MQTT público (wss).
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* enviar */}
      {status === "online" && (
        <div className="bg-card border border-line rounded-xl p-5">
          <h3 className="font-display font-bold text-[15px] flex items-center gap-2 mb-3"><Send size={15} className="text-acc" /> Enviar tickets al otro dispositivo</h3>
          {recent.length === 0 ? (
            <p className="text-mut text-sm">No hay tickets que enviar.</p>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-2">
              {recent.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setSelected(t.id === selected ? null : t.id)}
                    disabled={sending !== null}
                    className={cls(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer disabled:opacity-50",
                      selected === t.id ? "border-acc bg-acc/10" : "border-line hover:border-line2 bg-card2/40"
                    )}
                  >
                    <ReceiptIcon size={15} className={selected === t.id ? "text-acc" : "text-mut"} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold truncate">{t.store}</span>
                      <span className="block text-[11.5px] text-mut font-mono">{fmtDate(t.date)}</span>
                    </span>
                    <span className="font-mono text-[13px] font-semibold">{fmtEUR(t.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={sendSelected} disabled={!selected || sending !== null || !peer}>
              {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
              {sending ? "Enviando…" : "Enviar seleccionado"}
            </Button>
            {!peer && <span className="text-[12.5px] text-mut">Necesitas que el otro dispositivo esté conectado.</span>}
          </div>
        </div>
      )}

      {/* recibidos */}
      <div className="bg-card border border-line rounded-xl p-5">
        <h3 className="font-display font-bold text-[15px] flex items-center gap-2 mb-3"><Inbox size={15} className="text-acc" /> Recibidos en esta sala ({received.length})</h3>
        {received.length === 0 ? (
          <p className="text-mut text-sm">Los tickets que lleguen del otro dispositivo se archivarán automáticamente y aparecerán aquí.</p>
        ) : (
          <ul className="divide-y divide-line">
            {received.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span className="w-8 h-8 rounded-lg bg-ok/12 text-ok flex items-center justify-center"><Check size={15} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold truncate">{t.store}</p>
                  <p className="text-[11.5px] text-mut font-mono">{fmtDate(t.date)} · {t.items.length} art.</p>
                </div>
                <span className="font-mono font-semibold text-[13.5px]">{fmtEUR(t.total)}</span>
                <Chip color="var(--ok)">archivado</Chip>
              </li>
            ))}
          </ul>
        )}
      </div>

      {status === "idle" && (
        <p className="text-center text-[12.5px] text-mut">
          Consejo: la vinculación funciona entre dos pestañas del mismo navegador para que la pruebes ahora mismo.
        </p>
      )}
    </div>
  );
}
