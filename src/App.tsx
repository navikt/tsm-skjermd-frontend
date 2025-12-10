import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./layout";
import { SakerList } from "./pages/SakerList";
import { SakDetail } from "./pages/SakDetail";
import { NySak } from "./pages/NySak";

export default function App() {
  return (
    <BrowserRouter basename="/">
      <AppLayout title="Skjermd">
        <Routes>
          <Route path="/" element={<SakerList />} />
          <Route path="/saker/ny" element={<NySak />} />
          <Route path="/saker/:id" element={<SakDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
