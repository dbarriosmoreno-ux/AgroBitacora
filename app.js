'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);
const localDate=(d=new Date())=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const tabs=['Lotes','Historial','Agenda','Balance','Copias'];
const types=['Siembra','Trasplante','Riego','Aplicación','Monitoreo','Labor','Cosecha'];
const lotFields=['Nombre del lote*','Cultivo*','Variedad','Predio / ubicación','Fecha de siembra:d','Fecha de trasplante:d','Área (m²):n','Plantas iniciales:n','Bolsa (L):n','Tratamiento','Arena (%):p','Cascarilla (%):p','Fibra de coco (%):p','Tierra negra (%):p','Otros componentes','Observaciones:m'];
const common=['Fecha*:d','Planta / sublote','Responsable'];
const specific={
 Siembra:['Semilla / procedencia','Lote de semilla','Semillas sembradas:n','Distancia de siembra'],
 Trasplante:['Plantas trasplantadas:n','Plantas perdidas:n'],
 Riego:['Método','Volumen aplicado (L):n','Drenaje (L):n','pH del agua:h','CE del agua (µS/cm):n','pH del drenaje:h','CE del drenaje (µS/cm):n'],
 Aplicación:['Producto / insumo','Finalidad','Dosis y unidad','Cantidad utilizada y unidad','Volumen de mezcla (L):n','Método','pH antes del ajuste:h','Corrector y cantidad','pH final:h','CE final (µS/cm):n','Fin de carencia según etiqueta:d','Fin de reingreso según etiqueta:d'],
 Monitoreo:['Etapa fenológica','Altura (cm):n','Hojas verdaderas:n','Plaga / enfermedad / síntoma','Plantas evaluadas:n','Plantas afectadas:n','Severidad (%) estimada:p','Temperatura (°C):t','Lluvia (mm):n','Acción de seguimiento'],
 Labor:['Actividad realizada','Horas de trabajo:n'],
 Cosecha:['Peso comercial (kg)*:n','Descarte (kg):n','Destino / comprador','Ingreso real (COP):n']
};
const costFields=['Costo de insumos (COP):n','Mano de obra (COP):n','Otros costos (COP):n'];
const taskFields=['Labor pendiente*','Fecha prevista*:d','Responsable','Observaciones:m'];
const key=s=>s.split(':')[0].replace('*','');
let db,rows=[],tab='Lotes',filter='',offlineReady=false;
const lots=()=>rows.filter(x=>x.kind==='lot');
const events=()=>rows.filter(x=>x.kind==='event');
const tasks=()=>rows.filter(x=>x.kind==='task');
const find=id=>rows.find(x=>x.id===id);
const lotName=id=>find(id)?.data['Nombre del lote']||'';
const filtered=a=>a.filter(x=>!filter||x.lot===filter);
const byRecent=(a,b)=>b.data.Fecha.localeCompare(a.data.Fecha);
const num=(x,k)=>Number(x.data[k])||0;
const cost=e=>costFields.reduce((a,f)=>a+num(e,key(f)),0);
function toast(s){$('#message').textContent=s;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#message').textContent='',5000)}
function status(){ $('#status').textContent=(navigator.onLine?'Con conexión':'Sin conexión')+(offlineReady?' · Disponible sin señal':'') }
function transaction(fn){return new Promise((ok,fail)=>{const tx=db.transaction('items','readwrite');fn(tx.objectStore('items'));tx.oncomplete=ok;tx.onabort=()=>fail(tx.error||Error('Escritura cancelada'));tx.onerror=()=>fail(tx.error)})}
async function reload(){rows=await new Promise((ok,fail)=>{const r=db.transaction('items').objectStore('items').getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error)});render()}
const btn=(label,action,id='',cls='')=>'<button class="'+cls+'" data-act="'+action+'" data-id="'+esc(id)+'">'+esc(label)+'</button>';
const empty=s=>'<p class="empty">'+esc(s)+'</p>';
const tag=(s,l=false)=>'<span class="tag '+(l?'late':'')+'">'+esc(s)+'</span>';
const details=o=>Object.entries(o).filter(([,v])=>v!=='').map(([k,v])=>'<div><b>'+esc(k)+'</b> · '+esc(v)+'</div>').join('');
function selector(value){return lots().map(l=>'<option value="'+esc(l.id)+'" '+(value===l.id?'selected':'')+'>'+esc(l.data['Nombre del lote'])+' · '+esc(l.data.Cultivo)+'</option>').join('')}
function stats(pairs){return '<div class="stats">'+pairs.map(([v,k])=>'<div class="stat"><strong>'+esc(v)+'</strong>'+esc(k)+'</div>').join('')+'</div>'}
function protections(es){return es.flatMap(e=>['Fin de carencia según etiqueta','Fin de reingreso según etiqueta'].filter(k=>e.data[k]>=localDate()).map(k=>'<article>'+tag('Fecha de etiqueta',true)+' <b>'+esc(lotName(e.lot))+'</b> · '+esc(e.data['Producto / insumo'])+'<p>'+esc(k)+' · '+esc(e.data[k])+'</p></article>')).join('')}
function render(){
 $('nav').innerHTML=tabs.map(t=>btn(t,'tab',t,tab===t?'active':'')).join('');
 const es=filtered(events()).sort(byRecent),ts=filtered(tasks()).sort((a,b)=>a.data['Fecha prevista'].localeCompare(b.data['Fecha prevista']));
 const sc=tab!=='Lotes'&&tab!=='Copias'?'<label>Consultar lote<select id="filter"><option value="">Todos los lotes</option>'+selector(filter)+'</select></label>':'';
 let body='';
 if(tab==='Lotes'){
 body=stats([[lots().length,'Lotes'],[events().length,'Registros'],[tasks().filter(t=>!t.done&&t.data['Fecha prevista']<=localDate()).length,'Labores para hoy o vencidas']])+'<div class="row"><h2>Mis lotes</h2>'+btn('Crear lote','lot','','primary')+'</div>';
 body+=lots().length?'<div class="grid">'+lots().map(l=>'<article>'+tag(l.data.Cultivo)+'<h3>'+esc(l.data['Nombre del lote'])+'</h3><p>'+esc([l.data.Variedad,l.data.Tratamiento,l.data['Predio / ubicación']].filter(Boolean).join(' · '))+'</p><details><summary>Ficha técnica</summary>'+details(l.data)+'</details><div class="actions">'+btn('Registrar labor','event',l.id)+btn('Historial','history',l.id)+btn('Editar','edit',l.id)+'</div></article>').join('')+'</div>':empty('Crea tu primer lote. Para comparar sustratos, registra un lote por tratamiento dentro del mismo ciclo.');
 }else if(tab==='Historial'){
 body='<div class="row"><h2>Historial de campo</h2>'+btn('Nuevo registro','event',filter,'primary')+'</div>'+sc+(filter?'<article><h3>Ficha del lote</h3>'+details(find(filter).data)+'</article>':'')+es.map(e=>'<article>'+tag(e.type)+' <b>'+esc(lotName(e.lot))+'</b> · '+esc(e.data.Fecha)+'<div class="details">'+esc(e.data.Observaciones)+'</div><details><summary>Ver registro'+(e.photos?.length?' y fotos ('+e.photos.length+')':'')+'</summary>'+details(e.data)+(e.photos||[]).map(p=>'<img loading="lazy" class="photo" alt="Fotografía del registro" src="'+esc(p)+'">').join('')+'</details>'+btn('Editar','edit',e.id)+'</article>').join('')+(es.length?'':empty('Aún no hay labores registradas para esta selección.'))+btn('Imprimir / PDF','print');
 }else if(tab==='Agenda'){
 body='<div class="row"><h2>Cronograma</h2>'+btn('Programar labor','task',filter,'primary')+'</div>'+sc+protections(es)+ts.map(t=>{const d=t.data['Fecha prevista'],late=!t.done&&d<=localDate();return '<article>'+tag(t.done?'Realizada':late?(d===localDate()?'Hoy':'Vencida'):'Programada',late)+' <b>'+esc(t.data['Labor pendiente'])+'</b><p>'+esc(d)+' · '+esc(lotName(t.lot))+'</p>'+details({Responsable:t.data.Responsable,Observaciones:t.data.Observaciones})+'<div class="actions">'+btn(t.done?'Reabrir':'Marcar realizada','toggle',t.id)+btn('Editar','edit',t.id)+'</div></article>'}).join('')+(ts.length?'':empty('Programa la próxima visita, aplicación o cosecha. Las alertas aparecen aquí al abrir la app.'));
 }else if(tab==='Balance'){
 const sum=(arr,fn)=>arr.reduce((a,e)=>a+fn(e),0),tot=sum(es,cost),income=sum(es,e=>num(e,'Ingreso real (COP)'));
 body='<h2>Balance del ciclo</h2>'+sc+stats([[money(tot),'Costos registrados'],[money(income),'Ingresos reales'],[money(income-tot),'Saldo registrado']])+'<h3>Resultados por lote y tratamiento</h3><div class="grid">'+lots().filter(l=>!filter||l.id===filter).map(l=>{
 const a=es.filter(e=>e.lot===l.id),kg=sum(a,e=>num(e,'Peso comercial (kg)')),out=sum(a,cost),area=num(l,'Área (m²)');
 return '<article>'+tag(l.data.Tratamiento||l.data.Cultivo)+'<h3>'+esc(lotName(l.id))+'</h3>'+details({'Comercial (kg)':kg,'Descarte (kg)':sum(a,e=>num(e,'Descarte (kg)')),'kg/m²':area?(kg/area).toFixed(2):'Falta área','Costo por kg comercial':kg?money(out/kg):'Pendiente de cosecha','Costos':money(out)})+'</article>'}).join('')+'</div>'+btn('Imprimir / PDF','print');
 }else{
 body='<h2>Copias y descargas</h2><article><h3>Respaldo completo</h3><p>Incluye lotes, labores, agenda y fotografías. Guarda una copia antes de borrar datos del navegador o cambiar de celular.</p><div class="actions">'+btn('Descargar copia JSON','backup','','primary')+btn('Compartir con Drive','share')+btn('Recuperar copia','restore')+'</div><input type="file" id="restoreFile" accept=".json,application/json" hidden></article><article><h3>Datos para análisis</h3><p>Descarga los registros de todos tus lotes en una tabla compatible con Excel.</p>'+btn('Exportar CSV','csv')+'</article>';
 }
 $('#view').innerHTML=body;
}
function input(f,data){const name=key(f),type=f.split(':')[1],v=esc(data[name]??(name==='Fecha'||name==='Fecha prevista'?localDate():'')),required=f.includes('*')?' required':'';
 const attr=' name="'+esc(name)+'"'+required;
 return '<label>'+esc(name)+(required?' *':'')+(type==='m'?'<textarea'+attr+'>'+v+'</textarea>':'<input'+attr+' value="'+v+'" type="'+(type==='d'?'date':type?'number':'text')+'" '+(type&&type!=='d'?'step="any" '+(type!=='t'?'min="0" ':'')+(type==='p'?'max="100"':type==='h'?'max="14"':''):'')+(name==='Producto / insumo'?' list="products"':'')+'>')+'</label>'}
