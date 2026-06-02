import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AppLayout } from "./layout";
import { SakerList } from "./pages/SakerList";
import { SakDetail } from "./pages/SakDetail";
import { NySak } from "./pages/NySak";
import { RegistrerSak } from "./pages/RegistrerSak";
import { SensureringIframe } from "./pages/SensureringIframe";
import { SakIframe } from "./pages/SakIframe";
import { AuthCallback } from "./pages/AuthCallback";
import { AuthWindow } from "./pages/AuthWindow";

const WithLayout = () => (
  <AppLayout>
    <Outlet />
  </AppLayout>
);

export default function App() {
  return (
    <BrowserRouter basename="/">
      <Routes>
        <Route path="/embed/sensurering/:sakId" element={<SakIframe />} />
        <Route path="/embed/sensurering-editor/:sakId" element={<SensureringIframe />} />
        <Route path="/embed/auth-callback" element={<AuthCallback />} />
        <Route path="/embed/auth-window" element={<AuthWindow />} />
        <Route element={<WithLayout />}>
          <Route path="/" element={<SakerList />} />
          <Route path="/saker/ny" element={<NySak />} />
          <Route path="/registrer/:id" element={<RegistrerSak />} />
          <Route path="/saker/:id" element={<SakDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
