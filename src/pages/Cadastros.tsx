import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Settings,
  Building,
  MapPin,
  Users,
  PlusCircle,
  Edit2,
  Trash2,
  Copy,
  CheckCircle,
  X,
  Search,
  User,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import type { AreaEmpresa, Local, Colaborador, AreaTipo, ColaboradorPapel } from '../types';

type Tab = 'areas' | 'locais' | 'colaboradores' | 'solicitantes';

export const Cadastros: React.FC = () => {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const aba = searchParams.get('aba');
    if (aba === 'solicitantes') return 'solicitantes';
    return 'areas';
  });
  const [loading, setLoading] = useState(true);

  // Data lists
  const [areas, setAreas] = useState<AreaEmpresa[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [solicitantes, setSolicitantes] = useState<Colaborador[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Area Form
  const [editingArea, setEditingArea] = useState<AreaEmpresa | null>(null);
  const [areaNome, setAreaNome] = useState('');
  const [areaTipo, setAreaTipo] = useState<AreaTipo>('area_interna');
  const [areaContato, setAreaContato] = useState('');
  const [areaAtivo, setAreaAtivo] = useState(true);

  // Local Form
  const [editingLocal, setEditingLocal] = useState<Local | null>(null);
  const [localUg, setLocalUg] = useState('');
  const [localSetorLinha, setLocalSetorLinha] = useState('');
  const [localPontoRef, setLocalPontoRef] = useState('');
  const [localDescricao, setLocalDescricao] = useState('');
  const [localAtivo, setLocalAtivo] = useState(true);

  // Colaborador Form
  const [editingColab, setEditingColab] = useState<Colaborador | null>(null);
  const [colabNome, setColabNome] = useState('');
  const [colabMatricula, setColabMatricula] = useState('');
  const [colabAreaId, setColabAreaId] = useState('');
  const [colabPapel, setColabPapel] = useState<ColaboradorPapel>('operador');
  const [colabContato, setColabContato] = useState('');
  const [colabAtivo, setColabAtivo] = useState(true);

  // Solicitante Form (mesmo modelo de colaborador, papel fixo = solicitante)
  const [editingSolicitante, setEditingSolicitante] = useState<Colaborador | null>(null);
  const [solNome, setSolNome] = useState('');
  const [solMatricula, setSolMatricula] = useState('');
  const [solAreaId, setSolAreaId] = useState('');
  const [solContato, setSolContato] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [areasRes, locaisRes, colabsRes, solicitantesRes] = await Promise.all([
        supabase.from('areas_empresas').select('*').order('nome', { ascending: true }),
        supabase.from('locais').select('*').order('ug', { ascending: true }),
        supabase.from('colaboradores').select('*').order('nome', { ascending: true }),
        supabase.from('colaboradores').select('*').eq('papel', 'solicitante').order('nome', { ascending: true }),
      ]);

      if (areasRes.data) setAreas(areasRes.data);
      if (locaisRes.data) setLocais(locaisRes.data);
      if (colabsRes.data) setColaboradores(colabsRes.data);
      if (solicitantesRes.data) setSolicitantes(solicitantesRes.data);
    } catch (err: any) {
      console.error('Erro ao carregar cadastros auxiliares:', err);
      toast.error('Erro ao carregar dados', err.message);
    } finally {
      setLoading(false);
    }
  }

  // Opening modals
  const handleOpenCreate = () => {
    if (activeTab === 'areas') {
      setEditingArea(null);
      setAreaNome('');
      setAreaTipo('area_interna');
      setAreaContato('');
      setAreaAtivo(true);
    } else if (activeTab === 'locais') {
      setEditingLocal(null);
      setLocalUg('');
      setLocalSetorLinha('');
      setLocalPontoRef('');
      setLocalDescricao('');
      setLocalAtivo(true);
    } else if (activeTab === 'solicitantes') {
      setEditingSolicitante(null);
      setSolNome('');
      setSolMatricula('');
      setSolAreaId('');
      setSolContato('');
    } else {
      setEditingColab(null);
      setColabNome('');
      setColabMatricula('');
      setColabAreaId(areas[0]?.id || '');
      setColabPapel('operador');
      setColabContato('');
      setColabAtivo(true);
    }
    setModalOpen(true);
  };

  const handleEditArea = (item: AreaEmpresa) => {
    setEditingArea(item);
    setAreaNome(item.nome);
    setAreaTipo(item.tipo);
    setAreaContato(item.contato || '');
    setAreaAtivo(item.ativo);
    setModalOpen(true);
  };

  const handleEditLocal = (item: Local) => {
    setEditingLocal(item);
    setLocalUg(item.ug || '');
    setLocalSetorLinha(item.setor_linha || '');
    setLocalPontoRef(item.ponto_ref || '');
    setLocalDescricao(item.descricao || item.ug || '');
    setLocalAtivo(item.ativo);
    setModalOpen(true);
  };

  const handleEditColab = (item: Colaborador) => {
    setEditingColab(item);
    setColabNome(item.nome);
    setColabMatricula(item.matricula || '');
    setColabAreaId(item.area_empresa_id || areas[0]?.id || '');
    setColabPapel(item.papel);
    setColabContato(item.contato || '');
    setColabAtivo(item.ativo);
    setModalOpen(true);
  };

  const handleDelete = async (tabela: 'areas_empresas' | 'locais' | 'colaboradores', id: string) => {
    const ok = await confirm({
      title: 'Excluir Registro',
      message: 'Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const { error } = await supabase.from(tabela).delete().eq('id', id);

      if (error) {
        if (
          error.code === '23503' ||
          error.message?.includes('foreign key constraint') ||
          error.message?.includes('violates foreign key') ||
          error.details?.includes('foreign key') ||
          error.message?.toLowerCase().includes('violates')
        ) {
          toast.error('Não é possível excluir: este registro está vinculado a outros dados do sistema.');
          return;
        }
        throw error;
      }

      toast.success('Registro excluído com sucesso');
      await loadAll();
    } catch (err: any) {
      console.error('Erro ao excluir registro:', err);
      if (
        err.code === '23503' ||
        err.message?.includes('foreign key constraint') ||
        err.message?.includes('violates foreign key') ||
        err.message?.toLowerCase().includes('foreign key') ||
        err.details?.includes('foreign key') ||
        err.message?.toLowerCase().includes('violates')
      ) {
        toast.error('Não é possível excluir: este registro está vinculado a outros dados do sistema.');
      } else {
        toast.error('Erro ao excluir', err.message || 'Ocorreu um erro ao excluir o registro.');
      }
    }
  };

  // Submit handlers
  const handleSaveArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaNome.trim()) return;
    setSaving(true);
    try {
      const payload = {
        nome: areaNome.trim(),
        tipo: areaTipo,
        contato: areaContato.trim() || null,
        ativo: areaAtivo,
      };
      if (editingArea) {
        const { error } = await supabase.from('areas_empresas').update(payload).eq('id', editingArea.id);
        if (error) throw error;
        toast.success('Área Atualizada', 'Alterações salvas com sucesso.');
      } else {
        const { error } = await supabase.from('areas_empresas').insert([payload]);
        if (error) throw error;
        toast.success('Área Cadastrada', 'Nova área adicionada ao catálogo.');
      }
      setModalOpen(false);
      loadAll();
    } catch (err: any) {
      toast.error('Erro ao salvar área', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(localUg || '').trim() || !(localDescricao || '').trim()) return;
    setSaving(true);
    try {
      const payload = {
        ug: (localUg || '').trim().toUpperCase(),
        descricao: (localDescricao || '').trim().toUpperCase() || null,
        setor_linha: (localSetorLinha || '').trim().toUpperCase() || null,
        ponto_ref: null,
        ativo: localAtivo,
      };
      if (editingLocal) {
        const { error } = await supabase.from('locais').update(payload).eq('id', editingLocal.id);
        if (error) throw error;
        toast.success('Local Atualizado', 'Alterações salvas com sucesso.');
      } else {
        const { error } = await supabase.from('locais').insert([payload]);
        if (error) throw error;
        toast.success('Local Cadastrado', 'Novo local de utilização registrado.');
      }
      setModalOpen(false);
      loadAll();
    } catch (err: any) {
      toast.error('Erro ao salvar local', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveColab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colabNome.trim()) return;
    setSaving(true);
    try {
      const payload = {
        nome: colabNome.trim(),
        area_empresa_id: colabAreaId || null,
        papel: colabPapel,
        contato: colabContato.trim() || null,
        ativo: colabAtivo,
      };
      if (editingColab) {
        const { error } = await supabase.from('colaboradores').update(payload).eq('id', editingColab.id);
        if (error) throw error;
        toast.success('Colaborador Atualizado', 'Alterações salvas.');
      } else {
        const { error } = await supabase.from('colaboradores').insert([payload]);
        if (error) throw error;
        toast.success('Colaborador Cadastrado', 'Novo operador/gestor inserido.');
      }
      setModalOpen(false);
      loadAll();
    } catch (err: any) {
      toast.error('Erro ao salvar colaborador', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            Cadastros Auxiliares da Cervejaria
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Gerencie as Áreas/Empresas parceiras, Unidades Gerenciais (UGs) e Colaboradores autorizados.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1B2A4A] hover:bg-[#152238] text-white font-bold text-xs sm:text-sm rounded-lg shadow-xs transition-colors"
        >
          <PlusCircle className="w-4 h-4 text-[#F5D800]" />
          <span>
            {activeTab === 'areas'
              ? 'Nova Empresa'
              : activeTab === 'locais'
              ? 'Novo Local de Utilização'
              : 'Novo Colaborador'}
          </span>
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 bg-white px-4 rounded-xl shadow-xs overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab('areas');
            setSearchTerm('');
          }}
          className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'areas'
              ? 'border-[#F5D800] text-[#1B2A4A]'
              : 'border-transparent text-gray-500 hover:text-[#1B2A4A]'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Empresas ({areas.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('locais');
            setSearchTerm('');
          }}
          className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'locais'
              ? 'border-[#F5D800] text-[#1B2A4A]'
              : 'border-transparent text-gray-500 hover:text-[#1B2A4A]'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Locais de Utilização ({locais.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('colaboradores');
            setSearchTerm('');
          }}
          className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'colaboradores'
              ? 'border-[#F5D800] text-[#1B2A4A]'
              : 'border-transparent text-gray-500 hover:text-[#1B2A4A]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Colaboradores & Operadores ({colaboradores.length})</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('solicitantes');
            setSearchTerm('');
          }}
          className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'solicitantes'
              ? 'border-[#F5D800] text-[#1B2A4A]'
              : 'border-transparent text-gray-500 hover:text-[#1B2A4A]'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Solicitantes ({solicitantes.length})</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Filtrar registros da tabela..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
        />
      </div>

      {/* Content for TAB 1: ÁREAS */}
      {activeTab === 'areas' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Empresa</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Contato / Informações</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {areas
                .filter((a) => a.nome.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((area) => (
                  <tr key={area.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-bold text-gray-900">{area.nome}</td>
                    <td className="py-3 px-4 capitalize">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          area.tipo === 'area_interna'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-blue-100 text-blue-900'
                        }`}
                      >
                        {area.tipo === 'area_interna' ? 'Área Interna (AmBev)' : 'Empresa Terceira'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{area.contato || '-'}</td>
                    <td className="py-3 px-4">
                      {area.ativo ? (
                        <span className="text-emerald-700 font-bold">Ativa</span>
                      ) : (
                        <span className="text-gray-400">Inativa</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditArea(area)}
                          className="p-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete('areas_empresas', area.id)}
                          className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Content for TAB 2: LOCAIS / UGs */}
      {activeTab === 'locais' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">UG</th>
                <th className="py-3 px-4">LOCAL DE UTILIZAÇÃO</th>
                <th className="py-3 px-4">Setor / Linha</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {locais
                .filter(
                  (l) =>
                    l.ug.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    l.setor_linha.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((loc) => (
                  <tr key={loc.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-bold text-gray-900 text-[11px]">{loc.ug}</td>
                    <td className="py-3 px-4 text-gray-800">{loc.descricao || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{loc.setor_linha || '-'}</td>
                    <td className="py-3 px-4">
                      {loc.ativo ? (
                        <span className="text-emerald-700 font-bold">Ativo</span>
                      ) : (
                        <span className="text-gray-400">Inativo</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditLocal(loc)}
                          className="p-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingLocal(null);
                            setLocalUg(loc.ug || '');
                            setLocalDescricao(loc.descricao || loc.ug || '');
                            setLocalSetorLinha(loc.setor_linha || '');
                            setLocalPontoRef('');
                            setLocalAtivo(true);
                            setModalOpen(true);
                          }}
                          className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                          title="Duplicar"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete('locais', loc.id)}
                          className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Content for TAB 3: COLABORADORES */}
      {activeTab === 'colaboradores' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">Empresa</th>
                <th className="py-3 px-4">Papel / Função</th>
                <th className="py-3 px-4">Contato</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {colaboradores
                .filter(
                  (c) =>
                    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (c.matricula && c.matricula.toLowerCase().includes(searchTerm.toLowerCase()))
                )
                .map((colab) => {
                  const areaObj = areas.find((a) => a.id === colab.area_empresa_id);
                  return (
                    <tr key={colab.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-bold text-gray-900">{colab.nome}</td>
                      <td className="py-3 px-4 text-gray-800">{areaObj?.nome || '-'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-800">
                          {colab.papel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500">{colab.contato || '-'}</td>
                      <td className="py-3 px-4">
                        {colab.ativo ? (
                          <span className="text-emerald-700 font-bold">Ativo</span>
                        ) : (
                          <span className="text-gray-400">Inativo</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEditColab(colab)}
                            className="p-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete('colaboradores', colab.id)}
                            className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}


      {/* Content for TAB 4: SOLICITANTES */}
      {activeTab === 'solicitantes' && (
        <div className="space-y-4">
          {solicitantes.length === 0 && !loading ? (
            <div className="text-center py-10 text-gray-500 text-sm">
              Nenhum solicitante cadastrado. Clique em &quot;+ Novo Solicitante&quot; para começar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Nome</th>
                    <th className="py-3 px-4">Empresa</th>
                    <th className="py-3 px-4">Contato</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {solicitantes.map((sol) => {
                    const area = areas.find((a) => a.id === sol.area_empresa_id);
                    return (
                      <tr key={sol.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-semibold text-gray-900">{sol.nome}</td>
                        <td className="py-3 px-4 text-gray-600">{area ? area.nome : '-'}</td>
                        <td className="py-3 px-4 text-gray-600">{sol.contato || '-'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sol.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {sol.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingSolicitante(sol);
                                setSolNome(sol.nome);
                                setSolMatricula(sol.matricula || '');
                                setSolAreaId(sol.area_empresa_id || '');
                                setSolContato(sol.contato || '');
                                setModalOpen(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-[#1B2A4A] rounded"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm('Excluir este solicitante?')) return;
                                const { error } = await supabase.from('colaboradores').delete().eq('id', sol.id);
                                if (error) {
                                  toast.error('Erro ao excluir', 'Este solicitante pode estar vinculado a agendamentos.');
                                } else {
                                  toast.success('Excluído', 'Solicitante removido.');
                                  loadAll();
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal for Area / Local / Colab */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-200 overflow-hidden">
            <div className="bg-[#1B2A4A] text-white px-6 py-4 flex items-center justify-between border-b border-[#152238]">
              <h3 className="text-base font-bold text-white">
                {activeTab === 'areas'
                  ? editingArea
                    ? 'Editar Empresa'
                    : 'Nova Empresa'
                  : activeTab === 'locais'
                  ? editingLocal
                    ? 'Editar Local de Utilização'
                    : 'Novo Local de Utilização'
                  : editingColab
                  ? 'Editar Colaborador'
                  : 'Novo Colaborador'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-300 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORM AREA */}
            {activeTab === 'areas' && (
              <form onSubmit={handleSaveArea} className="p-6 space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Empresa *</label>
                  <input
                    type="text"
                    required
                    value={areaNome}
                    onChange={(e) => setAreaNome(e.target.value)}
                    placeholder="Ex: Vision Refrigeração / Elétrica / Civil"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Tipo *</label>
                  <select
                    value={areaTipo}
                    onChange={(e) => setAreaTipo(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium"
                  >
                    <option value="area_interna">Área Interna (AmBev)</option>
                    <option value="empresa_terceira">Empresa Terceirizada</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Contato / Gestor / E-mail</label>
                  <input
                    type="text"
                    value={areaContato}
                    onChange={(e) => setAreaContato(e.target.value)}
                    placeholder="Ex: Carlos (Ramal 4501) ou gestor@ambev.com.br"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={areaAtivo}
                    onChange={(e) => setAreaAtivo(e.target.checked)}
                    className="w-4 h-4 text-amber-500 rounded"
                  />
                  <span className="font-semibold text-gray-700">Área Ativa no Sistema</span>
                </label>
                <div className="pt-4 border-t border-gray-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 bg-[#1B2A4A] hover:bg-[#152238] font-bold text-white rounded-lg shadow-xs transition-colors"
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            )}

            {/* FORM LOCAL */}
            {activeTab === 'locais' && (
              <form onSubmit={handleSaveLocal} className="p-6 space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">UG *</label>
                  <input
                    type="text"
                    required
                    value={localUg}
                    onChange={(e) => setLocalUg(e.target.value)}
                    placeholder="Ex: Brassagem, Filtração, Utilidades..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Local de Utilização *</label>
                  <input
                    type="text"
                    required
                    value={localDescricao}
                    onChange={(e) => setLocalDescricao(e.target.value)}
                    placeholder="Ex: Área de Envase, Sala de Compressores..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Setor / Linha <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input
                    type="text"
                    value={localSetorLinha}
                    onChange={(e) => setLocalSetorLinha(e.target.value)}
                    placeholder="Ex: Linha 501, Caldeiras..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white uppercase"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={localAtivo}
                    onChange={(e) => setLocalAtivo(e.target.checked)}
                    className="w-4 h-4 text-amber-500 rounded"
                  />
                  <span className="font-semibold text-gray-700">Local Ativo</span>
                </label>
                <div className="pt-4 border-t border-gray-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 bg-[#1B2A4A] hover:bg-[#152238] font-bold text-white rounded-lg shadow-xs transition-colors"
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            )}


            {/* FORM SOLICITANTE */}
            {activeTab === 'solicitantes' && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!solNome.trim()) return;
                  setSaving(true);
                  try {
                    const payload = {
                      nome: solNome.trim(),
                      matricula: solMatricula || null,
                      area_empresa_id: solAreaId || null,
                      contato: solContato || null,
                      papel: 'solicitante' as ColaboradorPapel,
                      ativo: true,
                    };
                    if (editingSolicitante) {
                      const { error } = await supabase.from('colaboradores').update(payload).eq('id', editingSolicitante.id);
                      if (error) throw error;
                      toast.success('Atualizado', 'Solicitante atualizado.');
                    } else {
                      const { error } = await supabase.from('colaboradores').insert([payload]);
                      if (error) throw error;
                      toast.success('Cadastrado', 'Solicitante cadastrado com sucesso.');
                    }
                    setModalOpen(false);
                    loadAll();
                  } catch (err: any) {
                    toast.error('Erro', err.message);
                  } finally {
                    setSaving(false);
                  }
                }}
                className="p-6 space-y-4 text-xs"
              >
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={solNome}
                    onChange={(e) => setSolNome(e.target.value)}
                    placeholder="Ex: João Silva"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium focus:ring-2 focus:ring-[#F5D800]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Contato (Telefone / E-mail)</label>
                  <input
                    type="text"
                    value={solContato}
                    onChange={(e) => setSolContato(e.target.value)}
                    placeholder="Ex: (21) 99999-0000 / joao@ambev.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#F5D800]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Empresa</label>
                  <select
                    value={solAreaId}
                    onChange={(e) => setSolAreaId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#F5D800]"
                  >
                    <option value="">Sem vínculo específico</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-4 border-t border-gray-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !solNome.trim()}
                    className="px-5 py-2 text-sm font-bold text-white bg-[#1B2A4A] hover:bg-[#152238] rounded-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <CheckCircle className="w-4 h-4 text-[#F5D800]" />}
                    {editingSolicitante ? 'Salvar Alterações' : 'Cadastrar Solicitante'}
                  </button>
                </div>
              </form>
            )}

            {/* FORM COLABORADOR */}
            {activeTab === 'colaboradores' && (
              <form onSubmit={handleSaveColab} className="p-6 space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={colabNome}
                    onChange={(e) => setColabNome(e.target.value)}
                    placeholder="Ex: Carlos Silva"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Papel / Função *</label>
                    <select
                      value={colabPapel}
                      onChange={(e) => setColabPapel(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium"
                    >
                      <option value="solicitante">Solicitante</option>
                      <option value="operador">Operador de PTA</option>
                      <option value="liberador">Liberador Facilities</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Empresa</label>
                  <select
                    value={colabAreaId}
                    onChange={(e) => setColabAreaId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Nenhuma / Sem vínculo</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Contato (Telefone / Rádio / E-mail)</label>
                  <input
                    type="text"
                    value={colabContato}
                    onChange={(e) => setColabContato(e.target.value)}
                    placeholder="Ex: (11) 98888-7777 / Canal 4"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={colabAtivo}
                    onChange={(e) => setColabAtivo(e.target.checked)}
                    className="w-4 h-4 text-amber-500 rounded"
                  />
                  <span className="font-semibold text-gray-700">Colaborador Ativo</span>
                </label>
                <div className="pt-4 border-t border-gray-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 bg-[#1B2A4A] hover:bg-[#152238] font-bold text-white rounded-lg shadow-xs transition-colors"
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
