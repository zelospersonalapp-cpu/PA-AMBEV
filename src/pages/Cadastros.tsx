import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  MapPin,
  Users,
  PlusCircle,
  Edit2,
  Trash2,
  CheckCircle,
  X,
  Search,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import type { AreaEmpresa, Local, Colaborador, AreaTipo, ColaboradorPapel } from '../types';

type Tab = 'areas' | 'locais' | 'colaboradores';

export const Cadastros: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('areas');
  const [loading, setLoading] = useState(true);

  // Data lists
  const [areas, setAreas] = useState<AreaEmpresa[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
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

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [areasRes, locaisRes, colabsRes] = await Promise.all([
        supabase.from('areas_empresas').select('*').order('nome', { ascending: true }),
        supabase.from('locais').select('*').order('ug', { ascending: true }),
        supabase.from('colaboradores').select('*').order('nome', { ascending: true }),
      ]);

      if (areasRes.data) setAreas(areasRes.data);
      if (locaisRes.data) setLocais(locaisRes.data);
      if (colabsRes.data) setColaboradores(colabsRes.data);
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
    setLocalUg(item.ug);
    setLocalSetorLinha(item.setor_linha);
    setLocalPontoRef(item.ponto_ref || '');
    setLocalDescricao(item.descricao || '');
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
    if (!localUg.trim() || !localSetorLinha.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ug: localUg.trim(),
        setor_linha: localSetorLinha.trim(),
        ponto_ref: localPontoRef.trim() || null,
        descricao: localDescricao.trim() || null,
        ativo: localAtivo,
      };
      if (editingLocal) {
        const { error } = await supabase.from('locais').update(payload).eq('id', editingLocal.id);
        if (error) throw error;
        toast.success('Local Atualizado', 'Alterações salvas com sucesso.');
      } else {
        const { error } = await supabase.from('locais').insert([payload]);
        if (error) throw error;
        toast.success('Local Cadastrado', 'Novo local/UG registrado.');
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
    if (!colabNome.trim() || !colabMatricula.trim()) return;
    setSaving(true);
    try {
      const payload = {
        nome: colabNome.trim(),
        matricula: colabMatricula.trim(),
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
              ? 'Nova Área / Empresa'
              : activeTab === 'locais'
              ? 'Novo Local (UG)'
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
          <span>Áreas & Empresas ({areas.length})</span>
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
          <span>Locais & UGs ({locais.length})</span>
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
                <th className="py-3 px-4">Nome da Área / Empresa</th>
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
                      <button
                        onClick={() => handleEditArea(area)}
                        className="p-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
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
                <th className="py-3 px-4">UG (Unidade Gerencial)</th>
                <th className="py-3 px-4">Setor / Linha</th>
                <th className="py-3 px-4">Ponto de Referência</th>
                <th className="py-3 px-4">Descrição</th>
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
                    <td className="py-3 px-4 font-bold text-gray-900">{loc.ug}</td>
                    <td className="py-3 px-4 text-gray-800">{loc.setor_linha}</td>
                    <td className="py-3 px-4 text-gray-600">{loc.ponto_ref || '-'}</td>
                    <td className="py-3 px-4 text-gray-500 max-w-xs truncate">{loc.descricao || '-'}</td>
                    <td className="py-3 px-4">
                      {loc.ativo ? (
                        <span className="text-emerald-700 font-bold">Ativo</span>
                      ) : (
                        <span className="text-gray-400">Inativo</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleEditLocal(loc)}
                        className="p-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
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
                <th className="py-3 px-4">Matrícula</th>
                <th className="py-3 px-4">Área / Empresa</th>
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
                      <td className="py-3 px-4 font-mono text-gray-700 font-bold">{colab.matricula}</td>
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
                        <button
                          onClick={() => handleEditColab(colab)}
                          className="p-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
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
                    ? 'Editar Área'
                    : 'Nova Área / Empresa'
                  : activeTab === 'locais'
                  ? editingLocal
                    ? 'Editar Local'
                    : 'Novo Local (UG)'
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
                  <label className="block font-semibold text-gray-700 mb-1">Nome da Área *</label>
                  <input
                    type="text"
                    required
                    value={areaNome}
                    onChange={(e) => setAreaNome(e.target.value)}
                    placeholder="Ex: Fabricação / Manutenção / Empresa Parceira"
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
                  <label className="block font-semibold text-gray-700 mb-1">Unidade Gerencial (UG) *</label>
                  <input
                    type="text"
                    required
                    value={localUg}
                    onChange={(e) => setLocalUg(e.target.value)}
                    placeholder="Ex: UG-01, UG-Envase, UG-Utilidades"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Setor / Linha *</label>
                  <input
                    type="text"
                    required
                    value={localSetorLinha}
                    onChange={(e) => setLocalSetorLinha(e.target.value)}
                    placeholder="Ex: Linha 501, Sala de Compressores, Caldeiras..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Ponto de Referência</label>
                  <input
                    type="text"
                    value={localPontoRef}
                    onChange={(e) => setLocalPontoRef(e.target.value)}
                    placeholder="Ex: Próximo ao Portão 4, Mezanino Sul..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Descrição / Restrições</label>
                  <textarea
                    rows={2}
                    value={localDescricao}
                    onChange={(e) => setLocalDescricao(e.target.value)}
                    placeholder="Tomadas 220V/380V, piso reforçado, restrições de tráfego..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
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
                    <label className="block font-semibold text-gray-700 mb-1">Matrícula AmBev *</label>
                    <input
                      type="text"
                      required
                      value={colabMatricula}
                      onChange={(e) => setColabMatricula(e.target.value)}
                      placeholder="Ex: 998877"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-mono"
                    />
                  </div>
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
                  <label className="block font-semibold text-gray-700 mb-1">Área / Empresa</label>
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
