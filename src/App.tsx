import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SecretForm } from "./pages/SecretForm";

export default function App() {

  return (
    <BrowserRouter basename="/">
      <Routes>
        <Route path="/secret-form" element={<SecretForm />} />
        <Route path="*" element={<div>404 - Ikke funnet</div>} />
      </Routes>
    </BrowserRouter>
  );
}