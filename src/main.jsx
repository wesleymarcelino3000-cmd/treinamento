import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import {
  Upload, FileText, CheckCircle2, Clock3, Search, Trash2, Download,
  Eye, X, UserRound, CalendarDays, NotebookPen, LayoutDashboard, Star,
  FolderOpen, Smartphone, Sparkles, Menu, ChevronRight, Image as ImageIcon, Award, Printer
} from 'lucide-react'
import './style.css'

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
const BUCKET = 'ppts'

function formatSize(size) {
  if (!size) return '—'
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('pt-BR')
  } catch {
    return value
  }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function fileKind(name = '') {
  return name.toLowerCase().endsWith('.pptx') ? 'PPTX' : 'PPT'
}

function App() {
  const inputRef = useRef(null)
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [dragging, setDragging] = useState(false)
  const [message, setMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [certificado, setCertificado] = useState(null)
  const [certForm, setCertForm] = useState({ participante: '', cargaHoraria: '1 hora', local: 'Inno Life Nutrition', observacoes: '' })
  const [mobileMenu, setMobileMenu] = useState(false)

  async function load() {
    const { data, error } = await supabase.from('ppts').select('*').order('created_at', { ascending: false })
    if (error) setMessage('Erro ao carregar: ' + error.message)
    else setItems(data || [])
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  const filtered = useMemo(() => {
    return items.filter(item => {
      const name = (item.nome || '').toLowerCase()
      const responsible = (item.responsavel || '').toLowerCase()
      const note = (item.observacao || '').toLowerCase()
      const q = query.toLowerCase()
      const okQuery = name.includes(q) || responsible.includes(q) || note.includes(q)
      const okStatus = statusFilter === 'todos' || (statusFilter === 'aplicados' ? item.aplicado : !item.aplicado)
      return okQuery && okStatus
    })
  }, [items, query, statusFilter])

  const stats = useMemo(() => {
    const total = items.length
    const applied = items.filter(i => i.aplicado).length
    const pending = total - applied
    return { total, applied, pending }
  }, [items])

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return

    const invalid = files.find(file => {
      const name = file.name.toLowerCase()
      return !(name.endsWith('.ppt') || name.endsWith('.pptx'))
    })

    if (invalid) {
      setMessage('Arquivo inválido. Envie apenas PPT ou PPTX.')
      return
    }

    setUploading(true)
    setMessage(`Enviando ${files.length} arquivo(s)...`)

    for (const file of files) {
      const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const path = `${Date.now()}-${Math.random().toString(16).slice(2)}-${clean}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false })

      if (uploadError) {
        setMessage('Erro no upload: ' + uploadError.message)
        setUploading(false)
        return
      }

      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

      const { error: insertError } = await supabase.from('ppts').insert({
        nome: file.name,
        caminho: path,
        url: publicUrl,
        tamanho: file.size,
        aplicado: false,
        observacao: '',
        responsavel: '',
        data_aplicacao: null
      })

      if (insertError) {
        setMessage('Arquivo enviado, mas não salvou no banco: ' + insertError.message)
        setUploading(false)
        return
      }
    }

    setMessage('Upload concluído com sucesso.')
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    load()
  }

  async function markApplied(item, value) {
    const payload = {
      aplicado: value,
      data_aplicacao: value ? (item.data_aplicacao || today()) : null
    }
    const { error } = await supabase.from('ppts').update(payload).eq('id', item.id)
    if (error) setMessage('Erro ao atualizar status: ' + error.message)
    else load()
  }

  async function updateField(item, field, value) {
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, [field]: value } : x))
    const { error } = await supabase.from('ppts').update({ [field]: value || null }).eq('id', item.id)
    if (error) setMessage('Erro ao salvar: ' + error.message)
  }

  async function removeItem(item) {
    if (!confirm('Deseja excluir esta apresentação?')) return
    if (item.caminho) await supabase.storage.from(BUCKET).remove([item.caminho])
    const { error } = await supabase.from('ppts').delete().eq('id', item.id)
    if (error) setMessage('Erro ao excluir: ' + error.message)
    else load()
  }

  function openCertificado(item) {
    setCertificado(item)
    setCertForm({
      participante: '',
      cargaHoraria: '1 hora',
      local: 'Inno Life Nutrition',
      observacoes: item.observacao || ''
    })
  }

  function imprimirCertificado() {
    window.print()
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    uploadFiles(e.dataTransfer.files)
  }

  return (
    <div className="app">
      <aside className={mobileMenu ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <div className="brandIcon image"><img src="/icons/icon-premium.png" alt="Ícone PPT SaaS" /></div>
          <div>
            <strong>PPT SaaS</strong>
            <span>Premium Control</span>
          </div>
        </div>

        <nav className="nav">
          <button className="active"><LayoutDashboard size={18}/> Dashboard <ChevronRight size={16}/></button>
          <button onClick={() => inputRef.current?.click()}><Upload size={18}/> Upload múltiplo</button>
          <button onClick={() => setStatusFilter('aplicados')}><CheckCircle2 size={18}/> Aplicados</button>
          <button onClick={() => setStatusFilter('nao')}><Clock3 size={18}/> Não aplicados</button>
          <button><FolderOpen size={18}/> Biblioteca</button>
          <button><Smartphone size={18}/> PWA Instalável</button>
        </nav>

        <div className="sideCard">
          <Sparkles size={22}/>
          <b>Sistema Premium</b>
          <p>Upload em nuvem, preview, observações e controle completo.</p>
        </div>
      </aside>

      <main className="main">
        <button className="mobileToggle" onClick={() => setMobileMenu(!mobileMenu)}><Menu /></button>

        <header className="hero">
          <div>
            <p className="eyebrow">Dashboard premium</p>
            <h1>Controle suas apresentações com precisão</h1>
            <span>Marque data, responsável, observações avançadas, preview e upload múltiplo.</span>
          </div>

          <button className="primary" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload size={20}/> {uploading ? 'Enviando...' : 'Upload de PPT/PPTX'}
          </button>
          <input
            ref={inputRef}
            hidden
            multiple
            type="file"
            accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            onChange={e => uploadFiles(e.target.files)}
          />
        </header>

        {message && <div className={message.includes('sucesso') ? 'toast ok' : 'toast'}>{message}</div>}

        <section className="metrics">
          <article><FileText/><span>Total</span><strong>{stats.total}</strong></article>
          <article className="green"><CheckCircle2/><span>Aplicados</span><strong>{stats.applied}</strong></article>
          <article className="orange"><Clock3/><span>Não aplicados</span><strong>{stats.pending}</strong></article>
          <article className="purple"><Star/><span>Premium</span><strong>PWA</strong></article>
        </section>

        <section
          className={dragging ? 'dropzone dragging' : 'dropzone'}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={34}/>
          <h2>Arraste seus PPTs aqui</h2>
          <p>Upload múltiplo premium com suporte a .ppt e .pptx</p>
        </section>

        <section className="panel">
          <div className="panelTop">
            <div>
              <h2>Últimas apresentações</h2>
              <p>{filtered.length} resultado(s) encontrado(s)</p>
            </div>
            <div className="filters">
              <div className="search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por arquivo, responsável ou observação..." /></div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="aplicados">Aplicados</option>
                <option value="nao">Não aplicados</option>
              </select>
            </div>
          </div>

          <div className="table">
            <div className="thead">
              <span>Miniatura / Arquivo</span>
              <span>Status</span>
              <span>Data aplicação</span>
              <span>Responsável</span>
              <span>Observações avançadas</span>
              <span>Ações</span>
            </div>

            {filtered.length === 0 ? (
              <div className="empty">Nenhuma apresentação cadastrada.</div>
            ) : filtered.map(item => (
              <div className="row" key={item.id}>
                <div className="fileInfo">
                  <div className="thumb"><ImageIcon size={20}/><b>{fileKind(item.nome)}</b></div>
                  <div><strong>{item.nome}</strong><small>{formatSize(item.tamanho)}</small></div>
                </div>

                <button className={item.aplicado ? 'status applied' : 'status pending'} onClick={() => markApplied(item, !item.aplicado)}>
                  {item.aplicado ? 'Aplicado' : 'Não aplicado'}
                </button>

                <input type="date" value={item.data_aplicacao || ''} onChange={e => updateField(item, 'data_aplicacao', e.target.value)} />

                <div className="inputIcon">
                  <UserRound size={16}/>
                  <input value={item.responsavel || ''} onChange={e => updateField(item, 'responsavel', e.target.value)} placeholder="Nome..." />
                </div>

                <div className="inputIcon note">
                  <NotebookPen size={16}/>
                  <textarea value={item.observacao || ''} onChange={e => updateField(item, 'observacao', e.target.value)} placeholder="Ex.: turma, tema, resultado, pendências..." />
                </div>

                <div className="actions">
                  <button title="Preview" onClick={() => setPreview(item)}><Eye size={18}/></button>
                  <button title="Gerar certificado" className="certBtn" onClick={() => openCertificado(item)}><Award size={18}/></button>
                  <a title="Baixar" href={item.url} target="_blank" rel="noreferrer"><Download size={18}/></a>
                  <button title="Excluir" className="danger" onClick={() => removeItem(item)}><Trash2 size={18}/></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>


      {certificado && (
        <div className="modal certificateModal" onClick={() => setCertificado(null)}>
          <div className="certWrap" onClick={e => e.stopPropagation()}>
            <button className="close noPrint" onClick={() => setCertificado(null)}><X/></button>

            <div className="certForm noPrint">
              <h2>Gerar certificado</h2>
              <div className="formGrid">
                <label>Nome do participante
                  <input value={certForm.participante} onChange={e => setCertForm({...certForm, participante: e.target.value})} placeholder="Ex.: João Silva" />
                </label>
                <label>Carga horária
                  <input value={certForm.cargaHoraria} onChange={e => setCertForm({...certForm, cargaHoraria: e.target.value})} placeholder="Ex.: 2 horas" />
                </label>
                <label>Local
                  <input value={certForm.local} onChange={e => setCertForm({...certForm, local: e.target.value})} placeholder="Ex.: Inno Life Nutrition" />
                </label>
                <label>Observações
                  <input value={certForm.observacoes} onChange={e => setCertForm({...certForm, observacoes: e.target.value})} placeholder="Opcional" />
                </label>
              </div>
              <button className="primary" onClick={imprimirCertificado}><Printer size={18}/> Baixar / imprimir certificado</button>
            </div>

            <section className="certificate">
              <div className="certBorder">
                <img className="certLogo" src="/logo-inno-life.webp" alt="Inno Life" />
                <div className="certSeal"><Award size={54}/></div>
                <p className="certSmall">Certificado de Conclusão</p>
                <h1>CERTIFICADO</h1>
                <p className="certText">Certificamos que</p>
                <h2>{certForm.participante || 'Nome do Participante'}</h2>
                <p className="certText">concluiu com êxito o treinamento</p>
                <h3>{certificado.nome}</h3>

                <div className="certInfo">
                  <span><b>Data:</b> {formatDate(certificado.data_aplicacao) !== '—' ? formatDate(certificado.data_aplicacao) : formatDate(new Date())}</span>
                  <span><b>Carga horária:</b> {certForm.cargaHoraria || '—'}</span>
                  <span><b>Responsável:</b> {certificado.responsavel || '—'}</span>
                  <span><b>Local:</b> {certForm.local || '—'}</span>
                </div>

                {certForm.observacoes && <p className="certObs">{certForm.observacoes}</p>}

                <div className="signatures">
                  <div><span></span><p>Responsável / Instrutor</p></div>
                  <div><span></span><p>Participante</p></div>
                </div>

                <p className="certFooter">Inno Life Nutrition • Certificado gerado automaticamente pelo PPT SaaS Premium</p>
              </div>
            </section>
          </div>
        </div>
      )}

      {preview && (
        <div className="modal" onClick={() => setPreview(null)}>
          <div className="preview" onClick={e => e.stopPropagation()}>
            <button className="close" onClick={() => setPreview(null)}><X/></button>
            <div className="previewHero">
              <div className="bigThumb"><FileText size={54}/><b>{fileKind(preview.nome)}</b></div>
              <div>
                <h2>{preview.nome}</h2>
                <p>O navegador não renderiza PPT diretamente. Use o botão abaixo para abrir/baixar o arquivo.</p>
                <div className="previewGrid">
                  <span><CalendarDays size={16}/> Data: {formatDate(preview.data_aplicacao)}</span>
                  <span><UserRound size={16}/> Responsável: {preview.responsavel || '—'}</span>
                  <span><NotebookPen size={16}/> Observação: {preview.observacao || '—'}</span>
                </div>
                <a className="primaryLink" href={preview.url} target="_blank" rel="noreferrer"><Download size={18}/> Abrir / baixar PPT</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
