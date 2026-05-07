
import React,{useEffect,useMemo,useRef,useState}from"react";
import{createRoot}from"react-dom/client";
import{createClient}from"@supabase/supabase-js";
import * as pdfjsLib from"pdfjs-dist";
import pdfWorker from"pdfjs-dist/build/pdf.worker.min.mjs?url";
import{recognize}from"tesseract.js";
import{Upload,FileText,CheckCircle2,Clock3,Search,Trash2,Download,Eye,X,UserRound,CalendarDays,NotebookPen,Award,Printer,FileSignature,Plus,Menu}from"lucide-react";
import"./style.css";
pdfjsLib.GlobalWorkerOptions.workerSrc=pdfWorker;
const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
const BUCKET="ppts";
const today=()=>new Date().toISOString().slice(0,10);



function makeSignatureTransparent(dataUrl){
  return new Promise((resolve)=>{
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img,0,0);

      const image = ctx.getImageData(0,0,c.width,c.height);
      const d = image.data;

      // Detecta a cor média do fundo pelas bordas do recorte
      let sr=0, sg=0, sb=0, count=0;
      const sample = (x,y)=>{
        const i=(y*c.width+x)*4;
        sr+=d[i]; sg+=d[i+1]; sb+=d[i+2]; count++;
      };
      for(let x=0;x<c.width;x+=4){ sample(x,0); sample(x,c.height-1); }
      for(let y=0;y<c.height;y+=4){ sample(0,y); sample(c.width-1,y); }
      const br=sr/count, bg=sg/count, bb=sb/count;

      for(let i=0;i<d.length;i+=4){
        const r=d[i], g=d[i+1], b=d[i+2];

        const distBg = Math.sqrt((r-br)**2 + (g-bg)**2 + (b-bb)**2);
        const light = (r+g+b)/3;

        // Remove fundo branco, cinza, bege e tons próximos ao fundo do recorte
        if(light > 145 || distBg < 70 || (Math.abs(r-g)<22 && Math.abs(g-b)<22 && light>105)){
          d[i+3]=0;
        } else {
          // força a assinatura para preto natural
          d[i]=18;
          d[i+1]=18;
          d[i+2]=18;
          d[i+3]=255;
        }
      }

      ctx.putImageData(image,0,0);

      // Recorta área vazia ao redor da assinatura
      const img2 = ctx.getImageData(0,0,c.width,c.height).data;
      let minX=c.width, minY=c.height, maxX=0, maxY=0;
      for(let y=0;y<c.height;y++){
        for(let x=0;x<c.width;x++){
          const a=img2[(y*c.width+x)*4+3];
          if(a>20){ minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y); }
        }
      }

      if(minX>=maxX || minY>=maxY){
        resolve(c.toDataURL("image/png"));
        return;
      }

      const pad=12;
      minX=Math.max(0,minX-pad); minY=Math.max(0,minY-pad);
      maxX=Math.min(c.width,maxX+pad); maxY=Math.min(c.height,maxY+pad);

      const out=document.createElement("canvas");
      out.width=maxX-minX;
      out.height=maxY-minY;
      out.getContext("2d").drawImage(c,minX,minY,out.width,out.height,0,0,out.width,out.height);
      resolve(out.toDataURL("image/png"));
    };
    img.src=dataUrl;
  });
}