let editing;
function showForm(kind,lotId,old){if(kind!=='lot'&&!lots().length){toast('Primero crea un lote.');return}
 editing={kind,lotId,old};const data=old?.data||{};
 $('#title').textContent=({lot:'Ficha de lote',event:'Registro de campo',task:'Programar labor'})[kind];
 const group=fs=>'<div class="inputs">'+fs.map(f=>input(f,data)).join('')+'</div>';
 $('#fields').innerHTML=(kind==='lot'?'':'<label>Lote<select required name="_lot">'+selector(old?.lot||lotId)+'</select></label>')+(kind==='lot'?group(lotFields):kind==='task'?group(taskFields):'<label>Tipo de registro<select name="_type">'+types.map(t=>'<option '+(t===old?.type?'selected':'')+'>'+t+'</option>').join('')+'</select></label>'+group(common)+'<section id="specific"></section>'+group(costFields)+input('Observaciones:m',data)+'<label>Adjuntar fotografías<input id="photos" type="file" multiple accept="image/*"></label><small>Las fotos se guardan en el celular junto al registro.</small><datalist id="products">'+['Irricol Inicio','Humus líquido','Agrimis K–Ca–B','Sulfex Mg'].map(n=>'<option>'+n+'</option>').join('')+'</datalist>');
 if(kind==='event'){const sel=$('[name="_type"]');if(old)sel.disabled=true;const change=()=>$('#specific').innerHTML=group(specific[sel.value]);sel.onchange=change;change()}
 $('#editor').showModal();
}
async function photo(file){const bitmap=await createImageBitmap(file);const s=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bitmap.width*s));c.height=Math.max(1,Math.round(bitmap.height*s));c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();return c.toDataURL('image/jpeg',.8)}
$('#form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{
 const {kind,old}=editing,data=Object.fromEntries(new FormData(e.target));delete data._lot;delete data._type;
 const row={...old,id:old?.id||crypto.randomUUID(),kind,data,updated:new Date().toISOString()};
 if(kind==='lot'&&lotFields.filter(f=>f.endsWith(':p')).reduce((s,f)=>s+Number(data[key(f)]||0),0)>100.00001)throw Error('Las proporciones del sustrato superan el 100 %.');
 if(kind!=='lot')row.lot=$('[name="_lot"]').value;
 if(kind==='event'){row.type=$('[name="_type"]').value;row.photos=[...(old?.photos||[])];for(const f of $('#photos').files)row.photos.push(await photo(f))}
 await transaction(st=>st.put(row));$('#editor').close();await reload();toast('Guardado en este dispositivo.');
 }catch(err){alert('No se pudo guardar. '+err.message)}finally{b.disabled=false}};
