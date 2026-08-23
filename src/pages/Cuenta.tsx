import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, Loader2, LogOut, RefreshCw, ShieldCheck, Smartphone, Monitor, CheckCircle2, AlertTriangle, UserRound, Lock, History } from "lucide-react";
import { useApp } from "../lib/store";
import { cls, timeAgo } from "../lib/util";
import { Button, Field, inputCls, Modal, Chip } from "../components/ui";

export default function Cuenta() {
  const { account, syncStatus, peers, lastSync, syncLog, signIn, signOut, syncNow, toast, tickets } = useApp();
  const [mode, setMode] = useState<"crear" | "entrar">("crear");
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  const submit = async () => {
    setErr("");
    const n = name.trim();
    if (n.length < 2) return setErr("El nombre de cuenta necesita al menos 2 caracteres.");
    if (pass.length < 4) return setErr("La contraseña necesita al menos 4 caracteres.");
    if (mode === "crear" && pass !== pass2) return setErr("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      await signIn(n, pass);
      toast("ok", mode === "crear" ? `Cuenta «${n}» creada. Usa estas mismas credenciales en tu otro dispositivo.` : `Sesión iniciada como «${n}».`);
    } catch {
      setErr("No se pudo crear la sesión en este navegador (necesita un contexto seguro: https o localhost).");
    } finally {
      setBusy(false);
    }
  };

  /* ── Sin sesión: alta / entrada ─────────────────────────────────────────── */
  if (!account) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-line rounded-xl p-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="w-11 h-11 rounded-xl bg-acc/10 text-acc flex items-center justify-center"><Cloud size={21} /></span>
            <div>
              <h2 className="font-display font-bold text-lg leading-tight">Tu cuenta, abierta en PC y móvil</h2>
              <p className="text-mut text-[13px] mt-0.5">Entra una vez y la sesión queda guardada.</p>
            </div>
          </div>
          <p className="text-sm text-mut leading-relaxed mt-3">
            Con la misma cuenta en dos dispositivos, los tickets se <strong className="text-ink">sincronizan solos y en tiempo real</strong>, cifrados de extremo a extremo.
            No hace falta volver a vincular nada cada vez.
          </p>

          <div className="flex gap-1 mt-5 p-1 bg-card2 rounded-lg w-fit">
            {(["crear", "entrar"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErr(""); }}
                className={cls(
                  "relative h-8 px-4 rounded-md text-[13px] font-medium transition-colors cursor-pointer",
                  mode === m ? "text-ink" : "text-mut hover:text-ink"
                )}
              >
                {mode === m && <motion.span layoutId="mode-pill" className="absolute inset-0 bg-card rounded-md border border-line" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                <span className="relative">{m === "crear" ? "Crear cuenta" : "Ya tengo cuenta"}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Nombre de la cuenta" hint="El mismo en todos tus dispositivos, por ejemplo «casa» o «laura».">
              <div className="relative">
                <UserRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut" />
                <input className={cls(inputCls, "pl-9")} value={name} onChange={(e) => setName(e.target.value)} placeholder="casa" autoComplete="username" />
              </div>
            </Field>
            <Field label="Contraseña" hint={mode === "crear" ? "Mínimo 4 caracteres. No se guarda: solo deriva la clave de cifrado." : "La misma que usaste al crear la cuenta."}>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut" />
                <input type="password" className={cls(inputCls, "pl-9")} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" autoComplete={mode === "crear" ? "new-password" : "current-password"} onKeyDown={(e) => e.key === "Enter" && submit()} />
              </div>
            </Field>
            {mode === "crear" && (
              <Field label="Repite la contraseña">
                <input type="password" className={inputCls} value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="••••••••" autoComplete="new-password" onKeyDown={(e) => e.key === "Enter" && submit()} />
              </Field>
            )}

            <AnimatePresence>
              {err && (
                <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-[13px] text-danger bg-danger/8 border border-danger/25 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} /> {err}
                </motion.p>
              )}
            </AnimatePresence>

            <Button size="lg" className="w-full" onClick={submit} disabled={busy}>
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Cloud size={17} />}
              {mode === "crear" ? "Crear cuenta y entrar" : "Iniciar sesión"}
            </Button>
          </div>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-3 text-[12.5px]">
          <div className="bg-card border border-line rounded-xl p-4">
            <Smartphone size={16} className="text-acc mb-2" />
            <p className="font-medium text-[13px]">En el móvil</p>
            <p className="text-mut mt-1 leading-relaxed">Instala TicketBox, entra con las mismas credenciales y fotografía tickets: aparecerán en el PC al instante.</p>
          </div>
          <div className="bg-card border border-line rounded-xl p-4">
            <ShieldCheck size={16} className="text-acc mb-2" />
            <p className="font-medium text-[13px]">Privacidad</p>
            <p className="text-mut mt-1 leading-relaxed">Todo viaja cifrado (AES-256-GCM) con una clave derivada de tu contraseña. El relé solo reenvía datos ilegibles.</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Con sesión ─────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-line rounded-xl p-6">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-acc/10 text-acc flex items-center justify-center text-[17px] font-display font-bold uppercase">
            {account.name.slice(0, 2)}
          </span>
          <div className="min-w-0">
            <h2 className="font-display font-bold text-lg leading-tight truncate">{account.name}</h2>
            <p className="text-mut text-[12.5px]">{account.deviceName} · sesión permanente en este dispositivo</p>
          </div>
          <div className="ml-auto">
            <Chip color={syncStatus === "online" ? "var(--ok)" : "var(--warn)"}>
              {syncStatus === "online" ? "conectado" : "conectando…"}
            </Chip>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 text-[13px]">
          <div className="border border-line rounded-lg px-3.5 py-3 bg-card2/50">
            <p className="text-mut text-[12px]">Dispositivos en línea</p>
            <p className="font-mono font-semibold text-[17px] mt-0.5">{peers.length + 1}</p>
            {peers.length > 0 && <p className="text-[11.5px] text-mut mt-0.5 truncate">{peers.join(", ")}</p>}
          </div>
          <div className="border border-line rounded-lg px-3.5 py-3 bg-card2/50">
            <p className="text-mut text-[12px]">Última sincronización</p>
            <p className="font-mono font-semibold text-[17px] mt-0.5">{lastSync ? timeAgo(lastSync) : "—"}</p>
            <p className="text-[11.5px] text-mut mt-0.5">{tickets.length} tickets en el archivo</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={syncNow}>
            <RefreshCw size={15} /> Sincronizar ahora
          </Button>
          <Button variant="danger" onClick={() => setConfirmOut(true)}>
            <LogOut size={15} /> Cerrar sesión
          </Button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card border border-line rounded-xl p-5">
        <h3 className="font-display font-semibold text-[14.5px] flex items-center gap-2 mb-3">
          <History size={15} className="text-acc" /> Actividad reciente
        </h3>
        {syncLog.length === 0 ? (
          <p className="text-mut text-sm">
            {peers.length === 0
              ? "Abre TicketBox en tu otro dispositivo con esta misma cuenta y verás aquí la actividad de sincronización."
              : "Sin eventos todavía: los cambios se sincronizan al momento."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {syncLog.map((l, i) => (
              <li key={i} className="flex items-center gap-2 text-[13px] text-mut">
                <CheckCircle2 size={13} className="text-ok shrink-0" /> {l}
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      <p className="text-[12.5px] text-mut leading-relaxed px-1">
        La sesión se mantiene abierta aunque cierres el navegador. Si cambias de dispositivo, basta con iniciar sesión con el mismo nombre y contraseña.
      </p>

      <Modal open={confirmOut} onClose={() => setConfirmOut(false)}>
        <div className="p-6">
          <h3 className="font-display font-bold text-lg">¿Cerrar sesión de «{account.name}»?</h3>
          <p className="text-mut text-sm mt-2 leading-relaxed">
            Este dispositivo dejará de sincronizar. <strong className="text-ink">Tus tickets no se borran</strong>: quedan guardados aquí y puedes volver a entrar cuando quieras.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setConfirmOut(false)}>Cancelar</Button>
            <Button variant="danger" onClick={() => { signOut(); setConfirmOut(false); toast("info", "Sesión cerrada. Los tickets siguen en este dispositivo."); }}>
              <LogOut size={15} /> Cerrar sesión
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