const br=d=>d?new Date(d).toLocaleDateString("pt-BR"):"—";
const mb=s=>s?`${(s/1024/1024).toFixed(1)} MB`:"—";
const kind=n=>(n||"").toLowerCase().endsWith(".pptx")?"PPTX":"PPT";
const office=url=>`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
function crop(c,rx,ry,rw,rh){const o=document.createElement("canvas");o.width=Math.floor(c.width*rw);o.height=Math.floor(c.height*rh);o.getContext("2d").drawImage(c,c.width*rx,c.height*ry,c.width*rw,c.height*rh,0,0,o.width,o.height);return o.toDataURL("image/png")}
function clean(t){return String(t||"").replace(/[0-9|_~`´^*()[\]{}<>]/g," ").replace(/[^A-Za-zÀ-ÿ\s]/g," ").replace(/\s+/g," ").trim()}
async function pdfPage(file){const buf=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data:buf}).promise;const page=await pdf.getPage(1);const vp=page.getViewport({scale:2.5});const c=document.createElement("canvas");c.width=vp.width;c.height=vp.height;await page.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;const tc=await page.getTextContent().catch(()=>({items:[]}));return{canvas:c,text:(tc.items||[]).map(i=>i.str).join("\n")}}
function parseText(text){const lines=String(text||"").split(/\n+/).map(x=>x.trim()).filter(Boolean);const find=l=>{let i=lines.findIndex(x=>x.toLowerCase().includes(l));if(i>=0){let same=lines[i].split(":").slice(1).join(":").trim();return same||lines[i+1]||""}return""};const names=[];for(const line of lines){const x=line.replace(/^\d+\s*/,"").trim();if(/^[A-Za-zÀ-ÿ ]{5,}$/.test(x)&&!/lista|presen|treinamento|instrutor|local|data|assinatura|participante/i.test(x)&&!names.includes(x))names.push(x)}return{curso:find("treinamento"),instrutor:find("instrutor"),data:find("data"),local:find("local"),names:names.slice(0,40)}}
function App(){
const input=useRef(null),pdfInput=useRef(null);
const[items,setItems]=useState([]),[query,setQuery]=useState(""),[filter,setFilter]=useState("todos"),[msg,setMsg]=useState(""),[uploading,setUploading]=useState(false),[preview,setPreview]=useState(null),[cert,setCert]=useState(null),[importing,setImporting]=useState(false),[menu,setMenu]=useState(false);
const[form,setForm]=useState({curso:"",instrutor:"",data:today(),carga:"1 hora",local:"Inno Life Nutrition",obs:"",participantes:[]});
async function load(){const{data,error}=await supabase.from("ppts").select("*").order("created_at",{ascending:false});if(error)setMsg("Erro ao carregar: "+error.message);else setItems(data||[])}
useEffect(()=>{load();if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{})},[]);
const shown=useMemo(()=>items.filter(i=>((i.nome||"").toLowerCase().includes(query.toLowerCase())||(i.responsavel||"").toLowerCase().includes(query.toLowerCase())||(i.observacao||"").toLowerCase().includes(query.toLowerCase()))&&(filter==="todos"||(filter==="aplicados"?i.aplicado:!i.aplicado))),[items,query,filter]);
const applied=items.filter(i=>i.aplicado).length;
async function upload(files){files=Array.from(files||[]);if(!files.length)return;if(files.some(f=>!f.name.toLowerCase().match(/\.pptx?$/))){setMsg("Envie apenas PPT/PPTX");return}setUploading(true);setMsg(`Enviando ${files.length} arquivo(s)...`);for(const f of files){const path=`${Date.now()}-${Math.random().toString(16).slice(2)}-${f.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`;const up=await supabase.storage.from(BUCKET).upload(path,f,{upsert:false});if(up.error){setMsg("Erro no upload: "+up.error.message);setUploading(false);return}const url=supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;const ins=await supabase.from("ppts").insert({nome:f.name,caminho:path,url,tamanho:f.size,aplicado:false,observacao:"",responsavel:"",data_aplicacao:null});if(ins.error){setMsg("Arquivo enviado, mas não salvou: "+ins.error.message);setUploading(false);return}}setMsg("Upload concluído com sucesso.");setUploading(false);input.current&&(input.current.value="");load()}
async function mark(i,v){const{error}=await supabase.from("ppts").update({aplicado:v,data_aplicacao:v?(i.data_aplicacao||today()):null}).eq("id",i.id);if(error)setMsg(error.message);else load()}
async function upd(i,f,v){setItems(p=>p.map(x=>x.id===i.id?{...x,[f]:v}:x));const{error}=await supabase.from("ppts").update({[f]:v||null}).eq("id",i.id);if(error)setMsg("Erro ao salvar: "+error.message)}
async function del(i){if(!confirm("Excluir apresentação?"))return;if(i.caminho)await supabase.storage.from(BUCKET).remove([i.caminho]);await supabase.from("ppts").delete().eq("id",i.id);load()}
function openCert(i){setCert(i);setForm({curso:i.nome||"",instrutor:i.responsavel||"",data:i.data_aplicacao||today(),carga:"1 hora",local:"Inno Life Nutrition",obs:i.observacao||"",participantes:[]})}
function addP(){setForm(f=>({...f,participantes:[...f.participantes,{nome:"",assinatura:""}]}))}
function upP(idx,field,val){setForm(f=>({...f,participantes:f.participantes.map((p,i)=>i===idx?{...p,[field]:val}:p)}))}
function rmP(idx){setForm(f=>({...f,participantes:f.participantes.filter((_,i)=>i!==idx)}))}