$('#close').onclick=()=>$('#editor').close();
function download(file){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}
function backup(){return new File([JSON.stringify({app:'AgroBitacora',version:1,items:rows})],'AgroBitacora-'+localDate()+'.json',{type:'application/json'})}
function validate(pack){
 if(pack?.app!=='AgroBitacora'||pack.version!==1||!Array.isArray(pack.items))throw Error('Formato de copia incompatible.');
 const ids=new Set(),ls=new Set();
 for(const r of pack.items){
 if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||!['lot','event','task'].includes(r.kind)||!r.data||Array.isArray(r.data)||typeof r.data!=='object'||Object.values(r.data).some(v=>typeof v!=='string'))throw Error('Registro inválido.');
 ids.add(r.id);if(r.kind==='lot'){if(!r.data['Nombre del lote']||!r.data.Cultivo)throw Error('Ficha incompleta.');ls.add(r.id)}
 if(r.kind==='event'&&(!types.includes(r.type)||!r.data.Fecha||!Array.isArray(r.photos)||r.photos.some(p=>typeof p!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p))))throw Error('Registro de campo incompleto.');
 if(r.kind==='task'&&(!r.data['Labor pendiente']||!r.data['Fecha prevista']))throw Error('Labor incompleta.');
 }if(pack.items.some(r=>r.kind!=='lot'&&!ls.has(r.lot)))throw Error('Falta un lote relacionado.');
}
function csv(){const objects=rows.map(r=>({'ID':r.id,'Clase':({lot:'Ficha',task:'Agenda',event:'Registro'})[r.kind],'Lote':r.kind==='lot'?lotName(r.id):lotName(r.lot),'Tipo':r.type||'','Estado':r.kind==='task'?(r.done?'Realizada':'Pendiente'):'',...r.data}));
 const keys=[...new Set(['ID','Clase','Lote',...objects.flatMap(Object.keys)])],cell=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'};
 download(new File(['\uFEFF'+[keys,...objects.map(o=>keys.map(k=>o[k]))].map(row=>row.map(cell).join(';')).join('\r\n')],'AgroBitacora-'+localDate()+'.csv',{type:'text/csv;charset=utf-8'}))}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-act]');if(!b)return;
 const {act,id}=b.dataset;try{if(act==='tab'){tab=id;render()}else if(['lot','event','task'].includes(act))showForm(act,id);else if(act==='edit'){const old=find(id);showForm(old.kind,old.lot,old)}else if(act==='history'){filter=id;tab='Historial';render()}else if(act==='toggle'){const t=find(id);await transaction(st=>st.put({...t,done:!t.done,updated:new Date().toISOString()}));await reload()}else if(act==='print')window.print();else if(act==='csv')csv();else if(act==='backup')download(backup());else if(act==='share'){const f=backup();if(navigator.canShare?.({files:[f]}))await navigator.share({files:[f],title:'Copia AgroBitácora'});else{download(f);toast('Copia descargada. En Drive, selecciona Nuevo y Subir archivo.')}}else if(act==='restore')$('#restoreFile').click()}catch(err){if(err.name!=='AbortError')alert(err.message)}});
