/* Integration only. The standalone document retains its original UI. */
let macRpcId=0;
const macRpcPending=new Map();
function macRPC(action,payload={}){
 return new Promise((resolve,reject)=>{
  const id='mac-'+(++macRpcId);const timer=setTimeout(()=>{macRpcPending.delete(id);reject(Error('A ligação Cloud não respondeu.'));},30000);
  macRpcPending.set(id,{resolve,reject,timer});parent.postMessage({macVisionBridge:1,kind:'request',id,action,payload},location.origin);
 });
}
window.addEventListener('message',event=>{
 if(event.source!==parent||event.origin!==location.origin||event.data?.macVisionBridge!==1)return;
 const data=event.data;
 if(data.kind==='response'){const job=macRpcPending.get(data.id);if(!job)return;clearTimeout(job.timer);macRpcPending.delete(data.id);data.error?job.reject(Error(data.error)):job.resolve(data.result);}
 if(data.kind==='event'&&session){void (async()=>{
  if(data.event==='preferences-changed'){const prefs=await macRPC('preferences');macVolatilePrefs.clear();for(const [k,v] of Object.entries(prefs||{}))macVolatilePrefs.set(k,v);return;}
  if(data.event==='registry-changed'){return;} // Refresh on explicit load/save; never replace an in-progress account edit.
  if(macStateDirty||saveTimer!==null)return;
  const next=await macRPC('read',{key:'store:'+currentShopId,accept:true});if(next&&JSON.stringify(next)!==JSON.stringify(state)){state=shape(next);render();}
 })().catch(console.warn);}
});
const macSessionDraft=new Map();
let macCloudDirectory=null;
initDB=async function(){db=null;storageKind='cloud';macCloudDirectory=await macRPC('directory');};
readKey=async function(key){
 if(key===REGISTRY_KEY)return macCloudDirectory?.stores||[];
 if(macSessionDraft.has(key))return macSessionDraft.get(key);
 try{return await macRPC('read',{key,accept:!macStateDirty&&saveTimer===null});}catch(error){if(!session&&!pendingSetupManager)return null;throw error;}
};
writeKey=async function(key,value){
 if(key===REGISTRY_KEY){await macRPC('registry-save',{stores:value});macCloudDirectory=await macRPC('directory');shopRegistry=structuredClone(macCloudDirectory.stores);return true;}
 if(key===MAC_PENDING_MANAGER_KEY||key===MAC_SETUP_WORKSPACE_KEY){await macRPC('write',{key,value});macSessionDraft.set(key,structuredClone(value));return true;}
 return macRPC('write',{key,value});
};
deleteKey=async function(key){await macRPC('delete',{key});macSessionDraft.delete(key);return true;};
readLegacyState=async()=>null;
clearPreviousMacVisionDataOnce=async()=>{};
resetMacStoresForFirstStartOnce=async()=>{};
clearAllAccessAccountsOnce=async()=>{};
purgeStoredCommissionDetails=async()=>{};
restoreLocalSession=async()=>false;
rememberLocalSession=()=>{};
forgetLocalSession=()=>{};
signalMacLocalChange=()=>{};
const macOriginalMakeUser=makeUser;
makeUser=async function(name,role,password,employee=''){
  // A page opened before a reset may hold an outdated setup state; re-check Cloud before refusing.
  if(!pendingSetupManager&&!session&&!macCloudDirectory?.setupAuthorized){try{macCloudDirectory=await macRPC('directory');}catch(_){}}
  if(!pendingSetupManager&&!session&&macCloudDirectory?.setupAuthorized){
  const wallet=document.getElementById('setupCarteira').value.trim().toUpperCase();
  return macRPC('bootstrap',{name,role,password,wallet,appName:document.getElementById('setupAppName').value});
 }
  if(!pendingSetupManager&&!session)throw Error('A criação do Gestor de Área não está disponível neste endereço.');
 return macRPC('account',{name,role,password,employee});
};
const macOriginalSubmitLogin=submitLogin;
submitLogin=async function(event){
 event.preventDefault();const {shop,user}=selectedLoginAccount();if(!shop||!user)return authError('Escolhe acesso, utilizador e loja.');
 try{await macRPC('login',{id:user.id,password:document.getElementById('loginPassword').value});macCloudDirectory=await macRPC('directory');shopRegistry=macCloudDirectory.stores;const privateShop=shopRegistry.find(s=>s.id===shop.id),privateUser=privateShop?.users.find(u=>u.id===user.id);if(!privateShop||!privateUser)throw Error('Acesso à loja não autorizado.');const access=Object.fromEntries(shopRegistry.filter(s=>s.users.some(u=>u.id===user.id)).map(s=>[s.id,user.id]));await loginToStore(privateShop,privateUser,access,document.getElementById('loginRole').value);authError('');}catch(error){authError(error.message);}
};
const macOriginalLogout=logout;
logout=async function(){const result=await macOriginalLogout.apply(this,arguments);if(!session)await macRPC('logout');return result;};
const macOriginalLoadRegistry=loadRegistry;
loadRegistry=async function(){shopRegistry=structuredClone(macCloudDirectory?.stores||[]);};
const macRestorePending=restorePendingFirstManager;
restorePendingFirstManager=async function(){
 if(macCloudDirectory?.setupAuthorized){pendingSetupManager=null;pendingSetupWorkspace={managers:[],stores:[]};macSessionDraft.clear();return;}
 await macRestorePending();
 if(pendingSetupManager){
  const valid=macCloudDirectory?.accounts?.some(a=>a.id===pendingSetupManager.id&&a.role==='admin');
  if(!valid){pendingSetupManager=null;pendingSetupWorkspace={managers:[],stores:[]};}
 }
};
const macOriginalStart=start;
start=async function(){
 const field=document.getElementById('setupCarteira');
 const label=document.querySelector('label[for="setupCarteira"]');if(label)label.textContent='Nome da Carteira';
 field?.setAttribute('pattern','[A-Z0-9_\\-]{1,20}');
 field?.addEventListener('input',()=>{field.value=field.value.toUpperCase();});
 // Browser autofill must never re-enter names or passwords from a previous installation.
 for(const id of ['setupAppName','setupCarteira','setupManager','setupPassword','setupConfirm','setupShopManagerName'])document.getElementById(id)?.setAttribute('autocomplete',/Password|Confirm/.test(id)?'new-password':'off');
 await macOriginalStart();
};
// Initial setup may finish with stores only; GL and collaborators can be added later from the original menus.
const macOriginalRenderPending=renderPendingAreaSetup;
renderPendingAreaSetup=function(){
 const result=macOriginalRenderPending.apply(this,arguments);
 const finish=document.getElementById('setupFinish'),d=pendingSetupWorkspace;
 if(finish&&pendingSetupManager)finish.disabled=!d.stores.length||d.managers.some(u=>u.setupPermission==='store'&&!(u.assignedStoreIds||[]).length);
 return result;
};
finishAreaSetup=async function(){
 if(!pendingSetupManager)return authError('Cria primeiro o Gestor de Área.');
 const d=pendingSetupWorkspace;
 if(!d.stores.length)return authError('Cria pelo menos uma loja.');
 if(d.managers.some(u=>u.setupPermission==='store'&&!(u.assignedStoreIds||[]).length))return authError('Atribui uma loja a cada Gestor de Loja.');
 if(shopRegistry.some(st=>(st.users||[]).length))return authError('A configuração inicial já foi concluída.');
 const master={...pendingSetupManager,adminOnly:true,salesEnabled:false};
 const stores=d.stores.map(st=>{
  const users=[{...master}];
  for(const mgr of d.managers){
   if(mgr.setupPermission==='store'&&!(mgr.assignedStoreIds||[]).includes(st.id))continue;
   const {setupPermission,assignedStoreIds,...cleanAccount}=mgr;users.push({...cleanAccount});
  }
  return {id:st.id,name:st.name,excelCode:'',users};
 });
 // Cloud registers stores and accesses first; store documents are scoped to registered stores.
 await macRPC('registry-save',{stores});
 for(const st of stores)await writeKey('store:'+st.id,shape(blankStoreData(st)));
 macCloudDirectory=await macRPC('directory');shopRegistry=structuredClone(macCloudDirectory.stores);
 const own=shopRegistry.filter(st=>stores.some(x=>x.id===st.id));
 if(!own.length)throw Error('As lojas não foram confirmadas pela Cloud. Tenta novamente.');
 const access=Object.fromEntries(own.map(st=>[st.id,master.id]));
 await deleteKey(MAC_PENDING_MANAGER_KEY);await deleteKey(MAC_SETUP_WORKSPACE_KEY);
 pendingSetupManager=null;pendingSetupWorkspace={managers:[],stores:[]};authError('');
 const first=own[0],firstUser=first.users.find(u=>u.id===master.id)||first.users[0];
 await loginToStore(first,firstUser,access,'administrador');
 toast(`Configuração concluída: ${own.length} ${own.length===1?'loja':'lojas'}${d.managers.length?` e ${d.managers.length} ${d.managers.length===1?'gestor':'gestores'}`:''}.`);
};

