import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SakDetailIframe } from "./pages/SakDetailIframe";
import "./index.css";

function AppIframe() {
  return (
    <BrowserRouter basename="/iframe">
      <Routes>
        <Route path="/saker/:id" element={<SakDetailIframe />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppIframe />
  </React.StrictMode>
);
