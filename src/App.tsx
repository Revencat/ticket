import React, { Component, Suspense, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppProvider } from "./lib/store";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Tickets from "./pages/Tickets";
import Warranties from "./pages/Warranties";
import Settings from "./pages/Settings";
import Cuenta from "./pages/Cuenta";

/**
 * React.lazy con reintento: si un chunk perezoso falla al cargar
 * (pestaña dormida, actualización en segundo plano, red cortada)
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

// Las páginas con dependencias pesadas (Tesseract, ExcelJS) se cargan bajo demanda.
// Cuenta es pequeña y crítica: va en el bundle principal para no fallar jamás.
const Scan = lazyRetry(() => import("./pages/Scan"));
const Export = lazyRetry(() => import("./pages/Export"));

/** Si cualquier import() dinámico rechaza por chunk desaparecido, recargamos una vez. */
const isChunkError = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return /Failed to fetch dynamically imported module|Loading chunk|Unable to preload CSS|error loading dynamically imported module/i.test(m);
};

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
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                sessionStorage.removeItem("tb-chunk-reload");
                window.location.reload();
              }}
              className="h-10 px-4 rounded-lg bg-acc text-accink text-sm font-medium hover:brightness-110 active:scale-[0.97] transition-all cursor-pointer"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const PageFallback = (
  <div className="flex items-center justify-center py-24">
    <div className="w-8 h-8 rounded-lg bg-acc/20 pulse-soft" />
  </div>
);

/**
 * Las rutas viven aquí para que el error boundary se reinicie en cada
 * navegación (key = ruta): una página que falle no bloquea el resto de la app.
 */
function Shell() {
  const loc = useLocation();

  useEffect(() => {
    sessionStorage.removeItem("tb-chunk-reload");
    // Precarga los chunks perezosos: navegar nunca se queda esperando.
    const t = window.setTimeout(() => {
      import("./pages/Scan").catch(() => {});
      import("./pages/Export").catch(() => {});
    }, 700);

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
    <PageBoundary key={loc.pathname}>
      <Suspense fallback={PageFallback}>
        <Routes>
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
  );
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Layout>
          <Shell />
        </Layout>
      </HashRouter>
    </AppProvider>
  );
}