const macVolatilePrefs=new Map();
let macPrefQueue=Promise.resolve();
function macQueuePreference(key,value){if(!session)return;macPrefQueue=macPrefQueue.catch(()=>{}).then(()=>macRPC('preference',{key:String(key),value}));void macPrefQueue.catch(error=>{setLocalStatus(false);macOriginalToast('Preferência não guardada na Cloud: '+error.message,true);});}
Object.defineProperty(window,'localStorage',{value:{
 getItem:key=>macVolatilePrefs.get(String(key))??null,
 setItem(key,value){macVolatilePrefs.set(String(key),String(value));macQueuePreference(key,String(value));},
 removeItem(key){macVolatilePrefs.delete(String(key));macQueuePreference(key,null);},
 key:index=>[...macVolatilePrefs.keys()][index]??null,
 get length(){return macVolatilePrefs.size;}
}});
const macLoginWithPrefs=loginToStore;
loginToStore=async function(){
 const prefs=await macRPC('preferences');for(const [key,value] of Object.entries(prefs||{}))macVolatilePrefs.set(key,value);
 return macLoginWithPrefs.apply(this,arguments);
};
async function macSaveBlob(file,key){
 const bytes=new Uint8Array(await file.arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
 const scoped=shopRegistry.find(s=>String(key).startsWith(s.id+'|'))?.id||currentShopId;
 return macRPC('write',{key:'attachment:'+key,value:{data:btoa(text),name:file.name||'',type:file.type||'',storeId:scoped}});
}
async function macGetBlob(key){const item=await macRPC('read',{key:'attachment:'+key});if(!item)return null;return new File([Uint8Array.from(atob(item.data),c=>c.charCodeAt(0))],item.name,{type:item.type});}
resetUserPassword=async function(id,shopId=viewedAccessShop()?.id){
 const user=shopRegistry.find(s=>s.id===shopId)?.users.find(u=>u.id===id);if(!user)return;
 const password=prompt('Nova password para '+user.name+' (mínimo 4 números):');if(password===null)return;
 try{await macRPC('password',{id,password,storeId:shopId});toast('Password alterada na Cloud.');}catch(error){toast(error.message,true);}
};
removeUser=async function(id,shopId=viewedAccessShop()?.id){
 const user=shopRegistry.find(s=>s.id===shopId)?.users.find(u=>u.id===id);if(!user)return;
 if(!confirm('Remover explicitamente o acesso de '+user.name+' a esta loja? A conta será preservada na Cloud.'))return;
 await macRPC('remove-access',{id,storeId:shopId});
 macCloudDirectory=await macRPC('directory');shopRegistry=structuredClone(macCloudDirectory.stores);renderAccess();renderOptions();toast('Acesso removido; conta preservada na Cloud.');
};

// A success message is never evidence of persistence until Cloud acknowledges it.
function macPt(message){
 const text=String(message??'');
 if(/weak|easy to guess|pwned|at least \d+ characters/i.test(text))return 'A password não foi aceite. Usa, no mínimo, 4 números.';
 if(/failed to fetch|network|load failed/i.test(text))return 'Sem ligação à Cloud. Verifica a internet e tenta novamente.';
 if(/\b(the|is|not|failed|error|invalid|unable|cannot|undefined|null|of|reading|must|should)\b/i.test(text)&&!/[áàâãéêíóôõúçÁÉÍÓÚÇ]/.test(text))return 'Não foi possível concluir a operação. Tenta novamente.';
 return text;
}
const macOriginalAuthError=authError;
authError=function(message=''){return macOriginalAuthError(message?macPt(message):message);};
const macOriginalToast=toast;
toast=function(message,error=false){
 if(error)message=macPt(message);
 if(!error&&session&&(macStateDirty||saveTimer!==null)&&/registad|atualizad|guardad|eliminad|removid|restaurad|importad|conclu[ií]d|partilhad|retirada/i.test(String(message))){
  void macFlushChangesForExit().then(ok=>{if(ok)macOriginalToast(message,false);else macOriginalToast('Não guardado na Cloud. Alterações pendentes nesta sessão; não feches o navegador.',true);});return;
 }
 return macOriginalToast(message,error);
};
setLocalStatus=function(ok){localStatus=ok?'ok':'nok';const led=document.getElementById('localSyncIndicator'),label=document.getElementById('localSyncLabel');if(!led||!label)return;led.classList.toggle('bad',!ok);led.classList.toggle('ok',!!ok);led.title=ok?'Cloud: gravação confirmada':'Cloud: alterações não guardadas';label.textContent=led.title;};
const macOriginalMarkUnsaved=macMarkUnsaved;
macMarkUnsaved=function(){macOriginalMarkUnsaved();setLocalStatus(false);};
window.addEventListener('beforeunload',event=>{if(macStateDirty||saveTimer!==null){event.preventDefault();event.returnValue='';}});// Language is a personal preference: saved per user in Cloud profile preferences, never via the admin registry.
const MAC_LANGUAGE_PREF='macVision.language';
changeUserLanguage=async function(locale){
 if(!session||!['pt','en','es','fr','de','ar','tr','br'].includes(locale))return;
 try{await macRPC('preference',{key:MAC_LANGUAGE_PREF,value:locale});}catch(error){return toast(error.message,true);}
 macVolatilePrefs.set(MAC_LANGUAGE_PREF,locale);
 setLanguageForSession(locale);
 toast(uiString('Língua alterada.'));
};
const macLoginWithLanguage=loginToStore;
loginToStore=async function(){
 const result=await macLoginWithLanguage.apply(this,arguments);
 const lang=macVolatilePrefs.get(MAC_LANGUAGE_PREF);
 if(session&&lang)setLanguageForSession(lang);
 return result;
};

// Session inactivity (30 min), cross-tab logout, Cloud health light and chat status dot.
const MAC_IDLE_MS=30*60*1000,MAC_ACTIVITY_KEY='mac-vision-last-activity',MAC_LOGOUT_KEY='mac-vision-logout';
function macLastActivity(){return Number(localStorage.getItem(MAC_ACTIVITY_KEY)||0);}
let macActivityWrite=0;
function macTouch(force){const now=Date.now();if(!force&&now-macActivityWrite<5000)return;macActivityWrite=now;try{localStorage.setItem(MAC_ACTIVITY_KEY,String(now));}catch{}}
['pointerdown','keydown','touchstart','wheel'].forEach(t=>window.addEventListener(t,e=>{if(e.isTrusted&&session)macTouch(false);},{passive:true,capture:true}));
let macIdleClosing=false;
async function macIdleLogout(broadcast){
 if(!session||macIdleClosing)return;macIdleClosing=true;
 try{if(broadcast)localStorage.setItem(MAC_LOGOUT_KEY,String(Date.now()));await logout();}finally{macIdleClosing=false;}
}
function macIdleCheck(){if(session&&macLastActivity()&&Date.now()-macLastActivity()>=MAC_IDLE_MS)void macIdleLogout(true);}
setInterval(macIdleCheck,15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){macIdleCheck();void macCloudHealth();}});
window.addEventListener('focus',macIdleCheck);
window.addEventListener('storage',e=>{if(e.key===MAC_LOGOUT_KEY&&e.newValue)void macIdleLogout(false);});
const macRestoreWithIdle=restoreLocalSession;
restoreLocalSession=async function(){
 const last=macLastActivity();
 if(last&&Date.now()-last>=MAC_IDLE_MS){forgetLocalSession();try{await macRPC('logout');}catch{}return false;}
 const ok=await macRestoreWithIdle.apply(this,arguments);if(ok)macTouch(true);return ok;
};
const macLoginWithIdle=loginToStore;
loginToStore=async function(){macTouch(true);const r=await macLoginWithIdle.apply(this,arguments);if(session)macTouch(true);return r;};
const macLogoutWithBroadcast=logout;
logout=async function(){const was=!!session;const r=await macLogoutWithBroadcast.apply(this,arguments);if(was&&!session&&!macIdleClosing){try{localStorage.setItem(MAC_LOGOUT_KEY,String(Date.now()));}catch{}}return r;};