async function importPdf(file){
if(!file)return;
setImporting(true);
setMsg("Importando PDF e lendo nomes/assinaturas...");
try{
const {canvas,text}=await pdfPage(file);
const parsed=parseText(text);

let parts=[];

if(parsed.names && parsed.names.length){
for(let i=0;i<parsed.names.length;i++){
const assinaturaOriginal=crop(canvas,.39,.398+i*.11,.52,.095);
const assinatura=await makeSignatureTransparent(assinaturaOriginal);
parts.push({nome:parsed.names[i],assinatura});
}
}

if(!parts.length){
for(let i=0;i<10;i++){
const nameImg=crop(canvas,.13,.398+i*.11,.24,.095);
const r=await recognize(nameImg,"por");
const nome=clean(r?.data?.text);
if(nome&&nome.length>3){
const assinaturaOriginal=crop(canvas,.39,.398+i*.11,.52,.095);
const assinatura=await makeSignatureTransparent(assinaturaOriginal);
parts.push({nome,assinatura});
}
}
}

setForm(f=>({
...f,
curso:parsed.curso||f.curso,
instrutor:parsed.instrutor||f.instrutor,
data:parsed.data?parsed.data.split("/").reverse().join("-"):f.data,
local:parsed.local||f.local,
participantes:parts
}));

setMsg(parts.length?`${parts.length} participante(s) importado(s). Revise antes de baixar PDF.`:"Não consegui ler nomes automaticamente. Adicione manualmente.");
}catch(e){
setMsg("Erro ao importar PDF: "+(e?.message||e));
}
setImporting(false);
if(pdfInput.current)pdfInput.current.value="";
}


function printCertificatesOnly(){
const certs=document.querySelectorAll(".certificate");
if(!certs.length){ alert("Nenhum certificado para baixar PDF."); return; }
const styles=`
@page{
size:A4 portrait;
margin:0;
}

html,body{
margin:0;
padding:0;
background:#fff;
font-family:Arial,sans-serif;
-webkit-print-color-adjust:exact;
print-color-adjust:exact;
}

.printPage{
width:210mm;
height:297mm;
display:flex;
align-items:center;
justify-content:center;
overflow:hidden;
page-break-after:always;
break-after:page;
background:white;
}

.certBorder{
width:180mm;
height:257mm;
margin:auto;
border:6px double #7f7f7f;
border-radius:12px;
padding:10mm;
box-sizing:border-box;
background:#f9f7f1;
overflow:hidden;
position:relative;
}

.certLogo{
max-width:220px;
max-height:70px;
object-fit:contain;
}

h1{
font-size:30px;
margin:8px 0;
}

h2{
font-size:18px;
margin:10px 0;
}

h3{
font-size:16px;
margin:8px 0;
}

.certInfo{
display:grid;
grid-template-columns:1fr 1fr;
gap:8px;
margin-top:14px;
}

.certInfo span{
padding:8px;
font-size:12px;
border:1px solid #ccc;
border-radius:8px;
background:#fff;
}

.signs{
display:grid;
grid-template-columns:1fr 1fr;
gap:30px;
margin-top:28px;
}

.signs img{
max-width:180px;
max-height:55px;
object-fit:contain;
background:transparent!important;
}

.signs i{
display:block;
height:28px;
border-bottom:1px solid #000;
}

footer{
position:absolute;
bottom:10px;
left:0;
right:0;
font-size:10px;
text-align:center;
}
`;
const html=Array.from(certs).map(c=>`<section class="printPage">${c.querySelector(".certBorder").outerHTML}</section>`).join("");
const win=window.open("","_blank");
win.document.write(`<!doctype html><html><head><title>Certificados TreinerLife</title><style>${styles}</style></head><body>${html}<script>window.onload=()=>{setTimeout(()=>window.print(),500)}<\/script></body></html>`);
win.document.close();
}

