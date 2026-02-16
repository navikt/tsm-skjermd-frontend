import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AppLayout } from "./layout";
import { SakerList } from "./pages/SakerList";
import { SakDetail } from "./pages/SakDetail";
import { NySak } from "./pages/NySak";
import { RegistrerSak } from "./pages/RegistrerSak";
import { SensureringIframe } from "./pages/SensureringIframe";

const WithLayout = () => (
  <AppLayout>
    <Outlet />
  </AppLayout>
);

export default function App() {
  return (
    <BrowserRouter basename="/">
      <Routes>
        <Route path="/embed/sensurering/:sakId" element={<SensureringIframe />} />
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
