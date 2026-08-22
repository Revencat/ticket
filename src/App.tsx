import React, { Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./lib/store";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Tickets from "./pages/Tickets";
import Warranties from "./pages/Warranties";
import Settings from "./pages/Settings";

// Las páginas con dependencias pesadas (Tesseract, ExcelJS, MQTT) se cargan bajo demanda
const Scan = React.lazy(() => import("./pages/Scan"));
const Export = React.lazy(() => import("./pages/Export"));
const LinkPage = React.lazy(() => import("./pages/LinkPage"));

const PageFallback = (
  <div className="flex items-center justify-center py-24">
    <div className="w-8 h-8 rounded-lg bg-acc/20 pulse-soft" />
  </div>
);

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Layout>
          <Suspense fallback={PageFallback}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/garantias" element={<Warranties />} />
              <Route path="/exportar" element={<Export />} />
              <Route path="/vincular" element={<LinkPage />} />
              <Route path="/ajustes" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </HashRouter>
    </AppProvider>
  );
}
