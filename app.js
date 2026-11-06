

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').toLowerCase();
function toISO(d){if(!d)return '0000';const m=String(d).match(/(\d{2})\.(\d{2})\.(\d{4})/);return m?m[3]+m[2]+m[1]:String(d);}
function parseDMY(s){const m=(s||'').match(/(\d{2})\.(\d{2})\.(\d{4})/);if(!m)return null;const d=new Date(+m[3],+m[2]-1,+m[1]);d.setHours(0,0,0,0);return d;}
const today0=()=>{const d=new Date();d.setHours(0,0,0,0);return d;};
const daysUntil=dt=>Math.round((dt-today0())/864e5);
const dmy=dt=>dt.toLocaleDateString('ru-RU');
function statusBadge(s){const m={'подписан':'b-green','подготовлен':'b-blue','идёт подготовка':'b-amber','запланирован к подготовке':'b-amber','не готовим':'b-gray','истекла':'b-red','действует':'b-green','без срока':'b-gray'};return s?`<span class="badge ${m[s]||'b-gray'}">${esc(s)}</span>`:'';}
const contourBadge=v=>(v==='да'||v==='true')?'<span class="badge b-red">внутренний контур</span>':'';
function toast(msg,err){const t=$('#toast');t.textContent=msg;t.className=err?'err':'';t.style.display='block';clearTimeout(t._tm);t._tm=setTimeout(()=>t.style.display='none',err?6000:3000);}
function openModal(html){$('#modal').innerHTML=html;$('#modal').classList.add('open');$('#overlay').classList.add('open');}
function closeModal(){$('#modal').classList.remove('open');$('#overlay').classList.remove('open');}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
function safeLink(u){return /^https?:\/\//i.test(u)?u:'https://'+u;}

async function encryptToken(token,keyText){
  if(!token)return '';
  const key=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(keyText));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey=await crypto.subtle.importKey('raw',key,{name:'AES-GCM'},false,['encrypt']);
  const enc=await crypto.subtle.encrypt({name:'AES-GCM',iv},cryptoKey,new TextEncoder().encode(token));
  const combined=new Uint8Array(iv.length+enc.byteLength);
  combined.set(iv);combined.set(new Uint8Array(enc),iv.length);
  return btoa(String.fromCharCode(...combined));
}
async function decryptToken(cipher,keyText){
  if(!cipher)return '';
  try{
    const data=Uint8Array.from(atob(cipher),c=>c.charCodeAt(0));
    const iv=data.slice(0,12);const enc=data.slice(12);
    const key=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(keyText));
    const cryptoKey=await crypto.subtle.importKey('raw',key,{name:'AES-GCM'},false,['decrypt']);
    const dec=await crypto.subtle.decrypt({name:'AES-GCM',iv},cryptoKey,enc);
    return new TextDecoder().decode(dec);
  }catch(e){return '';}
}

