import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Truck,
  AlertOctagon,
  Repeat,
  Award,
  Database,
  Menu,
  X,
  PlusCircle,
  Building2,
  CheckCircle2,
} from 'lucide-react';

interface LayoutProps {
  onOpenNovoAgendamento?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ onOpenNovoAgendamento }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Agenda (Calendário)', href: '/agenda', icon: Calendar },
    { name: 'PTAs (Plataformas)', href: '/ptas', icon: Truck },
    { name: 'Avarias & Manutenção', href: '/avarias', icon: AlertOctagon },
    { name: 'Recorrências', href: '/recorrencias', icon: Repeat },
    { name: 'Confiabilidade SLA', href: '/confiabilidade', icon: Award },
    { name: 'Cadastros Auxiliares', href: '/cadastros', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F8] text-[#1A1A1A] flex flex-col font-sans antialiased">
      {/* Top AmBev Yellow Bar Accent */}
      <div className="h-1.5 bg-[#F5D800] w-full" />

      {/* Main Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and App Title */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Abrir menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-md bg-[#F5D800] flex items-center justify-center font-bold text-black text-sm tracking-tight shadow-xs border border-amber-300">
                  PTA
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-[#1A1A1A] leading-tight flex items-center gap-2">
                    AmBev — Gestão de PTAs
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                      PPM Facilities
                    </span>
                  </h1>
                  <p className="text-xs text-gray-500 font-medium">Centro de Inteligência Facilities</p>
                </div>
              </div>
            </div>

            {/* Header Right Action & Status */}
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Supabase Conectado</span>
              </div>

              <NavLink
                to="/agenda?novo=true"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#F5D800] hover:bg-[#e4c900] text-black font-semibold text-xs sm:text-sm shadow-xs transition-colors border border-amber-400"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Novo Agendamento</span>
              </NavLink>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-3 sticky top-24">
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Navegação do Sistema
            </div>
            <nav className="space-y-1 mt-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.href);

                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#F5D800] text-black font-semibold shadow-xs'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-black'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-black' : 'text-gray-500'}`} />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-6 pt-4 border-t border-gray-100 px-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                <Building2 className="w-4 h-4 text-[#e4c900]" />
                <span>Cervejaria AmBev</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                Controle de Plataformas Elevatórias (Articuladas e Tesourinhas) sem conflitos.
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-xl">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <div className="font-bold text-sm text-[#1A1A1A]">Menu Principal</div>
                <button
                  type="button"
                  className="p-1 rounded-md text-gray-500 hover:text-gray-900"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-1.5 overflow-y-auto">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.href);

                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                        isActive
                          ? 'bg-[#F5D800] text-black font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AmBev Facilities © Gestão Integrada de Plataformas Elevatórias (PTAs)</span>
          <span className="font-mono text-[11px] text-gray-400">Versão 1.0.0 • Supabase Direct</span>
        </div>
      </footer>
    </div>
  );
};