let macCloudOk=true,macHealthBusy=false,macHealthDelay=30000,macHealthTimer=null;
function macPaintHealth(){const led=document.getElementById('localSyncIndicator'),label=document.getElementById('localSyncLabel');if(!led||!label)return;const ok=macCloudOk&&localStatus!=='nok';led.classList.toggle('bad',!ok);led.classList.toggle('ok',ok);led.title=!macCloudOk?'Cloud: sem ligação':ok?'Cloud: ligada e verificada':'Cloud: alterações não guardadas';label.textContent=led.title;}
async function macCloudHealth(){
 if(macHealthBusy)return;macHealthBusy=true;clearTimeout(macHealthTimer);
 try{await macRPC('ping');macCloudOk=true;macHealthDelay=30000;}catch{macCloudOk=false;macHealthDelay=Math.min(macHealthDelay===30000?5000:macHealthDelay*2,60000);}
 finally{macHealthBusy=false;macPaintHealth();macHealthTimer=setTimeout(macCloudHealth,macHealthDelay);}
}
const macSetLocalStatusHealth=setLocalStatus;
setLocalStatus=function(ok){macSetLocalStatusHealth(ok);macPaintHealth();};
window.addEventListener('online',()=>void macCloudHealth());
window.addEventListener('offline',()=>{macCloudOk=false;macPaintHealth();});
setTimeout(macCloudHealth,1500);