async function hashPass(s,salt){
  const text=(salt||'')+s;
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
let SESSION=null;
function checkSession(){const s=sessionStorage.getItem('reestr_session');if(s){try{SESSION=JSON.parse(s);return true;}catch(e){}}return false;}
function saveSession(){if(SESSION)sessionStorage.setItem('reestr_session',JSON.stringify(SESSION));}
function clearSession(){SESSION=null;sessionStorage.removeItem('reestr_session');}
async function doLogin(){const l=$('#liLogin').value.trim(),p=$('#liPass').value.trim(),err=$('#liErr');if(!l||!p){err.textContent='Введите логин и пароль';return;}const u=(DB.users||[]).find(x=>x.login===l);if(!u){err.textContent='Пользователь не найден';return;}const salt=SET.salt||'reestr-default-salt';const newHash=await hashPass(p,salt);let ok=false;if(u.password_hash===newHash)ok=true;else if(/^\d{8,10}$/.test(u.password_hash)){const oldH=String((()=>{let h=0;for(let i=0;i<p.length;i++){h=(h<<5)-h+p.charCodeAt(i);h|=0;}return h>>>0;})());if(u.password_hash===oldH){ok=true;u.password_hash=newHash;scheduleSave();}}if(!ok){err.textContent='Неверный пароль';return;}SESSION={login:u.login,name:u.name,role:u.role,time:Date.now()};saveSession();$('#loginOverlay').style.display='none';$('#userMenu').style.display='flex';$('#userMenu').innerHTML=`<span>${esc(SESSION.name)}</span><button onclick="doLogout()">Выйти</button>`;if(SET.name!==SESSION.name){SET.name=SESSION.name;saveSet();}toast('Добро пожаловать, '+SESSION.name);renderTabs();render();}function doLogout(){clearSession();$('#loginOverlay').style.display='flex';$('#userMenu').style.display='none';$('#liPass').value='';$('#liErr').textContent='';}
function requireAuth(){if(!SESSION){$('#loginOverlay').style.display='flex';return false;}return true;}

function personLink(id,name){return `<span class="linkish" onclick="event.stopPropagation();openPerson('${esc(id)}')">${esc(name)}</span>`;}
function personName(id){const p=DB.persons.find(x=>String(x.ID)===String(id));return p?p['Полное наименование']:('⚠ id '+id);}
function personOpts(sel){return DB.persons.slice().sort((a,b)=>a['Полное наименование'].localeCompare(b['Полное наименование'],'ru')).map(p=>`<option value="${esc(p.ID)}" ${String(p.ID)===String(sel)?'selected':''}>${esc(p['Полное наименование'])}</option>`).join('');}

const _defaults={"name":"","token":"","path":"/Реестр/data.json","autosend":"нет","tgtoken":"","tgchat":"","salt":"","dbx_key":"36iq45so7u65h9s","dbx_secret":"rhrpa2vk7ujx4mc","dbx_at":"","dbx_rt":"","dbx_exp":0};
const _saved=JSON.parse(localStorage.getItem('reestr_set')||'{}');
for(const k in _saved){if(_saved[k]===''||_saved[k]===null||_saved[k]===undefined)delete _saved[k];}
let SET=Object.assign(_defaults,_saved);
let DBX={at:SET.dbx_at||'',rt:SET.dbx_rt||'',exp:SET.dbx_exp||0};if(!DBX.rt&&SET.dbx_rt)DBX.rt=SET.dbx_rt;
let REV=null,SAVING=false,DIRTY=false;
function encPath(p){return String(p).split('/').map(seg=>encodeURIComponent(seg)).join('/');}
function saveSet(){localStorage.setItem('reestr_set',JSON.stringify(SET));}
async function persistDbx(){SET.dbx_at=DBX.at;SET.dbx_exp=DBX.exp;const key=(SET.salt||'reestr-default-salt')+'-token-key';SET.dbx_rt=await encryptToken(DBX.rt,key);saveSet();}
async function dbxToken(){
  if(DBX.rt&&DBX.at&&Date.now()<DBX.exp-60000)return DBX.at;
  if(SET.dbx_rt){
    const key=(SET.salt||'reestr-default-salt')+'-token-key';
    const rt=await decryptToken(SET.dbx_rt,key);
    if(rt)DBX.rt=rt;
  }
  if(DBX.rt){
    const r=await fetch('https://api.dropboxapi.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:DBX.rt,client_id:SET.dbx_key,client_secret:SET.dbx_secret})});
    const j=await r.json();
    if(!r.ok)throw new Error('Сессия Dropbox истекла — подключите заново в Настройках ('+(j.error_description||j.error||'')+')');
    DBX.at=j.access_token;DBX.exp=Date.now()+j.expires_in*1000;await persistDbx();return DBX.at;
  }
  if(SET.token)return SET.token;
  throw new Error('Dropbox не подключён — укажите App key/App secret в Настройках');
}async function dbx(path,args){const t=await dbxToken();const ctrl=new AbortController();const tm=setTimeout(()=>ctrl.abort(),15000);try{const r=await fetch('https://api.dropboxapi.com/2/'+path,{method:'POST',signal:ctrl.signal,headers:{'Authorization':'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify(args||{})});clearTimeout(tm);if(!r.ok)throw new Error(r.status+' '+(await r.text()));return r;}catch(e){clearTimeout(tm);if(e.name==='AbortError')throw new Error('Таймаут Dropbox (15 сек)');throw e;}}
async function dbxDownload(){const t=await dbxToken();const ctrl=new AbortController();const tm=setTimeout(()=>ctrl.abort(),15000);try{const r=await fetch('https://api.dropboxapi.com/2/files/download',{method:'POST',signal:ctrl.signal,headers:{'Authorization':'Bearer '+t,'Dropbox-API-Arg':JSON.stringify({path:encPath(SET.path)})}});clearTimeout(tm);if(!r.ok)throw new Error(r.status+' '+(await r.text()));return {text:await r.text(),rev:(JSON.parse(r.headers.get('dropbox-api-result')||'{}')).rev};}catch(e){clearTimeout(tm);if(e.name==='AbortError')throw new Error('Таймаут скачивания (15 сек)');throw e;}}
async function dbxUpload(text){const t=await dbxToken();const ctrl=new AbortController();const tm=setTimeout(()=>ctrl.abort(),15000);try{const r=await fetch('https://content.dropboxapi.com/2/files/upload',{method:'POST',signal:ctrl.signal,headers:{'Authorization':'Bearer '+t,'Content-Type':'application/octet-stream','Dropbox-API-Arg':JSON.stringify({path:encPath(SET.path),mode:'overwrite',mute:true})},body:text});clearTimeout(tm);if(!r.ok)throw new Error(r.status+' '+(await r.text()));return r.json();}catch(e){clearTimeout(tm);if(e.name==='AbortError')throw new Error('Таймаут загрузки (15 сек)');throw e;}}
async function dbxConnect(){
  saveSettings(false);
  const code=($('#sCode')?.value||'').trim();
  if(!SET.dbx_key||!SET.dbx_secret){toast('Введите App key и App secret',true);return;}
  if(!code){toast('Введите код авторизации со страницы Dropbox',true);return;}
  try{
    const r=await fetch('https://api.dropboxapi.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code:code,client_id:SET.dbx_key,client_secret:SET.dbx_secret})});
    const j=await r.json();
    if(!r.ok){toast('Ошибка обмена кода: '+(j.error_description||j.error),true);return;}
    DBX.at=j.access_token;DBX.exp=Date.now()+j.expires_in*1000;
    if(j.refresh_token){DBX.rt=j.refresh_token;}
    else if(!DBX.rt){toast('Авторизация прошла, но Dropbox не выдал долгосрочный токен — приложение уже авторизовано на другом устройстве. Для работы на этом ПК скопируйте поле «Refresh token» с первого компьютера (вкладка Настройки → раздел Dropbox) и вставьте сюда.',true);}
    persistDbx();
    await testDropbox();
  }catch(e){toast('Ошибка: '+e.message,true);}
  finally{render();}
}
async function dbxUploadToPath(path, text){
  const t=await dbxToken();const ctrl=new AbortController();const tm=setTimeout(()=>ctrl.abort(),15000);
  try{const r=await fetch('https://content.dropboxapi.com/2/files/upload',{method:'POST',signal:ctrl.signal,headers:{'Authorization':'Bearer '+t,'Content-Type':'application/octet-stream','Dropbox-API-Arg':JSON.stringify({path:encPath(path),mode:'overwrite',autorename:true})},body:new TextEncoder().encode(text)});clearTimeout(tm);if(!r.ok){const e=await r.text();throw new Error(r.status+' '+e);}return await r.json();}
  catch(e){clearTimeout(tm);throw e;}
}
async function dbxRev(){try{const r=await dbx('files/get_metadata',{path:SET.path});return (await r.json()).rev;}catch(e){return null;}}

let DB=null;
let SNAP={};
async function loadSnap(){try{const r=await fetch('snap.json');SNAP=await r.json();}catch(e){console.error('snap.json не загружен',e);SNAP={contracts:[],persons:[],poas:[],projects:[],executors:[],vids:[],statuses:[],journal:[],users:[{ID:'1',login:'admin',name:'Администратор',password_hash:'92668751',role:'admin'}],cases:[],acts:[],case_stages:['Иск подан','Принят к производству','Перв. инстанция','Апелляция','Кассация','Вступило в законную силу','Исп. производство','Исполнено','Прекращено'],case_categories:['Арбитраж','СОЮ','ФССП','Медиация','Досудебное урегулирование'],case_results:['','Удовлетворено','Отказано','Частично'],ip_statuses:['','В работе','Приостановлено','Прекращено','Окончено'],act_types:['','Решение совета директоров','Приказ','Распоряжение','Протокол'],act_statuses:['','Действует','Просрочен','Отменён','Исполнен']};}}

async function initData(){
  if(SET.token||DBX.rt){try{const d=await dbxDownload();DB=JSON.parse(d.text);REV=d.rev;localStorage.setItem('reestr_cache',d.text);setCloud('ok','☁ Dropbox: синхронизировано');}
    catch(e){
      const fb=()=>{const c=localStorage.getItem('reestr_cache');DB=c?JSON.parse(c):JSON.parse(JSON.stringify(SNAP));setCloud('warn','⚠ Dropbox недоступен — локальная копия');};
      if(String(e.message).includes('not_found')&&confirm('Файл '+SET.path+' не найден в Dropbox.\n\n«ОК» — создать его сейчас в облаке с текущими данными.\n«Отмена» — локальный режим (проверьте путь в Настройках).')){
        try{const c=localStorage.getItem('reestr_cache');DB=c?JSON.parse(c):JSON.parse(JSON.stringify(SNAP));DB.meta={updated:new Date().toISOString().slice(0,19),updatedBy:SET.name||'—'};const r=await dbxUpload(JSON.stringify(DB,null,1));REV=r.rev;localStorage.setItem('reestr_cache',JSON.stringify(DB));setCloud('ok','☁ Dropbox: файл создан в облаке');}
        catch(e2){fb();}
      } else fb();
    }}
  else{DB=JSON.parse(JSON.stringify(SNAP));setCloud('warn','⚠ Не подключён Dropbox — локальный режим');}
  DB.contracts=DB.contracts||SNAP.contracts||[];DB.persons=DB.persons||SNAP.persons||[];DB.poas=DB.poas||SNAP.poas||[];DB.projects=DB.projects||SNAP.projects||[];DB.executors=DB.executors||SNAP.executors||[];DB.vids=DB.vids||SNAP.vids||[];DB.statuses=DB.statuses||SNAP.statuses||[];DB.dismissed=DB.dismissed||{};DB.journal=DB.journal||SNAP.journal||[];DB.users=DB.users||SNAP.users||[];DB.cases=DB.cases||SNAP.cases||[];DB.acts=DB.acts||SNAP.acts||[];DB.accounts=DB.persons.flatMap(p=>(p['счета']||[]).map(a=>({...a,'ID владельца':p.ID,'Владелец':p['Полное наименование']})));
  for(const d of DB.poas)d['статус']=poaStatus(d);
  $('#metainfo').textContent='обновлено: '+((DB.meta&&DB.meta.updated)||'').replace('T',' ')+' · '+(DB.meta&&DB.meta.updatedBy||'')+' · договоров: '+DB.contracts.length;
}
function setCloud(cls,txt){const c=$('#cloud');c.className=cls;c.textContent=txt;}
let saveTimer=null,searchTimer=null;
function scheduleSave(){DIRTY=true;localStorage.setItem('reestr_cache',JSON.stringify(DB));clearTimeout(saveTimer);saveTimer=setTimeout(doSave,600);}
function buildJournal(oldDB,newDB){
  const entries=[];const user=SET.name||'—';const ts=new Date().toISOString().slice(0,19);
  function scan(arrOld,arrNew,type,label){
    const oMap=new Map((arrOld||[]).map(x=>[String(x.ID||x.id),x]));
    const nMap=new Map((arrNew||[]).map(x=>[String(x.ID||x.id),x]));
    for(const [id,nc] of nMap){
      const oc=oMap.get(id);
      if(oc){
        const ch=[];
        for(const k of Object.keys(nc)){if(JSON.stringify(oc[k])!==JSON.stringify(nc[k]))ch.push({field:k,old:oc[k],new:nc[k]});}
        if(ch.length)entries.push({ts,user,type,label,id,action:'edit',changes:ch});
      }else entries.push({ts,user,type,label,id,action:'add',changes:[]});
    }
    for(const [id,oc] of oMap){if(!nMap.has(id))entries.push({ts,user,type,label,id,action:'delete',changes:[]});}
  }
  scan(oldDB.contracts,newDB.contracts,'contract','Договор');
  scan(oldDB.persons,newDB.persons,'person','Контрагент');
  scan(oldDB.poas,newDB.poas,'poa','Доверенность');
  scan(oldDB.cases,newDB.cases,'case','Дело');
  scan(oldDB.acts,newDB.acts,'act','Корп. акт');
  return entries;
}

async function doSave(){
  if(!SET.token&&!DBX.rt){toast('Сохранено локально (Dropbox не подключён)');return;}
  if(SAVING)return;SAVING=true;
  try{
    const remoteRev=await dbxRev();
    if(REV&&remoteRev&&remoteRev!==REV&&!confirm('Данные в Dropbox изменили другие пользователи после вашей последней синхронизации.\n\n«ОК» — перезаписать своей версией, «Отмена» — загрузить свежие данные (ваши правки пропадут).')){await initData();render();SAVING=false;return;}
    const oldCache=localStorage.getItem('reestr_cache');
    const oldDB=oldCache?JSON.parse(oldCache):{};
    const entries=buildJournal(oldDB,DB);
    if(entries.length){DB.journal=DB.journal||[];DB.journal.push(...entries);if(DB.journal.length>500)DB.journal=DB.journal.slice(-500);}
    DB.meta={updated:new Date().toISOString().slice(0,19),updatedBy:SET.name||'—'};
    const r=await dbxUpload(JSON.stringify(DB,null,1));REV=r.rev;
    const today=new Date().toISOString().slice(0,10);
    if(SET.lastBackup!==today){try{const bp=(SET.path||'/data.json').replace(/\/[^\/]*$/,'')+'/backup/data_'+today+'.json';await dbxUploadToPath(bp,JSON.stringify(DB,null,1));SET.lastBackup=today;saveSettings();}catch(e){console.log('backup skipped',e);}}
    localStorage.setItem('reestr_cache',JSON.stringify(DB));
    setCloud('ok','☁ Dropbox: сохранено '+new Date().toLocaleTimeString('ru-RU'));
    $('#metainfo').textContent='обновлено: '+DB.meta.updated.replace('T',' ')+' · '+DB.meta.updatedBy+' · договоров: '+DB.contracts.length;
    toast('Сохранено в Dropbox');
  }catch(e){toast('Ошибка сохранения: '+e.message,true);setCloud('warn','⚠ Ошибка Dropbox');}
  SAVING=false;DIRTY=false;
}
function poaStatus(d){const e=parseDMY(d['истекает']);return !e?'без срока':(e<today0()?'истекла':'действует');}
function newId(arr){let mx=0;for(const x of arr){const n=parseInt(x.ID);if(!isNaN(n))mx=Math.max(mx,n);}return String(mx+1);}

window.addEventListener('online',()=>{setCloud('ok','☁ Сеть восстановлена');});
window.addEventListener('offline',()=>{setCloud('warn','⚠ Нет подключения — работа в локальном режиме');});
window.addEventListener('beforeunload',e=>{if(DIRTY){localStorage.setItem('reestr_cache',JSON.stringify(DB));e.preventDefault();e.returnValue='';}});
const TABS=[['dashboard','📊 Дашборд'],['contracts','Договоры'],['persons','Контрагенты'],['accounts','Счета'],['poas','Доверенности'],['projects','Проекты'],['cases','⚖️ Дела'],['acts','📋 Акты'],['reminders','Напоминания'],['settings','Настройки']];
let cur='contracts';
function switchTab(k){cur=k;renderTabs();render();window.scrollTo(0,0);}
function renderTabs(){$('#tabs').innerHTML=TABS.map(([k,l])=>`<button class="${k===cur?'active':''}" onclick="switchTab('${k}')">${l}${k==='reminders'&&remCount()?` <span class="badge b-red">${remCount()}</span>`:''}</button>`).join('');}
function render(){if(!requireAuth())return;({dashboard:renderDashboard,contracts:renderContracts,persons:renderPersons,accounts:renderAccounts,poas:renderPoas,projects:renderProjects,cases:renderCases,acts:renderActs,reminders:renderReminders,settings:renderSettings})[cur]();}

let cSort={key:'Дата',dir:-1};
function contractFilters(){
  return `<input type="search" id="q" placeholder="Поиск: название, №, сторона, примечание…" oninput="debouncedDraw()">
  <select id="fStatus" onchange="drawContracts()"><option value="">Статус: все</option>${DB.statuses.map(s=>`<option>${esc(s)}</option>`).join('')}</select>
  <select id="fVid" onchange="drawContracts()"><option value="">Вид: все</option>${DB.vids.map(s=>`<option>${esc(s)}</option>`).join('')}</select>
  <select id="fProj" onchange="drawContracts()"><option value="">Проект: все</option>${DB.projects.map(s=>`<option>${esc(s)}</option>`).join('')}</select>
  <select id="fExec" onchange="drawContracts()"><option value="">Исполнитель: все</option>${DB.executors.map(s=>`<option>${esc(s)}</option>`).join('')}</select>
  <select id="fCurrency" onchange="drawContracts()"><option value="">Валюта: все</option><option>руб.</option><option>USD</option><option>EUR</option></select>
  <select id="fLoanStat" onchange="drawContracts()"><option value="">Возврат займа: все</option><option>не возвращён</option><option>частично возвращён</option><option>возвращён полностью</option><option>просрочен</option></select>
  <button class="btn" onclick="['q','fStatus','fVid','fProj','fExec','fCurrency','fLoanStat'].forEach(i=>document.getElementById(i).value='');debouncedDraw()">Сброс</button>
  <button class="btn" onclick="exportCSV()">Экспорт CSV</button>
  <button class="btn primary" onclick="editContract()">＋ Договор</button>`;
}
function debouncedDraw(){clearTimeout(searchTimer);searchTimer=setTimeout(drawContracts,250);}
function renderContracts(){$('#view').innerHTML=`<div class="toolbar">${contractFilters()}</div><div id="ctable"></div>`;drawContracts();}
function filteredContracts(){
  const q=norm($('#q')?.value),fs=$('#fStatus')?.value,fv=$('#fVid')?.value,fp=$('#fProj')?.value,fe=$('#fExec')?.value,fcur=$('#fCurrency')?.value,fls=$('#fLoanStat')?.value;
  return DB.contracts.filter(c=>{
    if(fs&&c['Статус']!==fs)return false;if(fv&&c['Вид']!==fv)return false;if(fp&&c['Проект']!==fp)return false;if(fe&&c['Исполнитель']!==fe)return false;
    if(fcur&&c['Валюта']!==fcur)return false;if(fls&&c['Статус возврата']!==fls)return false;
    if(q){const hay=norm([c['Полное название'],c['№'],c['Стороны'],c['Примечания'],c['Существенные условия'],c['Название'],c['Сумма'],(c['стороны']||[]).map(s=>s['наименование лица']).join(' ')].join(' '));if(!hay.includes(q))return false;}
    return true;
  }).sort((a,b)=>{let va,vb;if(cSort.key==='Дата'){va=toISO(a['Дата']);vb=toISO(b['Дата']);}else if(cSort.key==='Сумма'){va=parseFloat((a['Сумма']||'').replace(/\s/g,'').replace(',','.'))||0;vb=parseFloat((b['Сумма']||'').replace(/\s/g,'').replace(',','.'))||0;}else{va=norm(a[cSort.key]);vb=norm(b[cSort.key]);}return (va<vb?-1:va>vb?1:0)*cSort.dir;});
}
function cHot(c){const cd=parseDMY(c['Контрольная дата']);return !!cd&&cd<today0();}
function drawContracts(){
  const list=filteredContracts();const el=$('#ctable');if(!el)return;
  if(!list.length){el.innerHTML='<div class="empty">Ничего не найдено</div>';return;}
  const ar=k=>cSort.key===k?(cSort.dir>0?' ▲':' ▼'):'';
  let h=`<table><thead><tr><th onclick="setCSort('Дата')">Дата${ar('Дата')}</th><th onclick="setCSort('№')">№</th><th onclick="setCSort('Полное название')">Договор${ar('Полное название')}</th><th onclick="setCSort('Вид')">Вид${ar('Вид')}</th><th onclick="setCSort('Статус')">Статус${ar('Статус')}</th><th>Контроль</th><th onclick="setCSort('Проект')">Проект${ar('Проект')}</th><th onclick="setCSort('Сумма')">Сумма${ar('Сумма')}</th><th>Стороны</th><th onclick="setCSort('Исполнитель')">Исполн.${ar('Исполнитель')}</th></tr></thead><tbody>`;
  for(const c of list){
    const cd=parseDMY(c['Контрольная дата']);
    h+=`<tr onclick="openContract('${esc(c.ID)}')"><td class="mut">${esc(c['Дата'])}</td><td>${esc(c['№'])} ${cHot(c)?'🔥':''}</td><td>${esc(c['Полное название']||c['Название'])} ${contourBadge((c['стороны']||[]).some(s=>s['принадлежит внутреннему контуру']==='да')?'да':'')}</td><td class="mut">${esc(c['Вид'])}</td><td>${statusBadge(c['Статус'])}</td><td class="mut">${cd?esc(c['Контрольная дата']):''}</td><td class="mut">${esc(c['Проект'])}</td><td class="mut">${esc(c['Сумма'])} ${esc(c['Валюта'])}</td><td class="mut">${(c['стороны']||[]).slice(0,2).map(s=>esc(s['краткое наименование стороны']||s['наименование лица']||'')).join(', ')}${(c['стороны']||[]).length>2?' +'+((c['стороны']||[]).length-2):''}</td><td class="mut">${esc(c['Исполнитель'])}</td><td>${(c['Вид']||'').toLowerCase().includes('займ')&&c['Статус']==='подписан'&&c['Статус возврата']!=='возвращён полностью'?`<button class="btn" style="padding:3px 10px;font-size:12px" onclick="event.stopPropagation();markLoanPaid('${esc(c.ID)}')">✓ Погашен</button>`:''}</td></tr>`;
  }
  el.innerHTML=h+`</tbody></table><div class="count" style="margin-top:8px">Показано ${list.length} из ${DB.contracts.length}</div>`;
}
function setCSort(k){if(cSort.key===k)cSort.dir*=-1;else{cSort.key=k;cSort.dir=1;}drawContracts();}
function openContract(id){
  const c=DB.contracts.find(x=>String(x.ID)===String(id));if(!c)return;
  const docs=[['Существенные условия',c['Существенные условия']],['Проект документа',c['Проект документа']],['Подписанный документ',c['Подписанный документ']]].filter(x=>x[1]);
  let h=`<div class="mhead"><h2>${esc(c['Полное название']||c['Название'])}</h2><span onclick="editContract('${esc(c.ID)}')" class="iconbtn" title="Изменить">✏️</span><span onclick="delContract('${esc(c.ID)}')" class="iconbtn" title="Удалить">🗑</span><span class="x" onclick="closeModal()">✕</span></div><div class="body">`;
  const isLoanC=String(c['Вид']||'').toLowerCase().includes('займ');
  h+=`<div style="margin-bottom:12px">${statusBadge(c['Статус'])} </div><dl class="kv">
    <dt>№ / Дата</dt><dd>${esc(c['№'])} · ${esc(c['Дата'])}</dd>
    ${c['Контрольная дата']?`<dt>Контрольная дата</dt><dd>${esc(c['Контрольная дата'])}${cHot(c)?' <span class="badge b-red">просрочено</span>':''}</dd>`:''}
    ${c['Сумма']?`<dt>Сумма</dt><dd>${esc(c['Сумма'])} ${esc(c['Валюта'])}</dd>`:''}
    <dt>Проект</dt><dd>${esc(c['Проект'])}</dd><dt>Исполнитель</dt><dd>${esc(c['Исполнитель'])}</dd>
    ${c['Примечания']?`<dt>Примечания</dt><dd>${esc(c['Примечания'])}</dd>`:''}</dl>`;
  if(isLoanC&&(c['Статус возврата']||c['Фактическая дата возврата']||c['Фактическая сумма возврата']||c['Периодичность платежей']||c['Процентная ставка']||c['Сумма'])){
    h+=`<h3 class="sec">Исполнение займа</h3><dl class="kv">`;
    if(c['Статус возврата'])h+=`<dt>Статус возврата</dt><dd>${statusBadge(c['Статус возврата'])}</dd>`;
    if(c['Фактическая дата возврата'])h+=`<dt>Факт. дата возврата</dt><dd>${esc(c['Фактическая дата возврата'])}</dd>`;
    if(c['Фактическая сумма возврата'])h+=`<dt>Факт. сумма возврата</dt><dd>${esc(c['Фактическая сумма возврата'])} ${esc(c['Валюта'])}</dd>`;
    if(c['Периодичность платежей'])h+=`<dt>Периодичность</dt><dd>${esc(c['Периодичность платежей'])}</dd>`;
    if(c['Процентная ставка'])h+=`<dt>Ставка</dt><dd>${esc(c['Процентная ставка'])}% годовых</dd>`;
    if(c['Сумма']&&c['Процентная ставка']&&c['Дата']){
      const start=parseDMY(c['Дата']);const end=c['Фактическая дата возврата']?parseDMY(c['Фактическая дата возврата']):today0();const days=Math.max(1,Math.round((end-start)/(1000*60*60*24)));
      const sum=parseFloat((c['Сумма']||'').replace(/\s/g,'').replace(',','.'))||0;const rate=parseFloat((c['Процентная ставка']||'').replace(',','.'))||0;
      const interest=Math.round(sum*rate/100*days/365);
      const penaltyRate=parseFloat((SET.penalty_rate||'0.1').replace(',','.'))||0.1;
      let penalty=0;const cd=parseDMY(c['Контрольная дата']);if(cd&&end>cd){const overdue=Math.round((end-cd)/(1000*60*60*24));penalty=Math.round(sum*penaltyRate/100*overdue);}
      const total=sum+interest+penalty;
      h+=`<dt>Дней с выдачи</dt><dd>${days}</dd>`;
      h+=`<dt>Начислено процентов</dt><dd>${interest.toLocaleString('ru-RU')} ${esc(c['Валюта'])}</dd>`;
      if(penalty>0)h+=`<dt>Неустойка (${penaltyRate}%/день)</dt><dd>${penalty.toLocaleString('ru-RU')} ${esc(c['Валюта'])}</dd>`;
      h+=`<dt style="font-weight:700">Итого к возврату</dt><dd style="font-weight:700;font-size:15px">${total.toLocaleString('ru-RU')} ${esc(c['Валюта'])}</dd>`;
    }
    h+=`</dl>`;
  }
  h+=`<h3 class="sec">Стороны</h3><table class="inner"><thead><tr><th>№</th><th>Сторона</th><th>Роль</th><th>Реквизиты</th></tr></thead><tbody>`;
  for(const s of (c['стороны']||[]))h+=`<tr><td>${esc(s['№ в договоре'])}</td><td>${personLink(s['ID лица'],s['полное наименование стороны'])} ${contourBadge(s['принадлежит внутреннему контуру'])}</td><td>${esc(s['наименование в договоре'])}</td><td class="mut" style="font-size:12.5px">${esc(s['реквизиты лица'])}</td></tr>`;
  h+=`</tbody></table>`;
  if(docs.length)h+=`<h3 class="sec">Документы</h3>`+docs.map(x=>`<a class="doclink" href="${safeLink(x[1])}" target="_blank" onclick="event.stopPropagation()">📄 ${esc(x[0])}</a>`).join('');
  const jEntries=(DB.journal||[]).filter(e=>e.type==='contract'&&String(e.id)===String(id)).slice(-20);
  if(jEntries.length){h+=`<h3 class="sec" style="margin-top:22px">История изменений</h3><div style="max-height:260px;overflow:auto;font-size:13px">`;
  for(const e of jEntries.reverse()){
    h+=`<div style="margin-bottom:8px;padding:8px;background:var(--row);border-radius:6px"><div style="color:var(--muted);font-size:11px">${esc(e.ts.replace('T',' '))} · ${esc(e.user)} · ${e.action==='edit'?'Изменено':e.action==='add'?'Создано':'Удалено'}</div>`;
    if(e.changes&&e.changes.length)for(const c of e.changes){h+=`<div style="margin-top:4px">${esc(c.field)}: <s>${esc(String(c.old||'—'))}</s> → ${esc(String(c.new||'—'))}</div>`;}
    h+=`</div>`;
  }h+=`</div>`;}
  openModal(h+'</div>');
}
function editContract(id){
  const c=id?DB.contracts.find(x=>String(x.ID)===String(id)):null;
  const v=c?JSON.parse(JSON.stringify(c)):{ID:newId(DB.contracts),'Дата':dmy(new Date()),'стороны':[]};
  const isLoan=String(v['Вид']||'').toLowerCase().includes('займ');
  openForm(c?'Изменить договор':'Новый договор',[
    {k:'Дата',l:'Дата',t:'date'},{k:'№',l:'№'},
    {k:'Название',l:'Краткое название'},{k:'Полное название',l:'Полное название',ta:1,full:1},
    {k:'Вид',l:'Вид',list:DB.vids},{k:'Статус',l:'Статус',list:DB.statuses},
    {k:'Проект',l:'Проект',list:DB.projects,free:1},{k:'Исполнитель',l:'Исполнитель',list:DB.executors,free:1},
    {k:'Контрольная дата',l:'Контрольная дата (срок возврата займа и т.п.)',t:'date'},
    {k:'Сумма',l:'Сумма договора'},{k:'Валюта',l:'Валюта',list:['руб.','USD','EUR'],free:1},
    {k:'Существенные условия',l:'Существенные условия (ссылка)'},{k:'Проект документа',l:'Проект документа (ссылка)'},
    {k:'Подписанный документ',l:'Подписанный документ (ссылка)',full:1},{k:'Примечания',l:'Примечания',ta:1,full:1},
  ].concat(isLoan?[
    {k:'Статус возврата',l:'Статус возврата займа',list:['','не возвращён','частично возвращён','возвращён полностью','просрочен']},
    {k:'Фактическая дата возврата',l:'Фактическая дата возврата',t:'date'},
    {k:'Фактическая сумма возврата',l:'Фактическая сумма возврата'},
    {k:'Периодичность платежей',l:'Периодичность платежей',list:['','единовременно','ежемесячно','ежеквартально','иное']},
    {k:'Процентная ставка',l:'Процентная ставка (% годовых)'}
  ]:[]),v,obj=>{
    obj['Стороны']=(obj['стороны']||[]).map(s=>personName(s['ID лица'])).join('\n');
    if(c)Object.assign(c,obj);else DB.contracts.unshift(obj);
    scheduleSave();renderTabs();render();toast(c?'Договор обновлён':'Договор добавлен');
  },()=>sidesEditor(v['стороны']));
}
function sidesEditor(sides){
  return `<h3 class="sec">Стороны</h3><div class="subeditor" id="sides">${(sides||[]).map(srow).join('')}</div><button class="btn" onclick="document.getElementById('sides').insertAdjacentHTML('beforeend',srow())">＋ Сторона</button>`;
}
function srow(s){
  s=s||{'ID лица':'','наименование в договоре':''};
  return `<div class="row"><select class="s-id">${personOpts(s['ID лица'])}</select><input class="s-role" placeholder="Роль (Заемщик, Продавец…)" value="${esc(s['наименование в договоре'])}"><span class="iconbtn" onclick="this.closest('.row').remove()" title="Убрать">✕</span></div>`;
}
function collectSides(){
  return [...document.querySelectorAll('#sides .row')].map((r,i)=>{
    const pid=r.querySelector('.s-id').value;
    const p=DB.persons.find(x=>String(x.ID)===String(pid));
    return {'ID':'s'+Date.now()+i,'ID договора':'','ID лица':pid,'полное наименование стороны':p?p['Полное наименование']:'','наименование лица':p?(p['Наименование']||p['Полное наименование']):'','реквизиты лица':p?p['Реквизиты (сводные)']:'','принадлежит внутреннему контуру':p?p['Принадлежит внутреннему контуру']:'','№ в договоре':String(i+1),'наименование в договоре':r.querySelector('.s-role').value.trim(),'действует как':''};
  });
}
function delContract(id){const c=DB.contracts.find(x=>String(x.ID)===String(id));if(!c)return;if(!confirm('Удалить договор «'+(c['Полное название']||c['Название'])+'»?'))return;DB.contracts=DB.contracts.filter(x=>x!==c);scheduleSave();closeModal();render();toast('Договор удалён');}
function exportCSV(){
  const rows=[['ID','Дата','№','Название','Вид','Стороны','Статус','Контрольная дата','Сумма','Валюта','Проект','Исполнитель','Примечания','Статус возврата','Факт.дата возврата','Факт.сумма возврата','Периодичность','Ставка %']];
  for(const c of filteredContracts())rows.push([c.ID,c['Дата'],c['№'],c['Полное название']||c['Название'],c['Вид'],(c['стороны']||[]).map(s=>s['наименование лица']).join('; '),c['Статус'],c['Контрольная дата'],c['Сумма'],c['Валюта'],c['Проект'],c['Исполнитель'],c['Примечания'],c['Статус возврата'],c['Фактическая дата возврата'],c['Фактическая сумма возврата'],c['Периодичность платежей'],c['Процентная ставка']]);
  const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='реестр_договоров.csv';a.click();
}

let pSort={key:'Полное наименование',dir:1};
function renderPersons(){$('#view').innerHTML=`<div class="toolbar"><input type="search" id="pq" placeholder="Поиск: наименование, ИНН, ОГРН, примечание…" oninput="drawPersons()"><button class="btn" onclick="exportPersonsCSV()">Экспорт CSV</button><button class="btn primary" onclick="editPerson()">＋ Контрагент</button><span class="count" id="pcnt"></span></div><div id="ptable"></div>`;drawPersons();}
function drawPersons(){
  const q=norm($('#pq')?.value);const el=$('#ptable');if(!el)return;
  const list=DB.persons.filter(p=>!q||norm([p['Полное наименование'],p['Наименование'],p['ИНН'],p['ОГРН'],p['ОГРНИП'],p['Буквенный код'],p['Примечания']].join(' ')).includes(q)).sort((a,b)=>norm(a[pSort.key]).localeCompare(norm(b[pSort.key]),'ru')*pSort.dir);
  $('#pcnt').textContent=`Показано ${list.length} из ${DB.persons.length}`;
  const ar=k=>pSort.key===k?(pSort.dir>0?' ▲':' ▼'):'';
  let h=`<table><thead><tr><th onclick="setPSort('Полное наименование')">Наименование${ar('Полное наименование')}</th><th onclick="setPSort('Вид')">Вид${ar('Вид')}</th><th>ИНН / ОГРН</th><th>Счетов</th><th>Договоров</th></tr></thead><tbody>`;
  const cnt=id=>DB.contracts.filter(c=>(c['стороны']||[]).some(s=>String(s['ID лица'])===String(id))).length;
  for(const p of list)h+=`<tr onclick="openPerson('${esc(p.ID)}')"><td>${esc(p['Полное наименование'])} ${contourBadge(p['Принадлежит внутреннему контуру'])}</td><td class="mut">${esc(p['Вид'])}</td><td class="mut">${esc(p['ИНН'])}<br>${esc(p['ОГРН']||p['ОГРНИП'])}</td><td class="mut">${(p['счета']||[]).length||''}</td><td class="mut">${cnt(p.ID)||''}</td></tr>`;
  el.innerHTML=h+'</tbody></table>';
}
function setPSort(k){if(pSort.key===k)pSort.dir*=-1;else{pSort.key=k;pSort.dir=1;}drawPersons();}
function openPerson(id){
  const p=DB.persons.find(x=>String(x.ID)===String(id));if(!p)return;
  const F=[['Реквизиты (сводные)','Реквизиты (сводные)'],['Вид','Вид'],['Буквенный код','Буквенный код'],['Пол','Пол'],['Дата рождения','Дата рождения'],['Место рождения','Место рождения'],['СНИЛС','СНИЛС'],['ИНН','ИНН'],['ОГРН','ОГРН'],['ОГРНИП','ОГРНИП'],['№ паспорта','№ паспорта'],['Дата выдачи паспорта','Дата выдачи паспорта'],['Кем выдан паспорт','Кем выдан паспорт'],['К/п органа, выдавшего паспорт','К/п органа, выдавшего паспорт'],['Адрес регистрации','Адрес регистрации'],['Иные реквизиты','Иные реквизиты'],['Примечания','Примечания']];
  let h=`<div class="mhead"><h2>${esc(p['Полное наименование'])}</h2><span onclick="editPerson('${esc(p.ID)}')" class="iconbtn">✏️</span><span onclick="delPerson('${esc(p.ID)}')" class="iconbtn">🗑</span><span class="x" onclick="closeModal()">✕</span></div><div class="body">`;
  h+=`<div style="margin-bottom:12px">${contourBadge(p['Принадлежит внутреннему контуру'])} ${p['Исполнитель']==='да'?'<span class="badge b-blue">исполнитель</span>':''}</div><dl class="kv">`;
  for(const f of F){if(!p[f[1]])continue;let val=esc(p[f[1]]);if(f[1]==='Дата рождения'){const bd=parseDMY(p[f[1]]);if(bd){const age=Math.floor((today0()-bd)/(1000*60*60*24*365.25));val+=` <span style="color:var(--muted)" class="badge b-gray">${age} лет</span>`;}}h+=`<dt>${f[0]}</dt><dd>${val}</dd>`;}
  if(p['Ссылка на папку'])h+=`<dt>Папка</dt><dd><a class="linkish" href="${safeLink(p['Ссылка на папку'])}" target="_blank">открыть</a></dd>`;
  h+='</dl>';
  if((p['счета']||[]).length){h+=`<h3 class="sec">Банковские счета</h3><table class="inner"><thead><tr><th>№ счёта</th><th>Банк</th><th>БИК</th><th>Корр. счёт</th><th>Примечание</th></tr></thead><tbody>`;
    for(const a of p['счета'])h+=`<tr><td>${esc(a['№'])}</td><td>${esc(a['Банк'])}</td><td class="mut">${esc(a['БИК'])}</td><td class="mut">${esc(a['Корр. счёт'])}</td><td class="mut">${esc(a['Примечание'])}</td></tr>`;h+='</tbody></table>';}
  const inC=DB.contracts.filter(c=>(c['стороны']||[]).some(s=>String(s['ID лица'])===String(id)));
  if(inC.length){h+=`<h3 class="sec">Участвует в договорах (${inC.length})</h3><table class="inner"><thead><tr><th>Дата</th><th>Договор</th><th>Роль</th><th>Статус</th></tr></thead><tbody>`;
    for(const c of inC){const s=(c['стороны']||[]).find(x=>String(x['ID лица'])===String(id));h+=`<tr style="cursor:pointer" onclick="openContract('${esc(c.ID)}')"><td class="mut">${esc(c['Дата'])}</td><td>${esc(c['Полное название']||c['Название'])}</td><td>${esc(s?s['наименование в договоре']:'')}</td><td>${statusBadge(c['Статус'])}</td></tr>`;}h+='</tbody></table>';}
  openModal(h+'</div>');
}
function editPerson(id){
  const p=id?DB.persons.find(x=>String(x.ID)===String(id)):null;
  const v=p?JSON.parse(JSON.stringify(p)):{ID:newId(DB.persons),'счета':[]};
  openForm(p?'Изменить контрагента':'Новый контрагент',[
    {k:'Полное наименование',l:'Полное наименование',full:1},{k:'Наименование',l:'Краткое наименование'},
    {k:'Вид',l:'Вид (АО/ООО/ИП/…)',list:['','АО','ООО','ИП','Московская городская коллегия адвокатов','самозанятый гражданин','адвокат','арбитражный управляющий'],free:1},
    {k:'Пол',l:'Пол',list:['','мужской','женский']},
    {k:'Принадлежит внутреннему контуру',l:'Внутренний контур',t:'check'},
    {k:'Исполнитель',l:'Является исполнителем',t:'check'},
    {k:'Буквенный код',l:'Буквенный код'},{k:'ИНН',l:'ИНН'},
    {k:'ОГРН',l:'ОГРН'},{k:'ОГРНИП',l:'ОГРНИП'},
    {k:'Дата рождения',l:'Дата рождения',t:'date'},{k:'Место рождения',l:'Место рождения'},
    {k:'СНИЛС',l:'СНИЛС'},{k:'№ паспорта',l:'№ паспорта'},
    {k:'Дата выдачи паспорта',l:'Дата выдачи паспорта',t:'date'},{k:'Кем выдан паспорт',l:'Кем выдан паспорт'},
    {k:'К/п органа, выдавшего паспорт',l:'Код подразделения'},
    {k:'Адрес регистрации',l:'Адрес регистрации',full:1},{k:'Иные реквизиты',l:'Иные реквизиты',ta:1,full:1},
    {k:'Ссылка на папку',l:'Ссылка на папку',full:1},{k:'Примечания',l:'Примечания',ta:1,full:1},
  ],v,obj=>{
    obj['счета']=collectAccounts();
    if(p)Object.assign(p,obj);else DB.persons.push(obj);
    DB.accounts=DB.persons.flatMap(x=>(x['счета']||[]).map(a=>({...a,'ID владельца':x.ID,'Владелец':x['Полное наименование']})));
    scheduleSave();render();toast(p?'Контрагент обновлён':'Контрагент добавлен');
  },()=>accountsEditor(v['счета']));
}
function accountsEditor(accs){
  return `<h3 class="sec">Банковские счета</h3><div class="subeditor" id="accs">${(accs||[]).map(arow).join('')}</div><button class="btn" onclick="document.getElementById('accs').insertAdjacentHTML('beforeend',arow())">＋ Счёт</button>`;
}
function arow(a){
  a=a||{'№':'','Банк':'','БИК':'','Корр. счёт':'','Примечание':''};
  return `<div class="row" style="grid-template-columns:1.2fr 1.2fr 100px 1.2fr 1fr 30px"><input class="a-n" placeholder="№ счёта" value="${esc(a['№'])}"><input class="a-b" placeholder="Банк" value="${esc(a['Банк'])}"><input class="a-bik" placeholder="БИК" value="${esc(a['БИК'])}"><input class="a-k" placeholder="Корр. счёт" value="${esc(a['Корр. счёт'])}"><input class="a-p" placeholder="Примечание" value="${esc(a['Примечание'])}"><span class="iconbtn" onclick="this.closest('.row').remove()">✕</span></div>`;
}
function collectAccounts(){
  return [...document.querySelectorAll('#accs .row')].map(r=>({'№':r.querySelector('.a-n').value.trim(),'Банк':r.querySelector('.a-b').value.trim(),'БИК':r.querySelector('.a-bik').value.trim(),'Корр. счёт':r.querySelector('.a-k').value.trim(),'Примечание':r.querySelector('.a-p').value.trim()})).filter(a=>a['№']||a['Банк']);
}
function delPerson(id){const p=DB.persons.find(x=>String(x.ID)===String(id));if(!p)return;if(!confirm('Удалить «'+p['Полное наименование']+'»? В договорах останется текстом.'))return;DB.persons=DB.persons.filter(x=>x!==p);DB.accounts=DB.accounts.filter(a=>String(a['ID владельца'])!==String(id));scheduleSave();closeModal();render();toast('Контрагент удалён');}
function exportPersonsCSV(){
  const rows=[['ID','Наименование','Вид','ИНН','ОГРН','ОГРНИП','Реквизиты','Примечания']];
  for(const p of DB.persons)rows.push([p.ID,p['Полное наименование'],p['Вид'],p['ИНН'],p['ОГРН'],p['ОГРНИП'],p['Реквизиты (сводные)'],p['Примечания']]);
  const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='контрагенты.csv';a.click();
}

function renderAccounts(){$('#view').innerHTML=`<div class="toolbar"><input type="search" id="aq" placeholder="Поиск: владелец, банк, № счёта, БИК…" oninput="drawAccounts()"><span class="count" id="acnt"></span></div><div id="atable"></div>`;drawAccounts();}
function drawAccounts(){
  const q=norm($('#aq')?.value);const el=$('#atable');if(!el)return;
  const list=DB.accounts.filter(a=>!q||norm(Object.values(a).join(' ')).includes(q));
  $('#acnt').textContent=`Показано ${list.length} из ${DB.accounts.length}`;
  let h=`<table><thead><tr><th>Владелец</th><th>№ счёта</th><th>Банк</th><th>БИК</th><th>Корр. счёт</th><th>Примечание</th></tr></thead><tbody>`;
  for(const a of list)h+=`<tr onclick="openPerson('${esc(a['ID владельца'])}')"><td>${esc(a['Владелец'])}</td><td>${esc(a['№'])}</td><td>${esc(a['Банк'])}</td><td class="mut">${esc(a['БИК'])}</td><td class="mut">${esc(a['Корр. счёт'])}</td><td class="mut">${esc(a['Примечание'])}</td></tr>`;
  el.innerHTML=h+'</tbody></table>';
}

function renderPoas(){$('#view').innerHTML=`<div class="toolbar"><input type="search" id="dq" placeholder="Поиск: доверитель, поверенный, №…" oninput="drawPoas()">
  <select id="dfStatus" onchange="drawPoas()"><option value="">Статус: все</option><option>действует</option><option>истекла</option><option>без срока</option></select>
  <button class="btn primary" onclick="editPoa()">＋ Доверенность</button><span class="count" id="dcnt"></span></div><div id="dtable"></div>`;drawPoas();}
function drawPoas(){
  const q=norm($('#dq')?.value),fs=$('#dfStatus')?.value;const el=$('#dtable');if(!el)return;
  const list=DB.poas.filter(d=>(!fs||d['статус']===fs)&&(!q||norm(Object.values(d).join(' ')).includes(q))).sort((a,b)=>toISO(b['выдана']||'').localeCompare(toISO(a['выдана']||'')));
  $('#dcnt').textContent=`Показано ${list.length} из ${DB.poas.length}`;
  let h=`<table><thead><tr><th>Доверитель</th><th>Поверенный</th><th>Форма</th><th>№</th><th>Выдана</th><th>Истекает</th><th>Статус</th><th></th><th></th></tr></thead><tbody>`;
  for(const d of list)h+=`<tr onclick="openPoa('${esc(d.ID)}')"><td>${esc(d['доверитель'])}</td><td>${esc(d['поверенный'])}</td><td class="mut">${esc(d['форма'])}</td><td>${esc(d['№'])}</td><td class="mut">${esc(d['выдана'])}</td><td class="mut">${esc(d['истекает'])}</td><td>${statusBadge(d['статус'])}</td><td>${d['ссылка']?`<span class="linkish" onclick="event.stopPropagation();window.open('${esc(d['ссылка'])}','_blank')">скан</span>`:''}</td><td><span class="iconbtn" onclick="event.stopPropagation();editPoa('${esc(d.ID)}')">✏️</span></td></tr>`;
  el.innerHTML=h+'</tbody></table>';
}
function openPoa(id){
  const d=DB.poas.find(x=>String(x.ID)===String(id));if(!d)return;
  openModal(`<div class="mhead"><h2>Доверенность ${esc(d['№'])}</h2><span onclick="editPoa('${esc(d.ID)}')" class="iconbtn">✏️</span><span onclick="delPoa('${esc(d.ID)}')" class="iconbtn">🗑</span><span class="x" onclick="closeModal()">✕</span></div><div class="body">
  <div style="margin-bottom:12px">${statusBadge(d['статус'])}</div>
  <dl class="kv"><dt>Доверитель</dt><dd>${esc(d['доверитель'])}</dd><dt>Поверенный</dt><dd>${esc(d['поверенный'])}</dd>
  <dt>Форма</dt><dd>${esc(d['форма'])}</dd><dt>Выдана</dt><dd>${esc(d['выдана'])}</dd><dt>Истекает</dt><dd>${esc(d['истекает'])}</dd>
  ${d['примечания']?`<dt>Примечания</dt><dd>${esc(d['примечания'])}</dd>`:''}</dl>
  ${d['ссылка']?`<h3 class="sec">Документ</h3><a class="doclink" href="${safeLink(d['ссылка'])}" target="_blank">📄 Открыть скан</a>`:''}</div>`);
}
function editPoa(id){
  const d=id?DB.poas.find(x=>String(x.ID)===String(id)):null;
  const v=d?JSON.parse(JSON.stringify(d)):{ID:newId(DB.poas),'выдана':dmy(new Date())};
  const plist=DB.persons.map(p=>p['Полное наименование']);
  openForm(d?'Изменить доверенность':'Новая доверенность',[
    {k:'доверитель',l:'Доверитель',list:plist,full:1},
    {k:'поверенный',l:'Поверенный',list:plist,full:1},
    {k:'форма',l:'Форма',list:['нотариальная','простая письменная']},{k:'№',l:'№'},
    {k:'выдана',l:'Выдана',t:'date'},{k:'истекает',l:'Истекает',t:'date'},
    {k:'ссылка',l:'Ссылка на скан',full:1},{k:'примечания',l:'Примечания',ta:1,full:1},
  ],v,obj=>{
    if(!obj['доверитель']||!obj['поверенный']){toast('Укажите доверителя и поверенного',true);return false;}
    obj['статус']=poaStatus(obj);
    if(d)Object.assign(d,obj);else DB.poas.unshift(obj);
    scheduleSave();render();toast(d?'Доверенность обновлена':'Доверенность добавлена');
  });
}
function delPoa(id){const d=DB.poas.find(x=>String(x.ID)===String(id));if(!d)return;if(!confirm('Удалить доверенность «'+d['№']+'»?'))return;DB.poas=DB.poas.filter(x=>x!==d);scheduleSave();closeModal();render();toast('Доверенность удалена');}

function renderProjects(){
  const max=Math.max(...DB.projects.map(pr=>DB.contracts.filter(c=>c['Проект']===pr).length),1);
  $('#view').innerHTML=`<div class="toolbar"><button class="btn primary" onclick="addProject()">＋ Проект</button></div><div class="cards">`+DB.projects.map(pr=>{
    const n=DB.contracts.filter(c=>c['Проект']===pr).length;
    return `<div class="card" onclick="switchTab('contracts');setTimeout(()=>{const s=document.getElementById('fProj');if(s){s.value=pr;drawContracts();}},0)">
      <div class="n">${n}</div><div style="margin:6px 0 10px;font-weight:600">${esc(pr)}</div>
      <div style="background:var(--gray-soft);border-radius:6px;height:6px"><div style="background:var(--accent);height:6px;border-radius:6px;width:${Math.round(n/max*100)}%"></div></div></div>`;}).join('')+`</div>`;
}
function addProject(){const pr=prompt('Название нового проекта:');if(!pr)return;DB.projects.push(pr.trim());scheduleSave();render();toast('Проект добавлен');}

function computeReminders(){
  const items=[];
  for(const d of DB.poas){
    const e=parseDMY(d['истекает']);if(!e)continue;const n=daysUntil(e);
    if(n<0)items.push({level:'red',icon:'📜',key:"poa:"+d.ID+":"+d['истекает'],text:`Доверенность № ${d['№']} (${d['доверитель']} → ${d['поверенный']}) истекла ${-n} дн. назад`,go:`openPoa('${esc(d.ID)}')`});
    else if(n<=7)items.push({level:'red',icon:'📜',key:"poa:"+d.ID+":"+d['истекает'],text:`Доверенность № ${d['№']} (${d['доверитель']} → ${d['поверенный']}) истекает через ${n} дн. (${dmy(e)})`,go:`openPoa('${esc(d.ID)}')`});
    else if(n<=30)items.push({level:'amber',icon:'📜',key:"poa:"+d.ID+":"+d['истекает'],text:`Доверенность № ${d['№']} (${d['доверитель']} → ${d['поверенный']}) истекает ${dmy(e)} (через ${n} дн.)`,go:`openPoa('${esc(d.ID)}')`});
  }
  for(const c of DB.contracts){
    const cd=parseDMY(c['Контрольная дата']);const nm=c['Полное название']||c['Название'];
    if(cd){const n=daysUntil(cd);
      if(n<0)items.push({level:'red',icon:'🔥',key:"cctrl:"+c.ID+":"+c['Контрольная дата'],text:`«${nm}» — контрольная дата ${dmy(cd)} просрочена на ${-n} дн.`,go:`openContract('${esc(c.ID)}')`});
      else if(n<=7)items.push({level:'red',icon:'🔥',key:"cctrl:"+c.ID+":"+c['Контрольная дата'],text:`«${nm}» — контрольная дата ${dmy(cd)} (через ${n} дн.)`,go:`openContract('${esc(c.ID)}')`});
      else if(n<=30)items.push({level:'amber',icon:'🔥',key:"cctrl:"+c.ID+":"+c['Контрольная дата'],text:`«${nm}» — контрольная дата ${dmy(cd)} (через ${n} дн.)`,go:`openContract('${esc(c.ID)}')`});}
    const dDate=parseDMY(c['Дата']);const age=dDate?daysUntil(dDate):null;
    if(c['Статус']==='подготовлен'&&age!==null&&age<-21)items.push({level:'blue',key:"cstale:"+c.ID,icon:'✍️',text:`«${nm}» подготовлен ${dmy(dDate)}, но не подписан (${-age} дн.)`,go:`openContract('${esc(c.ID)}')`});
    if(c['Статус']==='идёт подготовка'&&age!==null&&age<-30)items.push({level:'blue',key:"cstale2:"+c.ID,icon:'✍️',text:`«${nm}» в подготовке уже ${-age} дн.`,go:`openContract('${esc(c.ID)}')`});
    if((c['Вид']||'').includes('займ')&&c['Статус']==='подписан'){
      const ret=c['Статус возврата']||'';
      if(!c['Контрольная дата'])items.push({level:'blue',icon:'💰',key:"cnodate:"+c.ID,text:`«${nm}» — займ без контрольной даты`,go:`openContract('${esc(c.ID)}')`});
      else if(ret!==''&&ret!=='возвращён полностью'&&cd){
        const n=daysUntil(cd);
        if(n<0)items.push({level:'red',icon:'💰',key:"cloan:"+c.ID+":"+c['Контрольная дата'],text:`«${nm}» — займ ${esc(c['Сумма']||'—')} ${esc(c['Валюта']||'руб.')} просрочен (${esc(c['Контрольная дата'])}), статус: ${ret}`,go:`openContract('${esc(c.ID)}')`});
        else if(n<=7)items.push({level:'red',icon:'💰',key:"cloan:"+c.ID+":"+c['Контрольная дата'],text:`«${nm}» — займ ${esc(c['Сумма']||'—')} ${esc(c['Валюта']||'руб.')} истекает через ${n} дн. (${esc(c['Контрольная дата'])}), статус: ${ret}`,go:`openContract('${esc(c.ID)}')`});
        else if(n<=30)items.push({level:'amber',icon:'💰',key:"cloan:"+c.ID+":"+c['Контрольная дата'],text:`«${nm}» — займ ${esc(c['Сумма']||'—')} ${esc(c['Валюта']||'руб.')} истекает ${esc(c['Контрольная дата'])} (${n} дн.), статус: ${ret}`,go:`openContract('${esc(c.ID)}')`});
      }
    }
  }
  for(const c of DB.cases||[]){
    const hd=parseDMY(c['Дата следующего заседания']);if(hd){const n=daysUntil(hd);if(n>=0&&n<=7)items.push({level:'red',icon:'⚖️',key:"caseh:"+c.ID+":"+c['Дата следующего заседания'],text:`Заседание по делу ${c['Номер дела']} — ${dmy(hd)} (через ${n} дн.)`,go:`openCase('${esc(c.ID)}')`});}
    if(c['Стадия']==='Вступило в законную силу'&&!c['Дата предъявления ИЛ'])items.push({level:'blue',icon:'⚖️',key:"caseil:"+c.ID,text:`Дело ${c['Номер дела']} вступило в силу, но ИЛ не предъявлен`,go:`openCase('${esc(c.ID)}')`});
    if(c['Статус исполнения']==='В работе'&&c['Дата предъявления ИЛ']){const ipd=parseDMY(c['Дата предъявления ИЛ']);if(ipd&&daysUntil(ipd)<-180&&!(c['Фактически взыскано']>0))items.push({level:'amber',icon:'⚖️',key:"caseip:"+c.ID,text:`ИП по делу ${c['Номер дела']} в работе >6 мес., взыскано 0 руб. — проверьте пристава`,go:`openCase('${esc(c.ID)}')`});}
  }
  for(const a of DB.acts||[]){
    const ed=parseDMY(a['Срок действия']);if(ed){const n=daysUntil(ed);if(n<0&&a['Статус']==='Действует')items.push({level:'red',icon:'📋',key:"act:"+a.ID+":"+a['Срок действия'],text:`${a['Тип']} № ${a['Номер']} — срок действия истёк ${dmy(ed)}`,go:`openAct('${esc(a.ID)}')`});else if(n>=0&&n<=30&&a['Статус']==='Действует')items.push({level:'amber',icon:'📋',key:"act:"+a.ID+":"+a['Срок действия'],text:`${a['Тип']} № ${a['Номер']} — срок действия истекает ${dmy(ed)} (${n} дн.)`,go:`openAct('${esc(a.ID)}')`});}
  }
  for(const p of DB.persons||[]){
    const bd=parseDMY(p['Дата рождения']);if(bd){
      const thisYear=new Date().getFullYear();const nextBD=new Date(thisYear,bd.getMonth(),bd.getDate());if(nextBD<today0())nextBD.setFullYear(thisYear+1);
      const n=Math.round((nextBD-today0())/(1000*60*60*24));
      if(n>=0&&n<=7&&!("bd:"+p.ID+":"+dmy(nextBD) in (DB.dismissed||{})))items.push({level:'blue',icon:'🎂',key:"bd:"+p.ID+":"+dmy(nextBD),text:`${esc(p['Полное наименование']||p['Наименование'])} — день рождения ${dmy(nextBD)} (${n===0?'сегодня':'через '+n+' дн.'})`,go:`openPerson('${esc(p.ID)}')`});
    }
  }
  const order={red:0,amber:1,blue:2};items.sort((a,b)=>order[a.level]-order[b.level]);
  return items;
}
function remCount(){const ds=(DB&&DB.dismissed)||{};return computeReminders().filter(r=>r.level!=='blue'&&!ds[r.key]).length;}
function renderReminders(){
  DB.dismissed=DB.dismissed||{};
  const items=computeReminders();
  const visible=items.filter(r=>!DB.dismissed[r.key]);
  const hidden=items.filter(r=>DB.dismissed[r.key]);
  const showHidden=!!window._showHidden;
  let h=`<div class="toolbar"><span class="count" style="margin-left:0">${visible.length} активных</span>
    <button class="btn" onclick="sendDigest(true)">📨 Отправить сводку в Telegram</button>
    ${visible.length?`<button class="btn" onclick="dismissAll()">🙈 Скрыть все текущие</button>`:''}
    ${hidden.length?`<button class="btn" onclick="window._showHidden=!window._showHidden;renderReminders()">${showHidden?'Свернуть':'Показать скрытые ('+hidden.length+')'}</button>`:''}</div>`;
  if(!visible.length)h+=`<div class="empty">Всё в порядке, напоминаний нет 🎉</div>`;
  const icons={red:'🔴',amber:'🟠',blue:'🔵'};
  h+=visible.map(r=>`<div class="rem-item ${r.level}"><span onclick="${r.go}">${icons[r.level]}</span><span style="flex:1" onclick="${r.go}">${esc(r.text)}</span><span class="iconbtn" title="Больше не напоминать" onclick="dismissRem('${esc(r.key)}')">✖</span></div>`).join('');
  if(showHidden&&hidden.length){
    h+=`<h3 class="sec" style="margin-top:22px">Скрытые (${hidden.length}) — нажмите ↩, чтобы вернуть</h3>`+hidden.map(r=>`<div class="rem-item ${r.level}" style="opacity:.55"><span>${icons[r.level]}</span><span style="flex:1">${esc(r.text)}<div class="mut">скрыто ${esc(DB.dismissed[r.key]||'')}</div></span><span class="iconbtn" title="Вернуть напоминание" onclick="restoreRem('${esc(r.key)}')">↩</span></div>`).join('');
  }
  $('#view').innerHTML=h;
}
function dismissRem(key){DB.dismissed=DB.dismissed||{};DB.dismissed[key]=new Date().toISOString().slice(0,10);scheduleSave();renderReminders();renderTabs();toast('Напоминание скрыто для всех');}
function dismissAll(){const t=new Date().toISOString().slice(0,10);computeReminders().forEach(r=>{if(!DB.dismissed[r.key])DB.dismissed[r.key]=t;});scheduleSave();renderReminders();renderTabs();toast('Все текущие напоминания скрыты');}
function restoreRem(key){delete DB.dismissed[key];scheduleSave();renderReminders();renderTabs();toast('Напоминание восстановлено');}
function digestText(){
  const ds=DB.dismissed||{};
  const items=computeReminders().filter(r=>r.level!=='blue'&&!ds[r.key]);
  if(!items.length)return null;
  return ('<b>🔔 Реестр договоров — напоминания</b>\n\n'+items.map(r=>r.icon+' '+r.text).join('\n')).slice(0,3900);
}
async function sendDigest(manual){
  if(!SET.tgtoken||!SET.tgchat){if(manual)toast('Сначала настройте Telegram (вкладка «Настройки»)',true);return;}
  const text=digestText();
  if(!text){if(manual)toast('Напоминаний нет — отправлять нечего');return;}
  try{
    const r=await fetch('https://api.telegram.org/bot'+SET.tgtoken+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:SET.tgchat,text,parse_mode:'HTML',disable_web_page_preview:true})});
    const j=await r.json();
    if(j.ok){localStorage.setItem('reestr_digest',new Date().toDateString());if(manual)toast('Сводка отправлена в Telegram');}
    else toast('Telegram: '+(j.description||'ошибка'),true);
  }catch(e){toast('Не удалось отправить из браузера. Используйте скрипт telegram_remind.py',true);}
}

function renderSettings(){setTimeout(()=>{renderUsersList();const lk=document.getElementById("authLink");if(lk)lk.href="https://www.dropbox.com/oauth2/authorize?client_id="+encodeURIComponent(SET.dbx_key||"")+"&response_type=code&token_access_type=offline";},0);
  $('#view').innerHTML=`
  <div class="setblock"><h3>👤 Пользователь</h3>
    <div class="row"><label>Ваше имя (фиксируется в истории изменений)</label><input id="sName" value="${esc(SET.name)}"></div>
  </div>
  <div class="setblock"><h3>🔐 Безопасность</h3>
    <div class="row"><label>Соль для шифрования (изменение сбросит пароли всех пользователей!)</label><input id="sSalt" value="${esc(SET.salt||'')}" placeholder="оставьте пустым для автогенерации"></div>
    <p class="mut" style="font-size:12px">Соль используется для хеширования паролей и шифрования токена Dropbox. Если пусто — используется значение по умолчанию.</p>
  </div>
  <div class="setblock"><h3>☁ Dropbox — общая база для всех сотрудников</h3>
    ${DBX.rt?'<div class="row" style="color:var(--green)">✅ Подключено — сессия продлевается автоматически</div>':'<div class="row mut">⚠ Не подключено</div>'}
    <div class="row"><label>App key (✅ уже вписан — менять не нужно)</label><input id="sKey" value="${esc(SET.dbx_key||'')}"></div>
    <div class="row"><label>App secret (✅ уже вписан — менять не нужно)</label><input id="sSecret" type="password" value="${esc(SET.dbx_secret||'')}"></div>
    <div class="row"><label>Refresh token <span style="color:var(--muted);font-size:11px">(для переноса на другой ПК скопируйте это поле)</span></label>
      <div style="display:flex;gap:6px"><input id="sRt" value="${esc(SET.dbx_rt||'')}" placeholder="появится после первой авторизации" style="flex:1"><button class="btn" onclick="navigator.clipboard.writeText($('#sRt').value);toast('Скопировано в буфер')">📋</button></div></div>
    <div class="row"><a class="btn" id="authLink" href="#" target="_blank">1️⃣ Открыть страницу авторизации Dropbox</a></div>
    <div class="row"><label>2️⃣ На странице Dropbox нажмите «Разрешить» и скопируйте код сюда</label><input id="sCode" placeholder="код вида NqWXyA…"></div>
    <div class="row"><button class="btn primary" onclick="dbxConnect()">3️⃣ Подключить</button>
    <button class="btn" onclick="saveSettings(true);testDropbox()">Проверить связь</button></div>
    <div class="row"><label>Путь к data.json в Dropbox</label><input id="sPath" value="${esc(SET.path)}"></div>
    <details><summary>Как получить App key и App secret (один раз, ~5 минут)</summary>
    <ol><li>Откройте <b>dropbox.com/developers/apps</b> → «Create app».</li>
    <li>Тип: <b>Scoped access</b> → область: <b>Full Dropbox</b> → имя, например <i>reestr-firm</i> → Create.</li>
    <li>Вкладка <b>Permissions</b>: включите <b>files.content.read</b> и <b>files.content.write</b> → Submit.</li>
    <li>Вкладка <b>Settings</b>: скопируйте <b>App key</b> и <b>App secret</b> (кнопка Show) в поля выше.</li>
    <li>Нажмите «Открыть страницу авторизации» → «Разрешить» → скопируйте код → «Подключить». Сессия будет продлеваться сама, токены больше не протухают.</li>
    <li>Положите <b>data.json</b> в папку Dropbox и укажите путь (по умолчанию /Реестр/data.json). Если файла нет — программа предложит создать его сама.</li>
    <li>Коллегам разошлите тот же Реестр.html — каждый вводит App key, App secret и код (можно из той же страницы авторизации; Dropbox выдаёт персональный код каждому).</li></ol></details>
  </div>
  <div class="setblock"><h3>📨 Telegram-напоминания</h3>
    <div class="row"><label>Токен бота (получить: написать @BotFather → /newbot)</label><input id="sTgToken" type="password" value="${esc(SET.tgtoken)}"></div>
    <div class="row"><label>Chat ID: напишите боту любое сообщение, затем откройте в браузере<br>api.telegram.org/bot&lt;ТОКЕН&gt;/getUpdates — число из поля «chat» → «id» (для группы сначала добавьте бота в группу)</label><input id="sTgChat" value="${esc(SET.tgchat)}"></div>
    <div class="row"><label>Ставка неустойки (% в день)</label><input id="sPenalty" value="${esc(SET.penalty_rate||'0.1')}"></div>
    <div class="row"><label><input type="checkbox" id="sAuto" ${SET.autosend==='да'?'checked':''}> Автодайджест при открытии программы (если есть напоминания и сегодня ещё не отправлялся)</label></div>
    <div class="row"><button class="btn primary" onclick="saveSettings(false);testTelegram()">Сохранить и отправить тест</button></div>
    <details><summary>Гарантированные ежедневные напоминания (если программу никто не открывал)</summary>
    <ol><li>На вашем компьютере настройте ежедневный запуск <b>telegram_remind.py</b> через Планировщик задач Windows (шаги — в ИНСТРУКЦИЯ.txt).</li>
    <li>Скрипт читает data.json из локальной папки Dropbox и шлёт дайджест в чат каждый день в заданное время.</li></ol></details>
  </div>
  <div class="setblock"><h3>👥 Пользователи</h3>
    ${SESSION&&SESSION.role==='admin'?`<div class="row" style="color:var(--green)">✅ Вы администратор — можете управлять пользователями</div>`:`<div class="row mut">Только администратор может управлять пользователями</div>`}
    <div id="usersList"></div>
    ${SESSION&&SESSION.role==='admin'?`<div style="margin-top:12px"><button class="btn primary" onclick="editUser()">＋ Добавить пользователя</button></div>`:''}
  </div>
  <div class="setblock"><h3>⚠ Как это работает без сервера</h3>
    <p class="mut" style="line-height:1.6">Все данные — в одном файле data.json в вашем Dropbox. Если двое одновременно редактируют реестр, при сохранении программа предупредит о конфликте и предложит выбор: НЕ перезаписывайте чужую работу — загрузите свежие данные и внесите правки заново. Рекомендуется перед массовыми правками договориться в чате 🙂. В шапке видно, кто и когда последний раз сохранял данные.</p>
  </div>`;
}

function renderUsersList(){
  const el=document.getElementById('usersList');if(!el)return;
  const list=DB.users||[];
  let h=`<table class="inner"><thead><tr><th>Логин</th><th>Имя</th><th>Роль</th><th></th></tr></thead><tbody>`;
  for(const u of list)h+=`<tr><td>${esc(u.login)}</td><td>${esc(u.name)}</td><td>${esc(u.role)}</td><td>${SESSION&&SESSION.role==='admin'?`<span class="iconbtn" onclick="editUser('${esc(u.ID)}')">✏️</span> <span class="iconbtn" onclick="delUser('${esc(u.ID)}')">🗑</span>`:''}</td></tr>`;
  h+=`</tbody></table>`;
  el.innerHTML=h;
}
async function editUser(id){
  if(SESSION.role!=='admin'){toast('Недостаточно прав',true);return;}
  const u=id?DB.users.find(x=>String(x.ID)===String(id)):null;
  const v=u?JSON.parse(JSON.stringify(u)):{ID:newId(DB.users||[]),role:'user'};
  openForm(u?'Изменить пользователя':'Новый пользователь',[
    {k:'login',l:'Логин'},{k:'name',l:'Имя (ФИО)'},{k:'password',l:u?'Новый пароль (оставьте пустым, чтобы не менять)':'Пароль'},
    {k:'role',l:'Роль',list:['user','admin']},
  ],v,async obj=>{
    if(!obj.login||(!u&&!obj.password)){toast('Логин и пароль обязательны',true);return false;}
    const salt=SET.salt||'reestr-default-salt';
    if(u&&obj.password)obj.password_hash=await hashPass(obj.password,salt);
    else if(!u)obj.password_hash=await hashPass(obj.password,salt);
    else delete obj.password_hash;
    delete obj.password;
    if(u)Object.assign(u,obj);else DB.users.unshift(obj);
    scheduleSave();renderSettings();toast(u?'Пользователь обновлён':'Пользователь добавлен');
  });
}function delUser(id){if(SESSION.role!=='admin'){toast('Недостаточно прав',true);return;}const u=DB.users.find(x=>String(x.ID)===String(id));if(!u)return;if(!confirm('Удалить пользователя '+u.login+'?'))return;DB.users=DB.users.filter(x=>x!==u);scheduleSave();renderSettings();toast('Пользователь удалён');}
function saveSettings(reload){
  SET.name=$('#sName').value.trim();SET.path=$('#sPath').value.trim()||'/Реестр/data.json';
  if(document.getElementById('sSalt'))SET.salt=$('#sSalt').value.trim();
  if(document.getElementById('sKey')){SET.dbx_key=$('#sKey').value.trim();SET.dbx_secret=$('#sSecret').value.trim();}
  if(document.getElementById('sRt')){SET.dbx_rt=$('#sRt').value.trim();DBX.rt=SET.dbx_rt;}
  SET.tgtoken=$('#sTgToken').value.trim();SET.tgchat=$('#sTgChat').value.trim();SET.penalty_rate=$('#sPenalty').value.trim()||'0.1';SET.autosend=$('#sAuto').checked?'да':'нет';
  saveSet();const sc=document.getElementById('sCode');if(sc)sc.value='';if(reload){initData().then(()=>{render();toast('Настройки сохранены');});}else toast('Настройки сохранены');
}async function testDropbox(){
  saveSettings(false);
  if(!DBX.at&&!DBX.rt){toast('Сначала подключите Dropbox: App key → код авторизации',true);render();return;}
  try{const d=await dbxDownload();DB=JSON.parse(d.text);REV=d.rev;localStorage.setItem('reestr_cache',d.text);setCloud('ok','☁ Dropbox: подключено');toast('Связь установлена, данные загружены');render();const sc2=document.getElementById('sCode');if(sc2)sc2.value='';}
  catch(e){
    if(String(e.message).includes('not_found')&&confirm('Файл '+SET.path+' не найден в Dropbox.\n\n«ОК» — создать его там сейчас с текущими данными.\n«Отмена» — проверьте путь и наличие файла в папке.')){
      try{const c=localStorage.getItem('reestr_cache');DB=c?JSON.parse(c):JSON.parse(JSON.stringify(SNAP));DB.meta={updated:new Date().toISOString().slice(0,19),updatedBy:SET.name||'—'};const r=await dbxUpload(JSON.stringify(DB,null,1));REV=r.rev;localStorage.setItem('reestr_cache',JSON.stringify(DB));setCloud('ok','☁ Dropbox: файл создан');toast('Файл создан в Dropbox');render();}
      catch(e2){toast('Ошибка создания: '+e2.message,true);}
    }
    else toast('Ошибка: '+e.message,true);
  }
}
async function testTelegram(){
  if(!SET.tgtoken||!SET.tgchat){toast('Заполните токен и chat ID',true);return;}
  try{const r=await fetch('https://api.telegram.org/bot'+SET.tgtoken+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:SET.tgchat,text:'✅ Реестр договоров: Telegram подключён.',parse_mode:'HTML'})});const j=await r.json();j.ok?toast('Тест отправлен — проверьте Telegram'):toast('Telegram: '+(j.description||'ошибка'),true);}catch(e){toast('Ошибка отправки: '+e.message,true);}
}



function markLoanPaid(id){
  const c=DB.contracts.find(x=>String(x.ID)===String(id));if(!c)return;
  if(!confirm('Отметить займ «'+esc(c['Название']||c['Полное название'])+'» как погашенный?'))return;
  c['Статус возврата']='возвращён полностью';
  c['Фактическая дата возврата']=dmy(new Date());
  c['Фактическая сумма возврата']=c['Сумма'];
  c['Статус']='исполнен';
  scheduleSave();render();toast('Займ отмечен как погашенный');
}
function renderDashboard(){
  const now=today0();
  const loans=DB.contracts.filter(c=>String(c['Вид']||'').toLowerCase().includes('займ')&&c['Статус']==='подписан');
  const activeLoans=loans.filter(c=>c['Статус возврата']!=='возвращён полностью');
  const overdueLoans=activeLoans.filter(c=>{const cd=parseDMY(c['Контрольная дата']);return cd&&cd<now;});
  const soonLoans=activeLoans.filter(c=>{const cd=parseDMY(c['Контрольная дата']);const n=cd?daysUntil(cd):null;return n!==null&&n>=0&&n<=30;});
  const totalLoanSum=activeLoans.reduce((s,c)=>s+(parseFloat((c['Сумма']||'').replace(/\s/g,'').replace(',','.'))||0),0);
  const overdueSum=overdueLoans.reduce((s,c)=>s+(parseFloat((c['Сумма']||'').replace(/\s/g,'').replace(',','.'))||0),0);
  const poaSoon=DB.poas.filter(d=>{const e=parseDMY(d['истекает']);return e&&daysUntil(e)>=0&&daysUntil(e)<=30;});
  const poaExpired=DB.poas.filter(d=>{const e=parseDMY(d['истекает']);return e&&e<now;});
  const casesActive=DB.cases.filter(c=>!['Исполнено','Прекращено'].includes(c['Стадия']||''));
  const casesExec=casesActive.filter(c=>c['Стадия']==='Исп. производство');
  const soonHearings=DB.cases.filter(c=>{const h=parseDMY(c['Дата следующего заседания']);return h&&daysUntil(h)>=0&&daysUntil(h)<=7;});
  const stalePrepared=DB.contracts.filter(c=>c['Статус']==='подготовлен'&&parseDMY(c['Дата'])&&daysUntil(parseDMY(c['Дата']))<-21);
  let h=`<div class="kpi">`;
  h+=`<div class="card green" onclick="switchTab('contracts');setTimeout(()=>{document.getElementById('fStatus').value='подписан';drawContracts();},0)"><div class="n">${activeLoans.length}</div><div class="lab">Активные займы</div><div style="font-size:13px;font-weight:600;margin-top:4px">${totalLoanSum.toLocaleString('ru-RU')} руб.</div></div>`;
  h+=`<div class="card red" onclick="switchTab('contracts');setTimeout(()=>{document.getElementById('fLoanStat').value='просрочен';drawContracts();},0)"><div class="n">${overdueLoans.length}</div><div class="lab">Просроченные</div><div style="font-size:13px;font-weight:600;margin-top:4px;color:var(--accent)">${overdueSum.toLocaleString('ru-RU')} руб.</div></div>`;
  h+=`<div class="card amber" onclick="switchTab('contracts')"><div class="n">${soonLoans.length}</div><div class="lab">Истекают ≤30 дн.</div></div>`;
  h+=`<div class="card blue" onclick="switchTab('poas')"><div class="n">${poaSoon.length}</div><div class="lab">Доверенности ≤30 дн.</div>${poaExpired.length?`<div style="font-size:12px;color:var(--accent);margin-top:4px">${poaExpired.length} просрочено</div>`:''}</div>`;
  h+=`<div class="card" onclick="switchTab('cases')"><div class="n">${casesActive.length}</div><div class="lab">Дел в работе</div>${casesExec.length?`<div style="font-size:12px;color:var(--blue);margin-top:4px">${casesExec.length} на исполнении</div>`:''}</div>`;
  h+=`<div class="card" onclick="switchTab('cases')"><div class="n">${soonHearings.length}</div><div class="lab">Заседаний ≤7 дн.</div></div>`;
  h+=`<div class="card" onclick="switchTab('contracts');setTimeout(()=>{document.getElementById('fStatus').value='подготовлен';drawContracts();},0)"><div class="n">${stalePrepared.length}</div><div class="lab">Подготовлены >21 дн.</div></div>`;
  h+=`</div>`;
  h+=`<h3 class="sec">Быстрые действия</h3><div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px">`;
  h+=`<button class="btn primary" onclick="editContract()">＋ Договор</button>`;
  h+=`<button class="btn primary" onclick="editCase()">＋ Дело</button>`;
  h+=`<button class="btn primary" onclick="editAct()">＋ Корп. акт</button>`;
  h+=`<button class="btn" onclick="switchTab('templates')">📄 Шаблоны</button>`;
  h+=`</div>`;
  if(soonHearings.length){
    h+=`<h3 class="sec">Ближайшие заседания</h3><table><thead><tr><th>Дата</th><th>Дело</th><th>Суд</th><th>Стадия</th></tr></thead><tbody>`;
    for(const c of soonHearings.sort((a,b)=>toISO(a['Дата следующего заседания']).localeCompare(toISO(b['Дата следующего заседания'])))){
      h+=`<tr onclick="openCase('${esc(c.ID)}')"><td class="mut">${esc(c['Дата следующего заседания'])}</td><td>${esc(c['Номер дела'])}</td><td class="mut">${esc(c['Суд'])}</td><td>${esc(c['Стадия'])}</td></tr>`;
    }
    h+=`</tbody></table>`;
  }
  $('#view').innerHTML=h;
}

let caseSort={key:'Дата подачи',dir:-1};
function renderCases(){$('#view').innerHTML=`<div class="toolbar"><input type="search" id="cq" placeholder="Поиск: номер дела, суд, стороны…" oninput="drawCases()"><select id="cSt" onchange="drawCases()"><option value="">Стадия: все</option>${(DB.case_stages||[]).map(s=>`<option>${esc(s)}</option>`).join('')}</select><select id="cCat" onchange="drawCases()"><option value="">Категория: все</option>${(DB.case_categories||[]).map(s=>`<option>${esc(s)}</option>`).join('')}</select><button class="btn" onclick="['cq','cSt','cCat'].forEach(i=>document.getElementById(i).value='');drawCases()">Сброс</button><button class="btn primary" onclick="editCase()">＋ Дело</button><span class="count" id="ccnt"></span></div><div id="ctable2"></div>`;drawCases();}
function drawCases(){
  const q=norm($('#cq')?.value),st=$('#cSt')?.value,cat=$('#cCat')?.value;const el=$('#ctable2');if(!el)return;
  const list=(DB.cases||[]).filter(c=>{if(st&&c['Стадия']!==st)return false;if(cat&&c['Категория']!==cat)return false;if(q){const hay=norm([c['Номер дела'],c['Суд'],c['Предмет спора'],c['Истец'],c['Ответчик'],c['Назначенный юрист']].join(' '));if(!hay.includes(q))return false;}return true;}).sort((a,b)=>{let va=norm(a[caseSort.key]),vb=norm(b[caseSort.key]);if(caseSort.key==='Дата подачи'||caseSort.key==='Дата следующего заседания'){va=toISO(a[caseSort.key]);vb=toISO(b[caseSort.key]);}return (va<vb?-1:va>vb?1:0)*caseSort.dir;});
  $('#ccnt').textContent=`Показано ${list.length} из ${(DB.cases||[]).length}`;
  const ar=k=>caseSort.key===k?(caseSort.dir>0?' ▲':' ▼'):'';
  let h=`<table><thead><tr><th onclick="setCaseSort('Номер дела')">№ дела${ar('Номер дела')}</th><th onclick="setCaseSort('Дата подачи')">Подано${ar('Дата подачи')}</th><th>Категория</th><th onclick="setCaseSort('Стадия')">Стадия${ar('Стадия')}</th><th>Стороны</th><th>Сумма</th><th onclick="setCaseSort('Дата следующего заседания')">Заседание${ar('Дата следующего заседания')}</th><th></th></tr></thead><tbody>`;
  for(const c of list){const hDate=parseDMY(c['Дата следующего заседания']);const hSoon=hDate&&daysUntil(hDate)>=0&&daysUntil(hDate)<=7?'<span class="badge b-red">'+daysUntil(hDate)+' дн.</span>':'';h+=`<tr onclick="openCase('${esc(c.ID)}')"><td class="mut">${esc(c['Номер дела'])}</td><td class="mut">${esc(c['Дата подачи'])}</td><td class="mut">${esc(c['Категория'])}</td><td>${esc(c['Стадия'])}</td><td>${esc(c['Истец'])} → ${esc(c['Ответчик'])}</td><td class="mut">${esc(c['Сумма исковых требований'])} ${esc(c['Валюта']||'руб.')}</td><td class="mut">${esc(c['Дата следующего заседания'])} ${hSoon}</td><td><span class="iconbtn" onclick="event.stopPropagation();editCase('${esc(c.ID)}')">✏️</span></td></tr>`;}
  el.innerHTML=h+'</tbody></table>';
}
function setCaseSort(k){if(caseSort.key===k)caseSort.dir*=-1;else{caseSort.key=k;caseSort.dir=1;}drawCases();}
function openCase(id){
  const c=(DB.cases||[]).find(x=>String(x.ID)===String(id));if(!c)return;
  const docs=(c['Документы по делу']||[]).filter(d=>d&&d.url);
  let h=`<div class="mhead"><h2>Дело ${esc(c['Номер дела'])}</h2><span onclick="editCase('${esc(c.ID)}')" class="iconbtn">✏️</span><span onclick="delCase('${esc(c.ID)}')" class="iconbtn">🗑</span><span class="x" onclick="closeModal()">✕</span></div><div class="body">`;
  h+=`<div style="margin-bottom:12px"><span class="badge b-blue">${esc(c['Категория'])}</span> <span class="badge b-amber">${esc(c['Стадия'])}</span></div><dl class="kv">`;
  h+=`<dt>Суд / орган</dt><dd>${esc(c['Суд'])}</dd>`;
  h+=`<dt>Предмет спора</dt><dd>${esc(c['Предмет спора'])}</dd>`;
  if(c['ID договора']){const ct=DB.contracts.find(x=>String(x.ID)===String(c['ID договора']));h+=`<dt>Связанный договор</dt><dd>${ct?`<span class="linkish" onclick="closeModal();openContract('${esc(ct.ID)}')">${esc(ct['Полное название']||ct['Название'])}</span>`:esc(c['ID договора'])}</dd>`;}
  h+=`<dt>Истец</dt><dd>${esc(c['Истец'])}</dd><dt>Ответчик</dt><dd>${esc(c['Ответчик'])}</dd>`;
  h+=`<dt>Сумма исковых требований</dt><dd>${esc(c['Сумма исковых требований'])} ${esc(c['Валюта']||'руб.')}</dd>`;
  if(c['Сумма судебных расходов'])h+=`<dt>Судебные расходы</dt><dd>${esc(c['Сумма судебных расходов'])} руб.</dd>`;
  if(c['Назначенный юрист'])h+=`<dt>Юрист</dt><dd>${esc(c['Назначенный юрист'])}</dd>`;
  if(c['Дата следующего заседания']){const hd=parseDMY(c['Дата следующего заседания']);h+=`<dt>Следующее заседание</dt><dd>${esc(c['Дата следующего заседания'])} ${hd&&hd<today0()?'<span class="badge b-red">прошло</span>':(hd&&daysUntil(hd)<=7?'<span class="badge b-red">через '+daysUntil(hd)+' дн.</span>':'')}</dd>`;}
  if(c['Результат'])h+=`<dt>Результат</dt><dd>${esc(c['Результат'])}</dd>`;
  if(c['Дата решения'])h+=`<dt>Дата решения</dt><dd>${esc(c['Дата решения'])}</dd>`;
  if(c['Исполнительный лист'])h+=`<dt>Исполнительный лист</dt><dd>№ ${esc(c['Исполнительный лист'])} от ${esc(c['Дата выдачи ИЛ'])}</dd>`;
  if(c['Дата предъявления ИЛ'])h+=`<dt>Предъявлен в ФССП</dt><dd>${esc(c['Дата предъявления ИЛ'])}</dd>`;
  if(c['Исполнительное производство'])h+=`<dt>Исп. производство</dt><dd>${esc(c['Исполнительное производство'])}</dd>`;
  if(c['ФИО пристава'])h+=`<dt>Пристав</dt><dd>${esc(c['ФИО пристава'])} ${c['Телефон пристава']?esc(c['Телефон пристава']):''}</dd>`;
  if(c['Статус исполнения'])h+=`<dt>Статус исполнения</dt><dd>${esc(c['Статус исполнения'])}</dd>`;
  if(c['Дата окончания ИП'])h+=`<dt>Дата окончания ИП</dt><dd>${esc(c['Дата окончания ИП'])}</dd>`;
  if(c['Фактически взыскано'])h+=`<dt>Фактически взыскано</dt><dd>${esc(c['Фактически взыскано'])} руб.</dd>`;
  if(c['Ссылка на КАД'])h+=`<dt>Карточка в КАД</dt><dd><a class="linkish" href="${safeLink(c['Ссылка на КАД'])}" target="_blank">открыть</a></dd>`;
  if(c['Примечания'])h+=`<dt>Примечания</dt><dd>${esc(c['Примечания'])}</dd>`;
  h+=`</dl>`;
  if(docs.length){h+=`<h3 class="sec">Документы по делу</h3>`+docs.map(d=>`<a class="doclink" href="${safeLink(d.url)}" target="_blank">📄 ${esc(d.name||'Документ')}</a>`).join('');}
  openModal(h+'</div>');
}
function editCase(id){
  const c=id?(DB.cases||[]).find(x=>String(x.ID)===String(id)):null;
  const v=c?JSON.parse(JSON.stringify(c)):{ID:newId(DB.cases||[]),'Дата подачи':dmy(new Date()),'Валюта':'руб.','Документы по делу':[]};
  const contractOpts=DB.contracts.map(x=>`${esc(x['Полное название']||x['Название'])} [${x.ID}]`);
  openForm(c?'Изменить дело':'Новое дело',[
    {k:'Номер дела',l:'Номер дела'},{k:'Суд',l:'Суд / орган'},{k:'Категория',l:'Категория',list:DB.case_categories||[]},{k:'Стадия',l:'Стадия',list:DB.case_stages||[]},
    {k:'Дата подачи',l:'Дата подачи',t:'date'},{k:'Дата следующего заседания',l:'Дата следующего заседания',t:'date'},
    {k:'Предмет спора',l:'Предмет спора',full:1},{k:'ID договора',l:'Связанный договор (ID или название)',list:contractOpts,free:1},
    {k:'Истец',l:'Истец',full:1},{k:'Ответчик',l:'Ответчик',full:1},
    {k:'Сумма исковых требований',l:'Сумма исковых требований'},{k:'Валюта',l:'Валюта',list:['руб.','USD','EUR'],free:1},{k:'Сумма судебных расходов',l:'Сумма судебных расходов (руб.)'},
    {k:'Назначенный юрист',l:'Назначенный юрист',list:DB.executors,free:1},{k:'Результат',l:'Результат',list:DB.case_results||[],free:1},{k:'Дата решения',l:'Дата решения',t:'date'},
    {k:'Исполнительный лист',l:'№ исполнительного листа'},{k:'Дата выдачи ИЛ',l:'Дата выдачи ИЛ',t:'date'},{k:'Дата предъявления ИЛ',l:'Дата предъявления ИЛ в ФССП',t:'date'},
    {k:'Исполнительное производство',l:'№ исполнительного производства'},{k:'ФИО пристава',l:'ФИО пристава'},{k:'Телефон пристава',l:'Телефон пристава'},
    {k:'Статус исполнения',l:'Статус исполнения',list:DB.ip_statuses||[],free:1},{k:'Дата окончания ИП',l:'Дата окончания ИП',t:'date'},{k:'Фактически взыскано',l:'Фактически взыскано (руб.)'},
    {k:'Ссылка на КАД',l:'Ссылка на карточку в КАД',full:1},{k:'Примечания',l:'Примечания',ta:1,full:1},
  ],v,obj=>{
    if(!obj['Номер дела']){toast('Укажите номер дела',true);return false;}
    obj['Документы по делу']=collectCaseDocs();
    if(c)Object.assign(c,obj);else{(DB.cases=DB.cases||[]).unshift(obj);}
    scheduleSave();render();toast(c?'Дело обновлено':'Дело добавлено');
  },()=>caseDocsEditor(v['Документы по делу']||[]));
}
function caseDocsEditor(docs){
  return `<h3 class="sec">Документы по делу</h3><div class="subeditor" id="cdocs">${(docs||[]).map(cdocRow).join('')}</div><button class="btn" onclick="document.getElementById('cdocs').insertAdjacentHTML('beforeend',cdocRow())">＋ Документ</button>`;
}
function cdocRow(d){
  d=d||{name:'',url:''};
  return `<div class="row" style="grid-template-columns:1fr 1fr 30px"><input class="cd-name" placeholder="Название документа" value="${esc(d.name)}"><input class="cd-url" placeholder="Ссылка" value="${esc(d.url)}"><span class="iconbtn" onclick="this.closest('.row').remove()">✕</span></div>`;
}
function collectCaseDocs(){
  return [...document.querySelectorAll('#cdocs .row')].map(r=>({name:r.querySelector('.cd-name').value.trim(),url:r.querySelector('.cd-url').value.trim()})).filter(d=>d.name||d.url);
}
function delCase(id){const c=(DB.cases||[]).find(x=>String(x.ID)===String(id));if(!c)return;if(!confirm('Удалить дело '+c['Номер дела']+'?'))return;DB.cases=DB.cases.filter(x=>x!==c);scheduleSave();closeModal();render();toast('Дело удалено');}

let actSort={key:'Дата',dir:-1};
function renderActs(){$('#view').innerHTML=`<div class="toolbar"><input type="search" id="aq2" placeholder="Поиск: номер, название, полномочия…" oninput="drawActs()"><select id="aSt" onchange="drawActs()"><option value="">Статус: все</option>${(DB.act_statuses||[]).map(s=>`<option>${esc(s)}</option>`).join('')}</select><select id="aType" onchange="drawActs()"><option value="">Тип: все</option>${(DB.act_types||[]).map(s=>`<option>${esc(s)}</option>`).join('')}</select><button class="btn" onclick="['aq2','aSt','aType'].forEach(i=>document.getElementById(i).value='');drawActs()">Сброс</button><button class="btn primary" onclick="editAct()">＋ Акт</button><span class="count" id="acnt2"></span></div><div id="atable2"></div>`;drawActs();}
function drawActs(){
  const q=norm($('#aq2')?.value),st=$('#aSt')?.value,tp=$('#aType')?.value;const el=$('#atable2');if(!el)return;
  const list=(DB.acts||[]).filter(a=>{if(st&&a['Статус']!==st)return false;if(tp&&a['Тип']!==tp)return false;if(q){const hay=norm([a['Номер'],a['Полное наименование'],a['Полномочия'],a['Примечания']].join(' '));if(!hay.includes(q))return false;}return true;}).sort((a,b)=>{let va=toISO(a[actSort.key]),vb=toISO(b[actSort.key]);return (va<vb?-1:va>vb?1:0)*actSort.dir;});
  $('#acnt2').textContent=`Показано ${list.length} из ${(DB.acts||[]).length}`;
  const ar=k=>actSort.key===k?(actSort.dir>0?' ▲':' ▼'):'';
  let h=`<table><thead><tr><th onclick="setActSort('Тип')">Тип${ar('Тип')}</th><th onclick="setActSort('Номер')">№${ar('Номер')}</th><th onclick="setActSort('Дата')">Дата${ar('Дата')}</th><th>Полное наименование</th><th>Срок действия</th><th>Статус</th><th></th></tr></thead><tbody>`;
  for(const a of list){const ed=parseDMY(a['Срок действия']);const expired=ed&&ed<today0()?'<span class="badge b-red">просрочен</span>':'';h+=`<tr onclick="openAct('${esc(a.ID)}')"><td class="mut">${esc(a['Тип'])}</td><td class="mut">${esc(a['Номер'])}</td><td class="mut">${esc(a['Дата'])}</td><td>${esc(a['Полное наименование'])}</td><td class="mut">${esc(a['Срок действия'])} ${expired}</td><td>${esc(a['Статус'])}</td><td><span class="iconbtn" onclick="event.stopPropagation();editAct('${esc(a.ID)}')">✏️</span></td></tr>`;}
  el.innerHTML=h+'</tbody></table>';
}
function setActSort(k){if(actSort.key===k)actSort.dir*=-1;else{actSort.key=k;actSort.dir=1;}drawActs();}
function openAct(id){
  const a=(DB.acts||[]).find(x=>String(x.ID)===String(id));if(!a)return;
  let h=`<div class="mhead"><h2>${esc(a['Тип'])} № ${esc(a['Номер'])}</h2><span onclick="editAct('${esc(a.ID)}')" class="iconbtn">✏️</span><span onclick="delAct('${esc(a.ID)}')" class="iconbtn">🗑</span><span class="x" onclick="closeModal()">✕</span></div><div class="body">`;
  h+=`<div style="margin-bottom:12px"><span class="badge b-blue">${esc(a['Тип'])}</span> <span class="badge ${a['Статус']==='Действует'?'b-green':'b-gray'}">${esc(a['Статус'])}</span></div><dl class="kv">`;
  h+=`<dt>Номер</dt><dd>${esc(a['Номер'])}</dd><dt>Дата</dt><dd>${esc(a['Дата'])}</dd>`;
  h+=`<dt>Полное наименование</dt><dd>${esc(a['Полное наименование'])}</dd>`;
  if(a['Срок действия']){const ed=parseDMY(a['Срок действия']);h+=`<dt>Срок действия</dt><dd>${esc(a['Срок действия'])} ${ed&&ed<today0()?'<span class="badge b-red">просрочен</span>':(ed&&daysUntil(ed)<=30?'<span class="badge b-amber">осталось '+daysUntil(ed)+' дн.</span>':'')}</dd>`;}
  if(a['Полномочия'])h+=`<dt>Полномочия</dt><dd>${esc(a['Полномочия'])}</dd>`;
  if((a['Связанные договоры']||[]).length){h+=`<dt>Связанные договоры</dt><dd>`+(a['Связанные договоры']||[]).map(cid=>{const ct=DB.contracts.find(x=>String(x.ID)===String(cid));return ct?`<span class="linkish" onclick="closeModal();openContract('${esc(ct.ID)}')">${esc(ct['Полное название']||ct['Название'])}</span>`:esc(cid);}).join(', ')+`</dd>`;}
  if(a['Ссылка на скан'])h+=`<dt>Скан</dt><dd><a class="linkish" href="${safeLink(a['Ссылка на скан'])}" target="_blank">открыть</a></dd>`;
  if(a['Примечания'])h+=`<dt>Примечания</dt><dd>${esc(a['Примечания'])}</dd>`;
  h+=`</dl></div>`;
  openModal(h);
}
function editAct(id){
  const a=id?(DB.acts||[]).find(x=>String(x.ID)===String(id)):null;
  const v=a?JSON.parse(JSON.stringify(a)):{ID:newId(DB.acts||[]),'Дата':dmy(new Date()),'Статус':'Действует','Связанные договоры':[]};
  openForm(a?'Изменить акт':'Новый акт',[
    {k:'Тип',l:'Тип',list:DB.act_types||[]},{k:'Номер',l:'Номер'},{k:'Дата',l:'Дата',t:'date'},
    {k:'Полное наименование',l:'Полное наименование',full:1},{k:'Срок действия',l:'Срок действия',t:'date'},
    {k:'Статус',l:'Статус',list:DB.act_statuses||[]},{k:'Полномочия',l:'Полномочия',ta:1,full:1},
    {k:'Ссылка на скан',l:'Ссылка на скан',full:1},{k:'Примечания',l:'Примечания',ta:1,full:1},
  ],v,obj=>{
    if(!obj['Полное наименование']){toast('Укажите наименование',true);return false;}
    obj['Связанные договоры']=collectActContracts();
    if(a)Object.assign(a,obj);else{(DB.acts=DB.acts||[]).unshift(obj);}
    scheduleSave();render();toast(a?'Акт обновлён':'Акт добавлен');
  },()=>actContractsEditor(v['Связанные договоры']||[]));
}
function actContractsEditor(ids){
  return `<h3 class="sec">Связанные договоры</h3><div class="subeditor" id="actc">${(ids||[]).map(actcRow).join('')}</div><button class="btn" onclick="document.getElementById('actc').insertAdjacentHTML('beforeend',actcRow())">＋ Договор</button>`;
}
function actcRow(cid){
  const opts=DB.contracts.map(c=>`<option value="${esc(c.ID)}" ${String(c.ID)===String(cid)?'selected':''}>${esc(c['Полное название']||c['Название'])}</option>`).join('');
  return `<div class="row" style="grid-template-columns:1fr 30px"><select class="ac-id">${opts}</select><span class="iconbtn" onclick="this.closest('.row').remove()">✕</span></div>`;
}
function collectActContracts(){
  return [...document.querySelectorAll('#actc .row')].map(r=>r.querySelector('.ac-id').value).filter(Boolean);
}
function delAct(id){const a=(DB.acts||[]).find(x=>String(x.ID)===String(id));if(!a)return;if(!confirm('Удалить '+a['Тип']+' № '+a['Номер']+'?'))return;DB.acts=DB.acts.filter(x=>x!==a);scheduleSave();closeModal();render();toast('Акт удалён');}

function renderTemplates(){
  let h=`<div class="toolbar"><span class="count">Шаблоны документов</span></div>`;
  h+=`<div class="cards">`;
  h+=`<div class="card" onclick="tplLoan()"><div style="font-size:32px">📄</div><div style="margin:8px 0;font-weight:600">Договор займа</div><div class="mut">Сумма, ставка, срок</div></div>`;
  h+=`<div class="card" onclick="tplPoa()"><div style="font-size:32px">📜</div><div style="margin:8px 0;font-weight:600">Доверенность</div><div class="mut">На представительство</div></div>`;
  h+=`<div class="card" onclick="tplClaim()"><div style="font-size:32px">📨</div><div style="margin:8px 0;font-weight:600">Претензия</div><div class="mut">Требование о возврате</div></div>`;
  h+=`<div class="card" onclick="tplCession()"><div style="font-size:32px">🔄</div><div style="margin:8px 0;font-weight:600">Договор цессии</div><div class="mut">Уступка требования</div></div>`;
  h+=`</div>`;
  h+=`<div id="tplOut"></div>`;
  $('#view').innerHTML=h;
}
function tplLoan(){
  const c=prompt('Введите ID договора займа (или оставьте пустым для шаблона):');
  const contract=c?DB.contracts.find(x=>String(x.ID)===String(c)):null;
  const sum=contract?contract['Сумма']:'[СУММА]';
  const cur=contract?contract['Валюта']:'руб.';
  const rate=contract?contract['Процентная ставка']:'[СТАВКA]';
  const date=contract?contract['Дата']:dmy(new Date());
  const term=contract?contract['Контрольная дата']:'[СРОК]';
  const lender=contract?(contract['стороны']||[]).find(s=>s['наименование в договоре']==='Заимодавец')||{}:{'полное наименование стороны':'[ЗАИМОДАВЕЦ]'};
  const borrower=contract?(contract['стороны']||[]).find(s=>s['наименование в договоре']==='Заёмщик')||{}:{'полное наименование стороны':'[ЗАЁМЩИК]'};
  const text=`ДОГОВОР ЗАЙМА № ___________

г. Москва					${date}

${lender['полное наименование стороны']}, именуемый в дальнейшем «Заимодавец», с одной стороны, и
${borrower['полное наименование стороны']}, именуемый в дальнейшем «Заёмщик», с другой стороны, заключили настоящий договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА
1.1. Заимодавец предоставляет Заёмщику сумму ${sum} (${cur}), а Заёмщик обязуется возвратить эту сумму и уплатить проценты в порядке и на условиях, предусмотренных настоящим договором.

2. СТАВКА И ПОРЯДОК УПЛАТЫ ПРОЦЕНТОВ
2.1. Проценты начисляются на сумму займа из расчёта ${rate}% годовых.

3. СРОК ДЕЙСТВИЯ ДОГОВОРА
3.1. Заёмщик обязуется возвратить сумму займа и уплатить все начисленные проценты не позднее «${term}».

4. ПОРЯДОК ВОЗВРАТА
4.1. Возврат суммы займа и уплата процентов производятся единовременно путём перечисления денежных средств на расчётный счёт Заимодавца.

5. ОТВЕТСТВЕННОСТЬ СТОРОН
5.1. За нарушение сроков возврата займа и/или уплаты процентов Заёмщик уплачивает неустойку в размере 0,1% от суммы просроченного обязательства за каждый день просрочки.

6. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ
6.1. Настоящий договор составлен в двух экземплярах, имеющих одинаковую юридическую силу.

Подписи сторон:

Заимодавец: _________________ / _________________

Заёмщик: _________________ / _________________`;
  showTemplate('Договор займа',text);
}
function tplPoa(){
  const text=`ДОВЕРЕННОСТЬ

№ ___________

Дата выдачи: ${dmy(new Date())}

Я, [ФИО ДОВЕРИТЕЛЯ], [должность/статус], действующий на основании [документ],
доверяю [ФИО ПОВЕРЕННОГО] представлять мои интересы:

— в Арбитражном суде [наименование] в деле № [номер];
— в Федеральной службе судебных приставов;
— в налоговых и иных государственных органах;
— в банках и иных кредитных организациях;
— на получении документов и корреспонденции.

Полномочия по настоящей доверенности не могут быть переданы другим лицам.

Срок действия: до [дата].

Подпись доверителя: _________________ / _________________`;
  showTemplate('Доверенность',text);
}
function tplClaim(){
  const c=prompt('Введите ID договора займа:');
  const contract=c?DB.contracts.find(x=>String(x.ID)===String(c)):null;
  const sum=contract?contract['Сумма']:'[СУММА]';
  const date=contract?contract['Дата']:dmy(new Date());
  const lender=contract?(contract['стороны']||[]).find(s=>s['наименование в договоре']==='Заимодавец')||{}:{'полное наименование стороны':'[ЗАИМОДАВЕЦ]'};
  const borrower=contract?(contract['стороны']||[]).find(s=>s['наименование в договоре']==='Заёмщик')||{}:{'полное наименование стороны':'[ЗАЁМЩИК]'};
  const text=`ПРЕТЕНЗИЯ

От: ${lender['полное наименование стороны']}
Кому: ${borrower['полное наименование стороны']}

${dmy(new Date())}

УВАЖАЕМЫЙ(АЯ) ${borrower['полное наименование стороны']}!

${date} между нами заключён договор займа на сумму ${sum} руб.

В соответствии с условиями договора Вы обязаны были возвратить сумму займа и уплатить проценты в установленный срок.

На настоящий момент задолженность не погашена.

В соответствии со ст. 309, 310, 811 ГК РФ требую:
1. В срок до 30 (тридцати) календарных дней с даты получения настоящей претензии возвратить сумму займа в размере ${sum} руб.
2. Уплатить проценты за пользование займом.
3. В случае неисполнения требований в установленный срок оставляю за собой право обратиться в суд.

Приложение: копия договора займа.

${lender['полное наименование стороны']}
Подпись _________________`;
  showTemplate('Претензия',text);
}
function tplCession(){
  const text=`ДОГОВОР УСТУПКИ ТРЕБОВАНИЯ (ЦЕССИИ)

№ ___________

г. Москва		${dmy(new Date())}

[ЦЕДЕНТ], именуемый в дальнейшем «Цедент», с одной стороны, и [ЦЕССИОНАРИЙ], именуемый в дальнейшем «Цессионарий», с другой стороны, заключили настоящий договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА
1.1. Цедент уступает, а Цессионарий принимает право требования (требование) к [ДОЛЖНИК] в размере [СУММА] руб., возникшее на основании [ОСНОВАНИЕ].

2. ЦЕНА УСТУПКИ
2.1. Цена уступки составляет [СУММА] руб. и уплачивается Цессионарием в срок до [ДАТА].

3. ПЕРЕХОД ПРАВ
3.1. Права по уступленному требованию переходят к Цессионарию с момента подписания настоящего договора и оплаты цены уступки.

4. ОБЯЗАТЕЛЬСТВА ЦЕДЕНТА
4.1. Цедент обязуется передать Цессионарию все документы, подтверждающие уступленное требование.

5. РЕКВИЗИТЫ И ПОДПИСИ

Цедент: _________________ / _________________

Цессионарий: _________________ / _________________`;
  showTemplate('Договор цессии',text);
}
function showTemplate(title,text){
  $('#tplOut').innerHTML=`<h3 class="sec">${esc(title)} — скопируйте текст</h3><div class="tpl-preview">${esc(text)}</div><div style="margin-top:10px"><button class="btn" onclick="navigator.clipboard.writeText(document.querySelector('.tpl-preview').textContent);toast('Скопировано')">📋 Копировать</button></div>`;
}
function openForm(title,fields,v,onSave,extraHTML){
  let h=`<div class="mhead"><h2>${esc(title)}</h2><span class="x" onclick="closeModal()">✕</span></div><div class="body"><form class="grid" id="frm">`;
  for(const f of fields){
    const val=v[f.k]??'';let inp;
    if(f.t==='check')inp=`<input type="checkbox" name="${esc(f.k)}" ${(val==='да'||val==='true')?'checked':''}>`;
    else if(f.t==='date')inp=`<input type="date" name="${esc(f.k)}" value="${val?toISO(val).replace(/(\d{4})(\d{2})(\d{2})/,'$1-$2-$3'):''}">`;
    else if(f.t==='ta')inp=`<textarea name="${esc(f.k)}">${esc(val)}</textarea>`;
    else if(f.list)inp=`<input name="${esc(f.k)}" list="dl_${f.k.replace(/\s/g,'_')}" value="${esc(val)}"><datalist id="dl_${f.k.replace(/\s/g,'_')}">${f.list.map(o=>`<option value="${esc(o)}">`).join('')}</datalist>`;
    else inp=`<input name="${esc(f.k)}" value="${esc(val)}">`;
    h+=`<div class="${f.full?'full':''}"><label>${esc(f.l)}</label>${inp}</div>`;
  }
  h+=`</form><div id="extra" style="margin-top:16px">${extraHTML?extraHTML():''}</div>
  <div style="margin-top:18px;display:flex;gap:10px"><button class="btn primary" id="saveBtn">💾 Сохранить</button><button class="btn" onclick="closeModal()">Отмена</button></div></div>`;
  openModal(h);
  $('#saveBtn').onclick=()=>{
    const obj={...v};
    for(const f of fields){
      const el=document.querySelector(`#frm [name="${CSS.escape(f.k)}"]`);if(!el)continue;
      if(f.t==='check')obj[f.k]=el.checked?'да':'';
      else if(f.t==='date'){const [y,m,dd]=el.value.split('-');obj[f.k]=el.value?dd+'.'+m+'.'+y:'';}
      else obj[f.k]=el.value.trim();
    }
    if(document.getElementById('sides'))obj['стороны']=collectSides();
    const r=onSave(obj);if(r===false)return;if(r&&typeof r.then==='function'){r.then(()=>closeModal()).catch(()=>{});return;}closeModal();
  };
}

(async()=>{
  await loadSnap();
  await initData();
  if(checkSession()){$('#loginOverlay').style.display='none';$('#userMenu').style.display='flex';$('#userMenu').innerHTML=`<span>${esc(SESSION.name)}</span><button onclick="doLogout()">Выйти</button>`;}
  renderTabs();render();
  if(SET.autosend==='да'&&localStorage.getItem('reestr_digest')!==new Date().toDateString())sendDigest(false);
})();
