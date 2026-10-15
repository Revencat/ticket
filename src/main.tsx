import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./themes/minimal.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    // Si una versión nueva del service worker toma el control (p. ej. tras
    // publicar una actualización), recargamos una sola vez para no quedarnos
    // sirviendo la versión anterior con assets que ya no existen.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController && !sessionStorage.getItem("tb-sw-reload")) {
        sessionStorage.setItem("tb-sw-reload", "1");
        window.location.reload();
      }
    });
    // limpieza del marcador una vez la página ha cargado con normalidad
    window.setTimeout(() => sessionStorage.removeItem("tb-sw-reload"), 3000);
  });
}