document.addEventListener('change',async e=>{if(e.target.id==='filter'){filter=e.target.value;render()}if(e.target.id!=='restoreFile'||!e.target.files.length)return;try{const pack=JSON.parse(await e.target.files[0].text());validate(pack);const fresh=pack.items.filter(r=>!find(r.id));const conflicts=pack.items.filter(r=>find(r.id)&&JSON.stringify(find(r.id))!==JSON.stringify(r));if(conflicts.length&&!confirm(conflicts.length+' registros existentes son distintos. ¿Actualizar esos registros con los de la copia? Cancelar importa únicamente los nuevos.'))conflicts.length=0;
 await transaction(st=>[...fresh,...conflicts].forEach(r=>st.put(r)));await reload();toast(fresh.length+' nuevos y '+conflicts.length+' actualizados.')}catch(err){alert('No se pudo importar. '+err.message)}finally{e.target.value=''}});
$('#fecha').textContent=new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const opening=indexedDB.open('agrobitacora-campo',1);opening.onupgradeneeded=()=>opening.result.createObjectStore('items',{keyPath:'id'});opening.onsuccess=()=>{db=opening.result;reload().catch(e=>alert(e.message))};opening.onerror=()=>alert('No se pudo abrir el almacenamiento del cuaderno.');
window.addEventListener('online',status);window.addEventListener('offline',status);status();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{offlineReady=true;status()}).catch(()=>toast('Pendiente de preparar el acceso sin señal. Abre con conexión.'));
