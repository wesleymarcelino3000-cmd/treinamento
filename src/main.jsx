
import React,{useEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {createClient} from '@supabase/supabase-js'
import {Upload,CheckCircle2,Clock3,Search,Trash2,Download} from 'lucide-react'
import './style.css'

const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY)
const bucket='ppts'

function App(){
const ref=useRef()
const [items,setItems]=useState([])
const [msg,setMsg]=useState('')
const [query,setQuery]=useState('')

async function load(){
 const {data}=await supabase.from('ppts').select('*').order('created_at',{ascending:false})
 setItems(data||[])
}
useEffect(()=>{load()},[])

async function upload(files){
 const file=files?.[0]
 if(!file)return
 const valid=file.name.endsWith('.ppt')||file.name.endsWith('.pptx')
 if(!valid){setMsg('Envie apenas PPT/PPTX');return}
 const path=Date.now()+'-'+file.name
 const up=await supabase.storage.from(bucket).upload(path,file)
 if(up.error){setMsg(up.error.message);return}
 const pub=supabase.storage.from(bucket).getPublicUrl(path)
 await supabase.from('ppts').insert({
  nome:file.name,
  caminho:path,
  url:pub.data.publicUrl,
  aplicado:false
 })
 setMsg('Upload realizado com sucesso')
 load()
}

async function toggle(i){
 await supabase.from('ppts').update({aplicado:!i.aplicado}).eq('id',i.id)
 load()
}

async function remove(i){
 await supabase.storage.from(bucket).remove([i.caminho])
 await supabase.from('ppts').delete().eq('id',i.id)
 load()
}

const filtered=items.filter(i=>i.nome?.toLowerCase().includes(query.toLowerCase()))
const aplicados=items.filter(i=>i.aplicado).length

return <div className='app'>
<div className='sidebar'>
<h1>PPT SaaS</h1>
<p>Gerencie apresentações</p>
<button onClick={()=>ref.current.click()}><Upload size={18}/> Upload PPT</button>
<input hidden ref={ref} type='file' accept='.ppt,.pptx' onChange={e=>upload(e.target.files)}/>
</div>

<div className='content'>
<div className='top'>
<div>
<h2>Bem-vindo 👋</h2>
<span>Painel premium de apresentações</span>
</div>
<div className='search'><Search size={18}/><input placeholder='Buscar...' value={query} onChange={e=>setQuery(e.target.value)}/></div>
</div>

{msg && <div className='msg'>{msg}</div>}

<div className='cards'>
<div className='card'><Clock3/><h3>Total</h3><strong>{items.length}</strong></div>
<div className='card green'><CheckCircle2/><h3>Aplicados</h3><strong>{aplicados}</strong></div>
<div className='card orange'><Clock3/><h3>Não aplicados</h3><strong>{items.length-aplicados}</strong></div>
</div>

<div className='table'>
<div className='thead'><span>Arquivo</span><span>Status</span><span>Ações</span></div>
{filtered.map(i=><div className='row' key={i.id}>
<span>{i.nome}</span>
<button className={i.aplicado?'ok':'pending'} onClick={()=>toggle(i)}>
{i.aplicado?'Aplicado':'Não aplicado'}
</button>
<div className='actions'>
<a href={i.url} target='_blank'><Download size={18}/></a>
<button onClick={()=>remove(i)}><Trash2 size={18}/></button>
</div>
</div>)}
</div>
</div>
</div>
}

createRoot(document.getElementById('root')).render(<App/>)
