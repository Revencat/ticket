import React, { Component, Suspense, useEffect, useState, useRef } from "react";
import { HashRouter, Routes, Route, Navigate, useLocation, type Location } from "react-router-dom";
import { motion } from "framer-motion";
import { AppProvider } from "./lib/store";
import Layout from "./components/Layout";

// Lazy load de todas las páginas pesadas
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Tickets = React.lazy(() => import("./pages/Tickets"));
const Scan = React.lazy(() => import("./pages/Scan"));
const Warranties = React.lazy(() => import("./pages/Warranties"));
const Export = React.lazy(() => import("./pages/Export"));
const Cuenta = React.lazy(() => import("./pages/Cuenta"));
const Settings = React.lazy(() => import("./pages/Settings"));

/**
 * React.lazy con reintento: si un chunk perezoso falla al cargar
 * (pestaña dormida mucho rato, actualización en segundo plano, red cortada)
 * recargamos la página una sola vez en lugar de dejarla en blanco.
 */
function lazyRetry<T extends React.ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return React.lazy(() =>
    factory().catch((err) => {
      if (!sessionStorage.getItem("tb-chunk-reload")) {
        sessionStorage.setItem("tb-chunk-reload", "1");
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw err;
    })
  );
}

const isChunkError = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return /Failed to fetch dynamically imported module|Loading chunk|Unable to preload CSS|error loading dynamically imported module/i.test(m);
};

/* ── Límite de errores de página ─────────────────────────────────────────── */
class PageBoundary extends Component<{ children: React.ReactNode }, { failed: boolean; detail: string }> {
  state = { failed: false, detail: "" };
  static getDerivedStateFromError(err: unknown) {
    return { failed: true, detail: err instanceof Error ? err.message : String(err) };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6 max-w-lg mx-auto">
          <div className="w-11 h-11 rounded-xl bg-warn/12 text-warn flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
          </div>
          <p className="font-display font-semibold text-lg">Esta página no pudo cargar</p>
          <p className="text-mut text-sm leading-relaxed">
            Suele pasar tras dejar la pestaña en reposo o cuando la app se actualiza en segundo plano. Tus datos siguen guardados.
          </p>
          {this.state.detail && (
            <p className="font-mono text-[11px] text-mut bg-card2 border border-line rounded-lg px-3 py-2 max-w-full break-words">
              {this.state.detail.slice(0, 220)}
            </p>
          )}
          <button
            onClick={() => {
              sessionStorage.removeItem("tb-chunk-reload");
              window.location.reload();
            }}
            className="mt-2 h-10 px-4 rounded-lg bg-acc text-accink text-sm font-medium hover:brightness-110 active:scale-[0.97] transition-all cursor-pointer"
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Límite de errores global ────────────────────────────────────────────── */
class RootBoundary extends Component<{ children: React.ReactNode }, { failed: boolean; detail: string }> {
  state = { failed: false, detail: "" };
  static getDerivedStateFromError(err: unknown) {
    return { failed: true, detail: err instanceof Error ? err.message : String(err) };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ background: "var(--bg)", color: "var(--ink)" }}>
          <p className="font-semibold text-lg">TicketBox ha encontrado un problema</p>
          <p className="text-sm opacity-70 max-w-sm">Tus tickets siguen guardados en este dispositivo. Recarga para continuar.</p>
          {this.state.detail && <p className="font-mono text-[11px] opacity-60 bg-black/5 rounded-lg px-3 py-2 max-w-md break-words">{this.state.detail.slice(0, 260)}</p>}
          <button
            onClick={() => window.location.reload()}
            className="mt-2 h-10 px-5 rounded-lg text-sm font-medium text-white"
            style={{ background: "var(--accent)" }}
          >
            Recargar la aplicación
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Skeleton loader optimizado ──────────────────────────────────────────── */
const PageFallback = (
  <div className="flex items-center justify-center py-24">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-acc/20 animate-pulse" />
      <div className="w-32 h-3 rounded bg-acc/10 animate-pulse" />
    </div>
  </div>
);

/**
 * Shell de rutas con transición de página determinista.
 */
function Shell() {
  const loc = useLocation();
  const [displayLoc, setDisplayLoc] = useState<Location>(loc);
  const [stage, setStage] = useState<"in" | "out">("in");
  const locRef = useRef(loc);
  locRef.current = loc;

  useEffect(() => {
    if (stage === "in" && loc.pathname !== displayLoc.pathname) setStage("out");
  }, [stage, loc.pathname, displayLoc.pathname]);

  useEffect(() => {
    sessionStorage.removeItem("tb-chunk-reload");
    // Precarga los chunks perezosos: navegar nunca se queda esperando.
    const t = window.setTimeout(() => {
      import("./pages/Scan").catch(() => {});
      import("./pages/Export").catch(() => {});
      import("./pages/Warranties").catch(() => {});
      import("./pages/Cuenta").catch(() => {});
      import("./pages/Settings").catch(() => {});
    }, 500);

    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkError(e.reason) && !sessionStorage.getItem("tb-chunk-reload")) {
        sessionStorage.setItem("tb-chunk-reload", "1");
        window.location.reload();
      }
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <motion.div
      key={displayLoc.pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={stage === "out" ? { opacity: 0, y: -4 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.12, ease: [0.25, 1, 0.4, 1] }}
      onAnimationComplete={() => {
        if (stage === "out") {
          setDisplayLoc(locRef.current);
          setStage("in");
        }
      }}
      className="max-w-[1140px] mx-auto px-4 sm:px-6 pt-6 pb-32"
    >
      <PageBoundary key={displayLoc.pathname}>
        <Suspense fallback={PageFallback}>
          <Routes location={displayLoc}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/garantias" element={<Warranties />} />
            <Route path="/exportar" element={<Export />} />
            <Route path="/cuenta" element={<Cuenta />} />
            <Route path="/ajustes" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </PageBoundary>
    </motion.div>
  );
}

export default function App() {
  return (
    <RootBoundary>
      <AppProvider>
        <HashRouter>
          <Layout>
            <Shell />
          </Layout>
        </HashRouter>
      </AppProvider>
    </RootBoundary>
  );
}
