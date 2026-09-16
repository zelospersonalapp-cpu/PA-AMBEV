import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Agenda } from './pages/Agenda';
import { Ptas } from './pages/Ptas';
import { Avarias } from './pages/Avarias';
import { Recorrencias } from './pages/Recorrencias';
import { Cadastros } from './pages/Cadastros';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/ptas" element={<Ptas />} />
            <Route path="/avarias" element={<Avarias />} />
            <Route path="/recorrencias" element={<Recorrencias />} />
            <Route path="/cadastros" element={<Cadastros />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
