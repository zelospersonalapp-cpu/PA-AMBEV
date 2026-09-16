import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
import { AgendamentoModal } from './AgendamentoModal';

interface LayoutProps {
  children?: React.ReactNode;
  onOpenNovoAgendamento?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onOpenNovoAgendamento }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [novoModalOpen, setNovoModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Agenda (Calendário)', href: '/agenda', icon: Calendar },
    { name: 'PTAs (Plataformas)', href: '/ptas', icon: Truck },
    { name: 'Avarias & Manutenção', href: '/avarias', icon: AlertOctagon },
    { name: 'Recorrências', href: '/recorrencias', icon: Repeat },
    { name: 'Cadastros Auxiliares', href: '/cadastros', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-[#1A1A1A] flex flex-col font-sans antialiased">
      {/* Main Header / Top Bar: fundo #1B2A4A, texto branco */}
      <header className="bg-[#1B2A4A] border-b border-[#152238] sticky top-0 z-30 shadow-sm text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and App Title */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="lg:hidden p-2 rounded-md text-[#CBD5E1] hover:text-white hover:bg-[#1E3461]"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Abrir menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              <div className="flex items-center gap-2.5">
                {/* Logo com fundo #243656 */}
                <div className="w-9 h-9 rounded-md bg-[#243656] flex items-center justify-center font-extrabold text-white text-sm tracking-tight shadow-xs border border-white/10">
                  PTA
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-white leading-tight flex items-center gap-2">
                    AmBev — Gestão de PTAs
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#243656] text-[#93C5FD]">
                      PPM Facilities
                    </span>
                  </h1>
                  <p className="text-xs text-[#CBD5E1] font-medium">Centro de Inteligência Facilities</p>
                </div>
              </div>
            </div>

            {/* Header Right Action */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  if (onOpenNovoAgendamento) {
                    onOpenNovoAgendamento();
                  } else {
                    setNovoModalOpen(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-white" />
                <span className="hidden sm:inline">Novo Agendamento</span>
                <span className="sm:hidden">Agendar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Desktop Sidebar: fundo #1B2A4A */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="bg-[#1B2A4A] rounded-xl border border-[#152238] shadow-md p-3 sticky top-24 text-white">
            {/* Cabeçalho do sidebar: #152238 */}
            <div className="bg-[#152238] px-3.5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider text-[#93C5FD] flex items-center justify-between">
              <span>Navegação do Sistema</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA]" />
            </div>
            <nav className="space-y-1.5 mt-2">
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
                    className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-[3px] ${
                      isActive
                        ? 'bg-[#243656] text-white font-bold border-l-[#60A5FA] shadow-xs'
                        : 'border-l-transparent text-[#CBD5E1] hover:bg-[#1E3461] hover:text-[#E2E8F0]'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive
                          ? 'text-white'
                          : 'text-[#94A3B8] group-hover:text-[#E2E8F0]'
                      }`}
                    />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-6 pt-4 border-t border-[#152238] px-3">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Building2 className="w-4 h-4 text-[#94A3B8]" />
                <span>Cervejaria AmBev</span>
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-1 leading-relaxed">
                PPM Facilities • Controle Inteligente de Plataformas Elevatórias.
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer: fundo #1B2A4A */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#1B2A4A] shadow-2xl text-white border-r border-[#152238] animate-drawer-in">
              {/* Cabeçalho do sidebar mobile: #152238 */}
              <div className="p-4 border-b border-[#152238] flex items-center justify-between bg-[#152238]">
                <div className="font-bold text-sm text-white flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#243656] flex items-center justify-center font-bold text-white text-xs border border-white/10">
                    PTA
                  </div>
                  <span>Menu Principal</span>
                </div>
                <button
                  type="button"
                  className="p-1 rounded-md text-[#94A3B8] hover:text-white"
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
                      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-[3px] ${
                        isActive
                          ? 'bg-[#243656] text-white font-bold border-l-[#60A5FA]'
                          : 'border-l-transparent text-[#CBD5E1] hover:bg-[#1E3461] hover:text-[#E2E8F0]'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 transition-colors ${
                          isActive
                            ? 'text-white'
                            : 'text-[#94A3B8] group-hover:text-[#E2E8F0]'
                        }`}
                      />
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
          {children || <Outlet />}
        </main>
      </div>

      {/* Modal de Novo Agendamento disparado pelo Header */}
      {novoModalOpen && (
        <AgendamentoModal
          isOpen={novoModalOpen}
          onClose={() => setNovoModalOpen(false)}
          onSuccess={() => {
            setNovoModalOpen(false);
            window.dispatchEvent(new CustomEvent('agendamento-updated'));
            if (location.pathname !== '/agenda') {
              navigate('/agenda');
            }
          }}
        />
      )}

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