(function(){
 const st=document.createElement('style');
 st.textContent='#macChatCloudStatus{font-size:0!important;line-height:0!important;display:block;width:9px;height:9px;min-width:9px;border-radius:50%;margin-top:5px!important;background:#e5484d}#macChatCloudStatus.mac-cloud-on{background:#19c989}#macChatCloudStatus.mac-cloud-off{background:#e5484d}';
 document.head.appendChild(st);
 const sync=el=>{const on=el.classList.contains('mac-cloud-on');const l=on?'Chat Vision ligado à Cloud':'Chat Vision sem ligação à Cloud';if(el.getAttribute('aria-label')!==l){el.setAttribute('aria-label',l);el.setAttribute('role','status');el.title=l;}};
 const hook=()=>{const el=document.getElementById('macChatCloudStatus');if(!el)return false;sync(el);new MutationObserver(()=>sync(el)).observe(el,{attributes:true,attributeFilter:['class']});return true;};
 if(!hook())document.addEventListener('DOMContentLoaded',hook,{once:true});
})();

// Admin (GA / Gestor MAC Vision) comes from the Cloud directory; the session object has no admin fields. Backend re-checks.
window.macIsChatAdmin=()=>{if(!session)return false;if(session.isAreaMaster||session.adminRole||session.accessKind==='administrador')return true;const u=(macCloudDirectory?.stores||[]).flatMap(s=>s.users||[]).find(u=>String(u.id)===String(session.id));return !!(u&&(u.isAreaMaster||u.adminRole));};
// Chat Vision: header, human presence (green/yellow/red), 👥 picker, open-conversation tabs, admin edit/delete of a selected message.
(function(){
 const $c=id=>document.getElementById(id);
 const st=document.createElement('style');
 st.textContent=`#macChatParticipants{display:none!important}#macChatTitle,#macChatCloudStatus,#macChatEditMode,#macChatDeleteConversation{display:none!important}
#macChatPanel{position:fixed}.mcv-head{display:flex;flex-direction:column;min-width:0;flex:1 1 auto;gap:2px}.mcv-title{display:flex;align-items:center;gap:6px;font-weight:700;white-space:nowrap}.mcv-date{font-size:11px;font-weight:400;opacity:.75}
.mcv-dot{display:inline-block;width:9px;height:9px;min-width:9px;border-radius:50%;background:#e5484d}.mcv-dot.on{background:#19c989}.mcv-dot.away{background:#f5c518}
.mcv-tabs{display:flex;gap:4px;overflow-x:auto;max-width:100%;margin-top:4px;scrollbar-width:thin}.mcv-tab{display:inline-flex;align-items:center;gap:4px;padding:2px 4px 2px 2px;border:1px solid var(--border);border-radius:999px;background:transparent;color:inherit;font-size:11px;white-space:nowrap;flex:0 0 auto;cursor:pointer}.mcv-tab.active{border-color:var(--accent);background:var(--accent-dark)}.mcv-tab .employee-avatar{width:20px!important;height:20px!important;min-width:20px!important;font-size:9px!important}.mcv-x{border:0;background:none;color:inherit;opacity:.7;cursor:pointer;padding:0 2px;font-size:11px}
.mcv-menu{position:absolute;z-index:30;left:8px;right:8px;top:62px;max-height:60%;display:flex;flex-direction:column;background:var(--surface2);border:1px solid var(--border);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.4);padding:8px;gap:6px}.mcv-menu input{width:100%}.mcv-list{overflow:auto;display:flex;flex-direction:column;gap:2px}
.mcv-item{display:flex;align-items:center;gap:8px;padding:6px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;cursor:pointer}.mcv-item:hover{background:var(--surface)}.mcv-item .employee-avatar{width:30px!important;height:30px!important;min-width:30px!important}.mcv-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}.mcv-time{font-size:11px;opacity:.75}.mcv-count{background:var(--red);color:#fff;border-radius:999px;font-size:10px;padding:0 5px}
.mac-chat-message.mcv-sel{outline:2px solid var(--accent);outline-offset:1px}`;
 document.head.appendChild(st);
 let presence={},selected='',menuOpen=false,query='';
 const TODOS='todos';
 const openKey=()=>'mac-chat-open-'+(session?.id||'');
 const getOpen=()=>{try{return JSON.parse(sessionStorage.getItem(openKey())||'[]')}catch{return[]}};
 const setOpen=l=>{try{sessionStorage.setItem(openKey(),JSON.stringify(l))}catch{}};
 const isAdmin=()=>window.macIsChatAdmin();
 const dd=d=>String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function stateOf(id){if(id===TODOS)return 'on';const t=presence[id]?new Date(presence[id]).getTime():0,a=Date.now()-t;return !t?'off':a<60000?'on':a<300000?'away':'off';}
 const rank={on:0,away:1,off:2};
 function photoOf(id,name){const u=(macCloudDirectory?.stores||[]).flatMap(s=>s.users||[]).find(u=>u.id===id&&u.photo);try{return u?.photo||employeePhotoIn(state,name)||''}catch{return u?.photo||''}}
 function startOf(name){try{const today=new Date().toISOString().slice(0,10);const s=state.schedules.find(x=>x.date===today&&norm(x.employee)===norm(name));return s?(s.start||state.codeTimes?.[s.code]?.start||''):''}catch{return''}}
 function people(){return [...document.querySelectorAll('#macChatParticipants [data-cloud-person]')].map(b=>({id:b.dataset.cloudPerson,name:b.querySelector('.mac-chat-person-label')?.textContent||'',active:b.classList.contains('active'),count:Number(b.querySelector('.mac-chat-person-count')?.textContent||0)}));}
 function avatar(p){return p.id===TODOS?'<span class="employee-avatar small">👥</span>':avatarFor(p.name,photoOf(p.id,p.name),'small');}
 function choose(id){const b=document.querySelector('#macChatParticipants [data-cloud-person="'+CSS.escape(id)+'"]');if(!b)return;const l=getOpen();if(!l.includes(id)){l.push(id);setOpen(l);}selected='';b.click();menuOpen=false;paint();}
 function ensure(){
  const panel=$c('macChatPanel'),head=panel?.querySelector('.mac-chat-head'),actions=head?.querySelector('.mac-chat-head-actions');if(!head||!actions)return null;
  if(!$c('mcvHead')){const d=document.createElement('div');d.id='mcvHead';d.className='mcv-head';d.innerHTML='<div class="mcv-title"><span class="mcv-dot" id="mcvSelf" role="status"></span><strong>💬 Chat Vision</strong></div><div class="mcv-date" id="mcvDate"></div><div class="mcv-tabs" id="mcvTabs"></div>';head.insertBefore(d,head.firstChild);
   const mk=(id,txt,label)=>{const b=document.createElement('button');b.type='button';b.className='btn small mac-chat-action';b.id=id;b.textContent=txt;b.title=label;b.setAttribute('aria-label',label);return b;};
   const pick=mk('mcvPick','👥','Colaboradores'),ed=mk('mcvEdit','✏️','Editar mensagem'),del=mk('mcvDel','🗑️','Eliminar mensagem');del.classList.add('mac-chat-danger');
   actions.insertBefore(del,actions.firstChild);actions.insertBefore(ed,actions.firstChild);actions.insertBefore(pick,actions.firstChild);
   pick.onclick=()=>{menuOpen=!menuOpen;query='';paint();if(menuOpen)setTimeout(()=>$c('mcvSearch')?.focus(),0);};
   ed.onclick=async()=>{const m=document.querySelector('[data-msg-id="'+CSS.escape(selected)+'"]');if(!m||!isAdmin())return;const body=prompt('Editar mensagem:',m.querySelector('.mac-chat-message-body')?.textContent||'');if(body===null)return;if(!body.trim())return toast('A mensagem não pode ficar vazia.',true);try{await macRPC('admin-moderate',{messageId:selected,body:body.trim().slice(0,1000)});toast('Mensagem editada.');}catch(e){toast(e.message,true);}};
   del.onclick=async()=>{if(!selected||!isAdmin()||!confirm('Eliminar esta mensagem para todos?'))return;try{await macRPC('admin-moderate',{messageId:selected,body:null});selected='';paint();toast('Mensagem eliminada.');}catch(e){toast(e.message,true);}};
   $c('macChatMessages')?.addEventListener('click',e=>{if(!isAdmin()||e.target.closest('button'))return;const m=e.target.closest('[data-msg-id]');if(!m)return;selected=selected===m.dataset.msgId?'':m.dataset.msgId;paint();});
   const menu=document.createElement('div');menu.className='mcv-menu';menu.id='mcvMenu';menu.hidden=true;menu.innerHTML='<input id="mcvSearch" type="search" placeholder="Pesquisar colaborador…" aria-label="Pesquisar colaborador" autocomplete="off"><div class="mcv-list" id="mcvList"></div>';panel.appendChild(menu);
   $c('mcvSearch').oninput=e=>{query=e.target.value;paintList();};
   $c('mcvList').onclick=e=>{const b=e.target.closest('[data-mcv]');if(b)choose(b.dataset.mcv);};
   $c('mcvTabs').onclick=e=>{const x=e.target.closest('[data-mcv-close]');if(x){e.stopPropagation();const id=x.dataset.mcvClose;setOpen(getOpen().filter(i=>i!==id));const cur=people().find(p=>p.active);if(cur?.id===id)document.querySelector('#macChatParticipants [data-cloud-person="todos"]')?.click();paint();return;}const t=e.target.closest('[data-mcv-tab]');if(t)choose(t.dataset.mcvTab);};
   document.addEventListener('pointerdown',e=>{if(menuOpen&&!e.target.closest('#mcvMenu,#mcvPick')){menuOpen=false;paint();}});
  }
  return panel;
 }
 function paintList(){
  const list=$c('mcvList');if(!list)return;const q=norm(query);
  const ps=people().map(p=>({...p,s:stateOf(p.id),t:p.id===TODOS?'':startOf(p.name)})).filter(p=>!q||norm(p.name).includes(q))
   .sort((a,b)=>(a.id===TODOS?-1:b.id===TODOS?1:0)||rank[a.s]-rank[b.s]||(!a.t)-(!b.t)||a.t.localeCompare(b.t)||a.name.localeCompare(b.name,'pt-PT'));
  list.innerHTML=ps.length?ps.map(p=>'<button type="button" class="mcv-item" data-mcv="'+esc(p.id)+'">'+avatar(p)+'<span class="mcv-name">'+esc(p.name)+'</span>'+(p.t?'<span class="mcv-time">'+esc(p.t)+'</span>':'')+(p.count?'<span class="mcv-count">'+p.count+'</span>':'')+'<span class="mcv-dot '+p.s+'"></span></button>').join(''):'<div class="smalltext muted" style="padding:8px">Sem colaboradores.</div>';
 }
 let painting=false;
 function paint(){
  if(painting||!ensure())return;painting=true;try{
  $c('mcvDate').textContent=dd(new Date());
  const self=$c('mcvSelf'),ss=session?stateOf(String(session.id)):'off';self.className='mcv-dot '+ss;self.title=self.ariaLabel={on:'Online',away:'Ausente',off:'Offline'}[ss];
  const ps=people(),byId=Object.fromEntries(ps.map(p=>[p.id,p]));
  const active=ps.find(p=>p.active)?.id;
  let open=getOpen().filter(id=>byId[id]);if(active&&active!==TODOS&&!open.includes(active))open.push(active);setOpen(open);
  $c('mcvTabs').innerHTML=open.map(id=>{const p=byId[id];return '<span class="mcv-tab '+(p.active?'active':'')+'" data-mcv-tab="'+esc(id)+'" role="button" tabindex="0">'+avatar(p)+'<span class="mcv-tname" title="'+esc(p.name)+'">'+esc(p.name.split(/\s+/)[0])+'</span><span class="mcv-dot '+stateOf(id)+'"></span>'+(p.count?'<span class="mcv-count">'+p.count+'</span>':'')+'<button type="button" class="mcv-x" data-mcv-close="'+esc(id)+'" aria-label="Fechar conversa">✕</button></span>';}).join('');
  const admin=isAdmin(),setP=(el,k,v)=>{if(el&&el[k]!==v)el[k]=v;};setP($c('mcvEdit'),'hidden',!admin);setP($c('mcvDel'),'hidden',!admin);
  if(selected&&!document.querySelector('[data-msg-id="'+CSS.escape(selected)+'"]'))selected='';
  const dis=!selected||!admin;setP($c('mcvEdit'),'disabled',dis);setP($c('mcvDel'),'disabled',dis);
  document.querySelectorAll('.mac-chat-message.mcv-sel').forEach(m=>m.classList.remove('mcv-sel'));
  if(selected)document.querySelector('[data-msg-id="'+CSS.escape(selected)+'"]')?.classList.add('mcv-sel');
  setP($c('mcvMenu'),'hidden',!menuOpen);if(menuOpen)paintList();
  }finally{painting=false;}
 }
 async function loadPresence(){if(!session)return;try{presence=await macRPC('presence-list')||{};}catch{}paint();}
 let lastBeat=0;
 function beat(force){if(!session||document.hidden)return;const at=macLastActivity()||Date.now();if(Date.now()-at>=120000)return;if(!force&&Date.now()-lastBeat<20000)return;lastBeat=Date.now();presence[String(session.id)]=new Date(at).toISOString();void macRPC('human-presence',{at}).catch(()=>{});}
 ['pointerdown','keydown','touchstart','wheel'].forEach(t=>window.addEventListener(t,e=>{if(e.isTrusted)setTimeout(()=>beat(false),0);},{passive:true,capture:true}));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){beat(true);void loadPresence();}});
 setInterval(()=>{beat(false);void loadPresence();},30000);
 setInterval(paint,15000);
 function boot(){const parts=$c('macChatParticipants'),msgs=$c('macChatMessages');if(!parts||!msgs)return setTimeout(boot,500);
  new MutationObserver(()=>paint()).observe(parts,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  new MutationObserver(()=>paint()).observe(msgs,{childList:true});
  $c('macChatBubble')?.addEventListener('click',()=>{beat(true);void loadPresence();});paint();}
 window.mcvChoose=choose;
 boot();
 const lg=loginToStore;loginToStore=async function(){const r=await lg.apply(this,arguments);if(session){beat(true);void loadPresence();}return r;};
})();
// Chat Vision layout fix: single action bar, no permanent participants box, one open-conversations row, circular photos.
(function(){
 const st=document.createElement('style');
 st.textContent=`html body #macChatPanel #macChatParticipants.mac-chat-participants{display:none!important}
html body #macChatPanel .mac-chat-head .mac-chat-head-actions #macChatEditMode,html body #macChatPanel .mac-chat-head .mac-chat-head-actions #macChatDeleteConversation{display:none!important}
html body #macChatPanel .mac-chat-head .mac-chat-head-actions .btn[hidden]{display:none!important}
html body #macChatPanel .mac-chat-head{display:flex!important;flex-wrap:wrap!important;align-items:center!important;row-gap:4px!important}
html body #macChatPanel .mac-chat-head>div:not(#mcvHead):not(.mac-chat-head-actions):not(#mcvTabs){display:none!important}
html body #macChatPanel .mac-chat-head>#mcvHead{flex:1 1 100%!important;width:100%!important;order:0}
html body #macChatPanel .mac-chat-head>.mac-chat-head-actions{order:1;flex:1 1 100%!important;width:100%!important;min-width:0!important;justify-content:flex-start!important;margin-left:0!important;flex-wrap:nowrap!important}
html body #macChatPanel .mac-chat-head>.mac-chat-head-actions #macChatClose{margin-left:auto!important}
html body #macChatPanel .mac-chat-head>#mcvTabs{order:2;flex:1 1 100%!important;width:100%!important;margin:0!important;display:flex;gap:4px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch}
html body #macChatPanel #mcvTabs::-webkit-scrollbar{display:none}html body #macChatPanel #mcvTabs:empty{display:none!important}
html body #macChatPanel .mcv-tab{height:36px;padding:2px 6px 2px 2px}
html body #macChatPanel .mcv-tab .employee-avatar,html body #macChatPanel .mcv-item .employee-avatar{width:30px!important;height:30px!important;min-width:30px!important;max-width:30px!important;min-height:30px!important;max-height:30px!important;aspect-ratio:1/1!important;border-radius:50%!important;overflow:hidden!important;flex-shrink:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;font-size:11px!important}
html body #macChatPanel .mcv-tab .employee-avatar img,html body #macChatPanel .mcv-item .employee-avatar img,html body #macChatPanel .mcv-tab img.employee-avatar,html body #macChatPanel .mcv-item img.employee-avatar{width:100%!important;height:100%!important;object-fit:cover!important;object-position:center!important;border-radius:50%!important;display:block!important}`;
 document.head.appendChild(st);
 const move=()=>{const head=document.querySelector('#macChatPanel .mac-chat-head'),t=document.getElementById('mcvTabs');if(!head||!t)return setTimeout(move,500);if(t.parentElement!==head)head.appendChild(t);const m=document.getElementById('mcvMenu');if(m)m.style.top=(head.offsetTop+head.offsetHeight)+'px';};
 move();document.addEventListener('click',e=>{if(e.target.closest('#mcvPick,#macChatBubble'))setTimeout(move,0);},true);
})();
// Chat Vision header fix: title left + 👥 ✏️ 🗑️ ✖ right on one line, date below; edit/delete always visible (disabled without selection/permission); white "Todos" avatar.
(function(){
 const st=document.createElement('style');
 st.textContent=`html body #macChatPanel .mac-chat-head{align-items:flex-start!important;justify-content:space-between!important}
html body #macChatPanel .mac-chat-head>#mcvHead{flex:1 1 0!important;width:auto!important;min-width:0!important;order:0}
html body #macChatPanel .mac-chat-head>#mcvHead .mcv-title{min-height:32px;overflow:hidden}
html body #macChatPanel .mac-chat-head>.mac-chat-head-actions{order:1!important;flex:0 0 auto!important;width:auto!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:4px!important;margin-left:auto!important}
html body #macChatPanel .mac-chat-head>.mac-chat-head-actions #macChatClose{margin-left:0!important}
html body #macChatPanel .mac-chat-head>.mac-chat-head-actions #mcvEdit[hidden],html body #macChatPanel .mac-chat-head>.mac-chat-head-actions #mcvDel[hidden]{display:none!important}
html body #macChatPanel .mac-chat-head>.mac-chat-head-actions .btn:disabled{opacity:.4;cursor:not-allowed}
html body #macChatPanel .employee-avatar.mcv-todos{background:#FFFFFF!important;color:initial!important;font-size:16px!important;line-height:1!important}`;
 document.head.appendChild(st);
 const fix=()=>{const ed=document.getElementById('mcvEdit'),del=document.getElementById('mcvDel');
  if(ed&&del){const admin=window.macIsChatAdmin();if(!admin){if(!ed.disabled)ed.disabled=true;if(!del.disabled)del.disabled=true;}}
  document.querySelectorAll('#macChatPanel [data-mcv-tab="todos"] .employee-avatar,#macChatPanel [data-mcv="todos"] .employee-avatar').forEach(a=>{if(!a.classList.contains('mcv-todos'))a.classList.add('mcv-todos')});};
 const boot=()=>{const p=document.getElementById('macChatPanel');if(!p)return setTimeout(boot,500);new MutationObserver(fix).observe(p,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled']});fix();};
 boot();
})();
// Session survives refresh: Cloud Auth keeps the session; the host stores only {user, store, page, last human activity}.
(function(){
 let at=0,restoring=false,lastSent=0;
 const save=force=>{if(!session||!currentShopId)return;const now=Date.now();if(!force&&now-lastSent<5000)return;lastSent=now;void macRPC('session-meta-set',{userId:String(session.id),storeId:currentShopId,accessKind:session.accessKind||'',page:page||'dashboard',at:at||now}).catch(()=>{});};
 macLastActivity=()=>at;
 macTouch=function(force){if(restoring)return;at=Date.now();save(!!force);};
 rememberLocalSession=function(){save(true);};
 forgetLocalSession=function(){at=0;void macRPC('session-meta-clear').catch(()=>{});};
 restoreLocalSession=async function(){
  let meta=null;try{meta=await macRPC('session-meta-get');}catch{return false;}
  if(!meta)return false;
  if(!meta.at||Date.now()-meta.at>=MAC_IDLE_MS){forgetLocalSession();try{await macRPC('logout');}catch{}return false;}
  const shop=shopRegistry.find(s=>s.id===meta.storeId),user=shop?.users?.find(u=>u.id===meta.userId);
  if(!shop||!user)return false;
  const access=Object.fromEntries(shopRegistry.filter(s=>s.users.some(u=>u.id===user.id)).map(s=>[s.id,user.id]));
  restoring=true;at=meta.at;
  try{await loginToStore(shop,user,access,meta.accessKind);}finally{restoring=false;}
  if(!session)return false;at=meta.at;save(true);
  if(meta.page&&meta.page!=='dashboard')go(meta.page);
  return true;
 };
 window.addEventListener('message',e=>{
  if(e.source!==parent||e.origin!==location.origin||e.data?.macVisionBridge!==1||e.data.kind!=='event')return;
  if(e.data.event==='session-ended'&&session)void macIdleLogout(false);
  if(e.data.event==='activity'&&Number(e.data.at)>at)at=Number(e.data.at);
  if(e.data.event==='message-new')macAutoOpen(e.data.message||{});
 });
 // Auto-open Chat Vision on a newly received private message (never for loaded history).
 const seen=new Set();let lastSwitch=0;
 function macAutoOpen(m){
  if(!session||!m.id||seen.has(m.id))return;seen.add(m.id);
  if(String(m.recipient_id||'')!==String(session.id)||String(m.sender_id)===String(session.id))return;
  const panel=document.getElementById('macChatPanel'),text=document.getElementById('macChatText');
  if(panel?.hidden)document.getElementById('macChatBubble')?.click();
  const typing=text&&document.activeElement===text&&text.value.trim();
  const active=document.querySelector('#macChatParticipants [data-cloud-person].active')?.dataset.cloudPerson;
  if(typing||active===String(m.sender_id))return;
  if(active&&active!=='todos'&&Date.now()-lastSwitch<15000)return; // keep current conversation; tab counters show the rest
  const pick=()=>{if(document.querySelector('#macChatParticipants [data-cloud-person="'+CSS.escape(String(m.sender_id))+'"]')){lastSwitch=Date.now();window.mcvChoose?.(String(m.sender_id));return true;}return false;};
  if(!pick()){let n=0;const t=setInterval(()=>{if(pick()||++n>20)clearInterval(t);},250);}
 }
 const st=document.createElement('style');
 st.textContent=`html body #macChatPanel .mcv-tab{display:inline-flex!important;align-items:center!important;gap:6px!important;height:36px!important;box-sizing:border-box!important;line-height:1!important}
html body #macChatPanel .mcv-tab .mcv-tname{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html body #macChatPanel .mcv-tab .mcv-dot,html body #macChatPanel .mcv-item .mcv-dot{flex:0 0 9px;align-self:center}
html body #macChatPanel .mcv-tab .mcv-x{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;flex:0 0 18px}
html body #macChatPanel .mcv-item{align-items:center!important}html body #macChatPanel .mcv-name{white-space:nowrap}`;
 document.head.appendChild(st);
})();
