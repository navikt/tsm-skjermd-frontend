import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { SakDetailIframe } from "./pages/SakDetailIframe";
import "./index.css";

function AppIframe() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/saker/:id" element={<SakDetailIframe />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppIframe />
  </React.StrictMode>
);