const certParts=form.participantes.length?form.participantes:[{nome:"Nome do Participante",assinatura:""}];
return <div className="app">
<aside className={menu?"side open":"side"}><div className="brand"><div className="logo">P</div><div><b>TreinerLife</b><span>Treinamentos Premium</span></div></div><button className="active">Dashboard</button><button onClick={()=>input.current.click()}><Upload/> Upload múltiplo</button><button onClick={()=>setFilter("aplicados")}><CheckCircle2/> Aplicados</button><button onClick={()=>setFilter("nao")}><Clock3/> Não aplicados</button><div className="cardMini"><Award/><b>Certificados A4</b><p>Importe PDF da presença e gere um certificado por participante.</p></div></aside>
<main className="main"><button className="mobile" onClick={()=>setMenu(!menu)}><Menu/></button><header className="hero"><div><small>Dashboard premium</small><h1>Treinamentos, PPTs e certificados em lote</h1><p>Abra o PPT dentro do app e gere certificados A4 com logo, nome e assinatura da lista de presença.</p></div><button className="primary" onClick={()=>input.current.click()} disabled={uploading}><Upload/> {uploading?"Enviando...":"Upload PPT/PPTX"}</button><input ref={input} hidden multiple type="file" accept=".ppt,.pptx" onChange={e=>upload(e.target.files)}/></header>
{msg&&<div className={msg.includes("sucesso")||msg.includes("importado")?"toast ok":"toast"}>{msg}</div>}
<section className="metrics"><article><FileText/><span>Total</span><b>{items.length}</b></article><article className="green"><CheckCircle2/><span>Aplicados</span><b>{applied}</b></article><article className="orange"><Clock3/><span>Não aplicados</span><b>{items.length-applied}</b></article><article className="purple"><Award/><span>Certificado</span><b>A4</b></article></section>
<section className="drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();upload(e.dataTransfer.files)}} onClick={()=>input.current.click()}><Upload/><h2>Arraste seus PPTs aqui</h2><p>Upload múltiplo .ppt e .pptx</p></section>
<section className="panel"><div className="top"><div><h2>Apresentações</h2><p>{shown.length} resultado(s)</p></div><div className="filters"><div className="search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar..."/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="todos">Todos</option><option value="aplicados">Aplicados</option><option value="nao">Não aplicados</option></select></div></div>
<div className="table"><div className="thead"><span>Arquivo</span><span>Status</span><span>Data</span><span>Responsável</span><span>Observação</span><span>Ações</span></div>{shown.map(i=><div className="row" key={i.id}><div className="file"><div className="thumb">{kind(i.nome)}</div><div><b>{i.nome}</b><small>{mb(i.tamanho)}</small></div></div><button className={i.aplicado?"st ok":"st pend"} onClick={()=>mark(i,!i.aplicado)}>{i.aplicado?"Aplicado":"Não aplicado"}</button><input type="date" value={i.data_aplicacao||""} onChange={e=>upd(i,"data_aplicacao",e.target.value)}/><input value={i.responsavel||""} onChange={e=>upd(i,"responsavel",e.target.value)} placeholder="Responsável"/><textarea value={i.observacao||""} onChange={e=>upd(i,"observacao",e.target.value)} placeholder="Observações"/><div className="actions"><button title="Abrir no app" onClick={()=>setPreview(i)}><Eye/></button><button className="cert" title="Certificados" onClick={()=>openCert(i)}><Award/></button><a href={i.url} target="_blank"><Download/></a><button className="danger" onClick={()=>del(i)}><Trash2/></button></div></div>)}</div></section></main>
{preview&&<div className="modal" onClick={()=>setPreview(null)}><div className="viewer" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setPreview(null)}><X/></button><div className="viewerTop"><div><h2>{preview.nome}</h2><p>Preview via Office Online Viewer. O arquivo precisa estar público no Supabase.</p></div><a className="primary" href={preview.url} target="_blank"><Download/>Baixar</a></div><iframe src={office(preview.url)} title="PPT Preview"></iframe></div></div>}
{cert&&<div className="modal certModal" onClick={()=>setCert(null)}><div className="certWrap" onClick={e=>e.stopPropagation()}><button className="close noPrint" onClick={()=>setCert(null)}><X/></button><div className="certForm noPrint"><h2><Award/> Certificados em lote</h2><p>Importe a lista de presença em PDF. O app tenta ler os nomes e recortar as assinaturas. Revise antes de baixar PDF.</p><div className="grid"><label>Nome do curso<input value={form.curso} onChange={e=>setForm({...form,curso:e.target.value})}/></label><label>Instrutor<input value={form.instrutor} onChange={e=>setForm({...form,instrutor:e.target.value})}/></label><label>Data<input type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})}/></label><label>Carga horária<input value={form.carga} onChange={e=>setForm({...form,carga:e.target.value})}/></label><label>Local<input value={form.local} onChange={e=>setForm({...form,local:e.target.value})}/></label><label>Observações<input value={form.obs} onChange={e=>setForm({...form,obs:e.target.value})}/></label></div><div className="certTools"><button className="secondary" onClick={()=>pdfInput.current.click()} disabled={importing}><FileSignature/> {importing?"Importando...":"Importar lista PDF"}</button><button className="secondary" onClick={addP}><Plus/> Adicionar participante</button><button className="primary" onClick={()=>setTimeout(()=>window.print(),300)}><Printer/> Baixar / baixar PDF todos</button><input ref={pdfInput} hidden type="file" accept=".pdf,application/pdf" onChange={e=>importPdf(e.target.files?.[0])}/></div><div className="participants">{form.participantes.map((p,idx)=><div className="pline" key={idx}><span>{String(idx+1).padStart(2,"0")}</span><input value={p.nome} onChange={e=>upP(idx,"nome",e.target.value)} placeholder="Nome"/>{p.assinatura?<img src={p.assinatura}/>:<em>sem assinatura</em>}<button onClick={()=>rmP(idx)}><Trash2/></button></div>)}</div></div><div className="certPages">{certParts.map((p,idx)=><section className="certificate" key={idx}><div className="certBorder"><img className="certLogo" src="/logo-inno-life.webp"/><div className="seal"><Award/></div><p className="certSmall">Certificado de Conclusão</p><h1>CERTIFICADO</h1><p>Certificamos que</p><h2>{p.nome||"Nome do Participante"}</h2><p>participou e concluiu o treinamento</p><h3>{form.curso||cert.nome}</h3><div className="certInfo"><span><b>Data:</b> {br(form.data)}</span><span><b>Carga horária:</b> {form.carga}</span><span><b>Instrutor:</b> {form.instrutor||cert.responsavel||"—"}</span><span><b>Local:</b> {form.local}</span></div>{form.obs&&<p className="obsCert">{form.obs}</p>}<div className="signs"><div><i></i><p>Responsável / Instrutor</p></div><div>{p.assinatura?<img src={p.assinatura}/>:<i></i>}<p>Assinatura do Participante</p></div></div><footer>Inno Life Nutrition • Transformando conhecimento em qualidade de vida.</footer></div></section>)}</div></div></div>}
</div>
}
createRoot(document.getElementById("root")).render(<App/>);


// PDF only mode enabled
