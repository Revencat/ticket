import React, { Component, Suspense, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./lib/store";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Tickets from "./pages/Tickets";
import Warranties from "./pages/Warranties";
import Settings from "./pages/Settings";
import Cuenta from "./pages/Cuenta";

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

// Las páginas con dependencias pesadas (Tesseract, ExcelJS) se cargan bajo demanda.
// Cuenta es pequeña y crítica: va en el bundle principal para no fallar jamás.
const Scan = lazyRetry(() => import("./pages/Scan"));
const Export = lazyRetry(() => import("./pages/Export"));

class PageBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-6">
          <p className="font-display font-semibold text-lg">Esta página no pudo cargar</p>
          <p className="text-mut text-sm max-w-sm">
            Suele pasar tras dejar la pestaña en reposo un rato o cuando la app se actualiza en segundo plano. Tus datos siguen guardados.
          </p>
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

export default function App() {
  // Precarga todos los chunks perezosos poco después de arrancar:
  // así, navegar entre páginas nunca se queda esperando (ni en blanco).
  useEffect(() => {
    sessionStorage.removeItem("tb-chunk-reload");
    const t = window.setTimeout(() => {
      import("./pages/Scan").catch(() => {});
      import("./pages/Export").catch(() => {});
    }, 700);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <AppProvider>
      <HashRouter>
        <Layout>
          <PageBoundary>
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
        </Layout>
      </HashRouter>
    </AppProvider>
  );
}
