/* Integration only. The standalone document retains its original UI. */
let macRpcId=0;
const macRpcPending=new Map();
function macRPC(action,payload={}){
 return new Promise((resolve,reject)=>{
  const id='mac-'+(++macRpcId);const timer=setTimeout(()=>{macRpcPending.delete(id);const error=Error('A ligação Cloud não respondeu.');macSyncFailure(action,'network');reject(error);},30000);
  macSyncBegin(action);
  macRpcPending.set(id,{resolve,reject,timer});parent.postMessage({macVisionBridge:1,kind:'request',id,action,payload},location.origin);
 });
}
// Comparação estável do estado: a ordem das chaves não pode provocar reescritas nem re-renderizações.
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())o[k]=canonical(v[k]);return o;}return v;}
function sameState(a,b){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));}
window.addEventListener('message',event=>{
 if(event.source!==parent||event.origin!==location.origin||event.data?.macVisionBridge!==1)return;
 const data=event.data;
 if(data.kind==='response'){const job=macRpcPending.get(data.id);if(!job)return;clearTimeout(job.timer);macRpcPending.delete(data.id);if(data.error){macSyncFailure(data.action||'',data.errorKind||'operation');job.reject(Object.assign(Error(data.error),{kind:data.errorKind}));}else{macSyncComplete(data.action||'');job.resolve(data.result);}}
 if(data.kind==='event'&&data.event==='sync-channel'){macSyncState.reconnecting=!data.live;macPaintHealth();return;}
 if(data.kind==='event'&&session){void (async()=>{
  if(data.event==='preferences-changed'){const prefs=await macRPC('preferences');macVolatilePrefs.clear();for(const [k,v] of Object.entries(prefs||{}))macVolatilePrefs.set(k,v);return;}
  if(data.event==='photos-changed'){macApplyPhotos(data.photos||{});return;}
  if(data.event==='registry-changed'){return;} // Refresh on explicit load/save; never replace an in-progress account edit.
  if(String(data.key||'').startsWith('commission:')){if(window.macCommissionRefresh)await window.macCommissionRefresh(true);return;}
  if(data.key&&String(data.key)!=='store:'+currentShopId)return;
  if(macStateDirty||saveTimer!==null){window.macPullAfterSave=true;return;}
  const shopId=currentShopId;const raw=await macRPC('read',{key:'store:'+shopId,accept:true});
  let next;try{next=window.macCommissionHydrate?await window.macCommissionHydrate(shopId,raw):raw;}catch(e){return;}
  if(!session||currentShopId!==shopId||macStateDirty||saveTimer!==null)return;
  if(next&&!sameState(next,state)){const d=state.selectedDate;state=shape(next);state.selectedDate=d;render();}
 })().catch(console.warn);}
});
// Fotografias únicas por ID Cloud: aplicadas ao registo, aos colaboradores ligados e ao Chat Vision sem recarregar.
function macApplyPhotos(map){
 const nm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 for(const list of [macCloudDirectory?.stores,typeof shopRegistry!=='undefined'?shopRegistry:null])for(const s of list||[])for(const u of s.users||[])if(u?.id&&map[u.id])u.photo=map[u.id];
 try{const store=(macCloudDirectory?.stores||[]).find(s=>s.id===currentShopId);
  for(const e of state?.employees||[]){const ids=[...new Set((store?.users||[]).filter(u=>nm(u.employee)===nm(e.name)||nm(u.name)===nm(e.name)).map(u=>u.id))];if(ids.length===1&&map[ids[0]])e.photo=map[ids[0]];}
 }catch(_){}
 try{if(typeof render==='function')render();}catch(_){}
 try{if(typeof renderSessionPhoto==='function')renderSessionPhoto();}catch(_){}
 try{window.dispatchEvent(new Event('mac-photos-updated'));}catch(_){}
}
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
 try{document.getElementById('macNoPermissionPopup')?.setAttribute('hidden','');await macRPC('login',{id:user.id,password:document.getElementById('loginPassword').value,storeId:shop.id,accessKind:document.getElementById('loginRole').value});window.macShiftCache={userId:user.id,storeId:shop.id,at:Date.now(),result:{allowed:true}};macCloudDirectory=await macRPC('directory');shopRegistry=macCloudDirectory.stores;const privateShop=shopRegistry.find(s=>s.id===shop.id),privateUser=privateShop?.users.find(u=>u.id===user.id);if(!privateShop||!privateUser)throw Error('Acesso à loja não autorizado.');const access=Object.fromEntries(shopRegistry.filter(s=>s.users.some(u=>u.id===user.id)).map(s=>[s.id,user.id]));await loginToStore(privateShop,privateUser,access,document.getElementById('loginRole').value);authError('');}catch(error){const m=String(error?.message||'');if(m.startsWith('MAC_SHIFT:')){authError('');document.getElementById('loginPassword').value='';macShowShiftPopup(m.slice(10));}else authError(m);}
};
const macOriginalLogout=logout;
logout=async function(){const result=await macOriginalLogout.apply(this,arguments);if(!session){window.macShiftCache=null;try{await macRPC('logout');}catch(_){}await macReloadLoginDirectory();}return result;};
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
setLocalStatus=function(ok){localStatus=ok?'ok':'nok';if(ok&&!macStateDirty)macSyncState.writeError='';macPaintHealth();};
const macOriginalMarkUnsaved=macMarkUnsaved;
macMarkUnsaved=function(){macOriginalMarkUnsaved();macSyncState.writeError='';macPaintHealth();};
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

// One state owner: dirty data, failed operations and Realtime gaps never mean Offline.
const macSyncState={connected:null,pending:0,writeError:'',sessionExpired:false,reconnecting:false,lastSync:0,failures:0};
const macMutationActions=new Set(['write','delete','registry-save','preference','commission-save','import-file-save','permissions-save','account','password','remove-access']);
let macHealthBusy=false,macHealthDelay=30000,macHealthTimer=null;
function macSyncBegin(action){if(macMutationActions.has(action)){macSyncState.pending++;macSyncState.writeError='';macPaintHealth();}}
function macSyncComplete(action){
 if(action==='ping')return;
 macSyncState.connected=true;macSyncState.failures=0;
 if(action==='login'||action==='bootstrap')macSyncState.sessionExpired=false;
 if(macMutationActions.has(action)){macSyncState.pending=Math.max(0,macSyncState.pending-1);macSyncState.lastSync=Date.now();}
 macPaintHealth();
}
function macSyncFailure(action,kind){
 if(macMutationActions.has(action)){macSyncState.pending=Math.max(0,macSyncState.pending-1);macSyncState.writeError=kind;}
 if(kind==='session'&&action!=='login')macSyncState.sessionExpired=true;
 if(kind==='permission'||kind==='limit'||kind==='session')macSyncState.connected=true;
 if(kind==='network'||kind==='service')void macCloudHealth();
 macPaintHealth();
}
function macPaintHealth(){
 const led=document.getElementById('localSyncIndicator'),label=document.getElementById('localSyncLabel');if(!led||!label)return;
 const s=macSyncState;let text='Online',tone='ok';
 if(s.connected===false){text='OFFLINE — Dados em cache — sem ligação à Cloud'+(s.lastSync?' · Última sincronização: '+new Date(s.lastSync).toLocaleString('pt-PT'):'');tone='bad';}
 else if(s.sessionExpired){text='SESSÃO EXPIRADA — Inicia sessão novamente';tone='pending';}
 else if(s.writeError){text='ERRO DE GRAVAÇÃO — '+(s.writeError==='permission'?'Sem permissão':s.writeError==='limit'?'Aguarda antes de tentar novamente':'Alterações não confirmadas');tone='pending';}
 else if(s.pending||macStateDirty||saveTimer!==null){text='A sincronizar';tone='pending';}
 else if(s.reconnecting){text='A reconectar sincronização';tone='pending';}
 else if(s.connected===null){text='A verificar ligação à Cloud';tone='pending';}
 else if(s.lastSync){text='Sincronizado';}
 led.classList.toggle('bad',tone==='bad');led.classList.toggle('ok',tone==='ok');led.dataset.cloudTone=tone;led.title=text;label.textContent=text;led.setAttribute('aria-label',text);
}
async function macCloudHealth(){
 if(macHealthBusy)return;macHealthBusy=true;clearTimeout(macHealthTimer);
 try{const wasOffline=macSyncState.connected===false;const health=await macRPC('ping');macSyncState.connected=true;macSyncState.failures=0;macSyncState.sessionExpired=!!health?.sessionExpired;macHealthDelay=30000;if(wasOffline&&session){await macRPC('sync-recover');window.macPullAfterSave=true;window.dispatchEvent(new Event('mac-cloud-recovered'));}}
 catch{macSyncState.failures++;if(macSyncState.failures>=2)macSyncState.connected=false;macHealthDelay=Math.min(5000*Math.pow(2,macSyncState.failures-1),60000);}
 finally{macHealthBusy=false;macPaintHealth();macHealthTimer=setTimeout(macCloudHealth,macHealthDelay);}
}
// The original local probe wrote status documents, compared stamps and rendered data.
// It is not a connectivity test and could fail on permission/conflict/render errors.
updateLocalHealth=async function(){updateLocalClock();await macCloudHealth();};
window.addEventListener('online',()=>void macCloudHealth());
window.addEventListener('offline',()=>void macCloudHealth());
setTimeout(macCloudHealth,1500);
(function(){const st=document.createElement('style');st.textContent=`:root{--mac-sync-online:#25c87d;--mac-sync-wait:#e0a94c;--mac-sync-offline:#eb5971}html body #mainApp .sidebar #localSyncIndicator[data-cloud-tone]{background:var(--mac-sync-wait)!important;box-shadow:none!important}html body #mainApp .sidebar #localSyncIndicator[data-cloud-tone="ok"]{background:var(--mac-sync-online)!important}html body #mainApp .sidebar #localSyncIndicator[data-cloud-tone="bad"]{background:var(--mac-sync-offline)!important}`;document.head.appendChild(st);})();

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
 window.addEventListener('mac-photos-updated',()=>{try{paintList();paint();}catch(_){}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){beat(true);void loadPresence();}});
 setInterval(()=>{beat(false);void loadPresence();},30000);
 setInterval(paint,15000);
 function boot(){const parts=$c('macChatParticipants'),msgs=$c('macChatMessages');if(!parts||!msgs)return setTimeout(boot,500);
  new MutationObserver(()=>paint()).observe(parts,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  new MutationObserver(()=>paint()).observe(msgs,{childList:true});
  $c('macChatBubble')?.addEventListener('click',()=>{beat(true);void loadPresence();});paint();}
 // Mensagens: fotografia Cloud em vez da inicial, sempre que existe.
 function paintMessagePhotos(){
  document.querySelectorAll('#macChatMessages .mac-chat-message[data-sender-id]').forEach(m=>{
   const span=m.querySelector('.mac-chat-message-avatar-fallback');if(!span)return;
   const name=m.querySelector('.mac-chat-message-head strong')?.textContent||'';
   const photo=photoOf(m.dataset.senderId,name);if(!photo)return;
   const img=document.createElement('img');img.className='mac-chat-message-avatar';img.alt='';img.src=photo;
   span.replaceWith(img);
  });
 }
 // renderChatCloud não é global: observar as mensagens e trocar a inicial pela fotografia.
 let paintingMsgs=false;
 const paintMsgs=()=>{if(paintingMsgs)return;paintingMsgs=true;try{paintMessagePhotos();}catch(_){ }finally{paintingMsgs=false;}};
 new MutationObserver(paintMsgs).observe(document.documentElement,{subtree:true,childList:true});
 window.addEventListener('mac-photos-updated',paintMsgs);
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
// Notificações verde/vermelha: centradas no topo da página.
(function(){
 const st=document.createElement('style');
 st.id='macv-toast-top-center-20261112';
 st.textContent=`html body .toast[popover],html body .toast[popover].show:popover-open,html body .toast[popover].bad:popover-open{
 position:fixed!important;inset:auto!important;
 top:calc(env(safe-area-inset-top,0px) + 16px)!important;
 left:50%!important;right:auto!important;bottom:auto!important;
 transform:translateX(-50%)!important;
 width:max-content!important;max-width:min(480px,calc(100vw - 32px))!important;
 text-align:center!important;
 z-index:2147483647!important}`;
 document.head.appendChild(st);
})();
/* MAC Vision: vendas e senhas atualizadas automaticamente a partir da Cloud.
   Complementa o aviso em tempo real: relê a loja a cada 15s, ao voltar à página
   e depois de uma gravação, sem nunca substituir alterações ainda por guardar. */
(function(){
 let busy=false;
 async function macPullStore(){
  if(busy||!session||!currentShopId||macStateDirty||saveTimer!==null||document.hidden)return;
  busy=true;const shopId=currentShopId;
  try{
   const raw=await macRPC('read',{key:'store:'+shopId,accept:true});
   let next;try{next=window.macCommissionHydrate?await window.macCommissionHydrate(shopId,raw):raw;}catch(e){return;}
   if(!next||!session||currentShopId!==shopId||macStateDirty||saveTimer!==null)return;
   if(!sameState(next,state)){const d=state.selectedDate;state=shape(next);if(d)state.selectedDate=d;render();}
  }catch(e){console.warn('Atualização Cloud da loja não concluída',e);}finally{busy=false;}
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)macPullStore();});
 window.addEventListener('focus',macPullStore);
 window.addEventListener('mac-cloud-recovered',()=>{if(macStateDirty||saveTimer!==null){window.macPullAfterSave=true;return;}window.macPullAfterSave=false;void macPullStore();if(window.macCommissionRefresh)void window.macCommissionRefresh(true).catch(console.warn);});
 const p=persist;persist=async function(){const ok=await p.apply(this,arguments);if(ok&&window.macPullAfterSave){window.macPullAfterSave=false;setTimeout(macPullStore,0);}return ok;};
})();
/* Venda: a notificação de sucesso só aparece depois de a Cloud confirmar a gravação. */
(function(){
 const t=toast;
 toast=function(message,bad){
  if(bad||!/^Venda (registada|atualizada)/.test(String(message||'')))return t.apply(this,arguments);
  (async()=>{
   for(let i=0;i<100&&saveTimer!==null;i++)await new Promise(r=>setTimeout(r,50));
   const ok=await macSaveQueue.catch(()=>false);
   if(ok!==false&&!macStateDirty)t(String(message).replace(/^Venda (registada|atualizada)/,m=>m+' na Cloud'));
  })();
 };
})();
// Resumo de vendas: espaço entre a fotografia e o nome do colaborador.
(()=>{const st=document.createElement('style');st.textContent=`html body #page-sales #recentSales .sale-latest-row>div>strong:first-child{display:inline-flex!important;align-items:center!important;gap:12px!important}html body #page-sales #recentSales .sale-latest-row>div>strong:first-child .employee-avatar{flex-shrink:0!important;margin:0!important}`;document.head.appendChild(st);})();
// ============ Ponderação e Comissionamento: um único ficheiro partilhado por várias lojas ============
// A Cloud é a fonte oficial do ficheiro; a cópia local (memória + IndexedDB) só evita reprocessar a mesma versão.
(() => {
 const $e = id => document.getElementById(id);
 const DB_NAME = 'mac-vision-commission', DB_STORE = 'catalogs';
 const OWNED = /^(importedCatalog|macCommission\w*)$/;
 const memory = new Map();
 let filesCache = null, dbPromise = null, loaded = null, lastRefresh = 0;

 const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
 const who = () => session?.employee || session?.name || '';
 const plain = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
 const walletOf = () => macCloudDirectory?.stores?.find(s => s.id === currentShopId)?.wallet_id || macCloudDirectory?.wallets?.[0]?.id || '';
 const newId = () => (crypto.randomUUID ? crypto.randomUUID() : 'f-' + Date.now() + '-' + Math.random().toString(36).slice(2));

 // Regras puras do módulo, expostas para verificação automática.
 const rules = {
  cacheKey: (wallet, file, version) => `${wallet}|${file}|${version}`,
  fileForStore(files, storeId) {
   return (files || []).filter(f => (f.storeIds || []).includes(storeId))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || null;
  },
  otherFile(files, file, storeId) {
   return (files || []).find(f => f.id !== (file && file.id) && (f.storeIds || []).includes(storeId)) || null;
  },
  needsConfirmation(files, file, selected) {
   const out = [];
   for (const id of selected || []) { const other = rules.otherFile(files, file, id); if (other && !out.some(x => x.id === other.id)) out.push(other); }
   return out;
  },
  canManage: role => role === 'gestor',
  checksum(text) { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); }
 };
 window.macCommissionRules = rules;

 // Soma de controlo estável: a Cloud reordena as chaves dos objetos, por isso compara-se uma forma canónica.
 function canonical(v) { if (Array.isArray(v)) return v.map(canonical); if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v).sort()) o[k] = canonical(v[k]); return o; } return v; }
 const digest = obj => rules.checksum(JSON.stringify(canonical(obj)));

 // ---------- cópia local: memória + IndexedDB, identificada por carteira, ficheiro e versão ----------
 function db() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
   let req;
   try { req = indexedDB.open(DB_NAME, 1); } catch (e) { return reject(e); }
   req.onupgradeneeded = () => { try { if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE); } catch (e) {} };
   req.onsuccess = () => resolve(req.result);
   req.onerror = () => reject(req.error || Error('IndexedDB indisponível'));
  });
  return dbPromise;
 }
 async function cacheGet(key) {
  if (memory.has(key)) return memory.get(key);
  try {
   const d = await db();
   return await new Promise((res, rej) => { const rq = d.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => rej(rq.error); });
  } catch { return null; }
 }
 async function cacheSet(key, value) {
  memory.set(key, value);
  try {
   const d = await db();
   await new Promise((res, rej) => { const t = d.transaction(DB_STORE, 'readwrite'); t.objectStore(DB_STORE).put(value, key); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
  } catch {}
 }
 async function cachePrune(keep) {
  const parts = String(keep).split('|');
  for (const k of [...memory.keys()]) if (k !== keep && k.startsWith(parts[0] + '|' + parts[1] + '|')) memory.delete(k);
  try {
   const d = await db();
   await new Promise((res, rej) => {
    const t = d.transaction(DB_STORE, 'readwrite'), os = t.objectStore(DB_STORE), rq = os.openCursor();
    rq.onsuccess = () => { const c = rq.result; if (!c) return res(); const p = String(c.key).split('|'); if (c.key !== keep && p[0] === parts[0] && p[1] === parts[1]) os.delete(c.key); c.continue(); };
    t.onerror = () => rej(t.error);
   });
  } catch {}
 }
 async function cacheClear() {
  memory.clear();
  try {
   const d = await db();
   await new Promise((res, rej) => { const t = d.transaction(DB_STORE, 'readwrite'); t.objectStore(DB_STORE).clear(); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
  } catch {}
 }

 // ---------- metadados leves (nome, versão, lojas associadas) ----------
 async function loadFiles(force) {
  if (!session) return filesCache || { files: [], revision: 0 };
  if (!force && filesCache) return filesCache;
  try {
   const r = await macRPC('commission-files');
   filesCache = { files: (r && r.files) || [], revision: (r && r.revision) || 0 };
  } catch (e) { if (!filesCache) throw e; }
  return filesCache;
 }

 // ---------- catálogo: só se descarrega quando a versão local não coincide ----------
 async function loadPayload(file) {
  const key = rules.cacheKey(walletOf(), file.id, file.version);
  const hit = await cacheGet(key);
  if (hit && hit.catalog) return hit;
  const raw = await macRPC('commission-read', { fileId: file.id });
  if (!raw) throw Error('O ficheiro de comissionamento não está disponível na Cloud.');
  const catalog = raw.catalog || { products: [], mobiles: [] };
  if (file.checksum && digest(catalog) !== String(file.checksum)) throw Error('O ficheiro não passou na verificação de integridade.');
  const payload = { id: file.id, version: Number(file.version) || 0, catalog, source: raw.source || null, previous: raw.previous && raw.previous.catalog ? raw.previous : null, at: Date.now() };
  await cacheSet(key, payload);
  await cachePrune(key);
  return payload;
 }
 async function resolve(storeId, force) {
  if (!session || !storeId) return null;
  const file = rules.fileForStore((await loadFiles(force)).files, storeId);
  if (!file) return null;
  try { return { file, payload: await loadPayload(file) }; }
  catch (e) {
   const cached = await cacheGet(rules.cacheKey(walletOf(), file.id, file.version));
   if (cached && cached.catalog) return { file, payload: cached };
   throw e;
  }
 }
 function applyFields(w, file, catalog) {
  const out = { ...w };
  out.importedCatalog = catalog;
  out.macCommissionFileId = file.id;
  out.macCommissionSourceName = file.name || '';
  out.macCommissionVersion = Number(file.version) || 0;
  out.macCommissionUpdatedAt = file.updatedAt || '';
  out.macCommissionUpdatedBy = file.updatedBy || '';
  out.macCommissionStoreIds = (file.storeIds || []).slice();
  out.macCommissionSharedWith = (file.sharedWith || []).slice();
  out.macCommissionChecksum = file.checksum || '';
  return out;
 }
 // Leitura de uma loja: a cópia partilhada é aplicada em memória, nunca volta a ser gravada na loja.
 // Uma loja associada a um ficheiro que não se consegue ler nunca devolve o registo sem catálogo,
 // porque isso apagaria o catálogo da sessão em curso.
 async function hydrate(storeId, value) {
  if (value !== null && value !== undefined && typeof value !== 'object') return value;
  try { await loadFiles(); } catch (e) {}
  if (!covered(storeId)) return value;
  let r = null;
  try { r = await resolve(storeId); }
  catch (e) { throw Error('Não foi possível ler o ficheiro de comissionamento desta loja: ' + (e && e.message || e)); }
  if (!r) throw Error('Esta loja está associada a um ficheiro de comissionamento que já não está disponível na Cloud.');
  let base = value;
  if (!base || typeof base !== 'object') {
   // Loja ainda sem registo na Cloud: parte da base vazia original para que a cópia continue válida.
   const shop = (typeof shopRegistry !== 'undefined' && Array.isArray(shopRegistry) ? shopRegistry : []).find(s => String(s.id) === String(storeId));
   if (typeof blankStoreData !== 'function' || !shop) return value;
   base = blankStoreData(shop);
  }
  const copy = { ...base };
  copy.weights = applyFields({ ...(base.weights || {}) }, r.file, r.payload.catalog);
  if (String(storeId) === String(currentShopId)) loaded = r.payload;
  return copy;
 }
 async function applyToStore(storeId, force) {
  const r = await resolve(storeId, force);
  if (!r) return null;
  state.weights = applyFields({ ...(state.weights || {}) }, r.file, r.payload.catalog);
  loaded = r.payload;
  return r;
 }
 function covered(storeId) { return !!filesCache && !!rules.fileForStore(filesCache.files, storeId); }
 function strip(storeId, value) {
  if (!value || typeof value !== 'object' || !covered(storeId)) return value;
  const w = value.weights;
  if (!w || typeof w !== 'object') return value;
  const rest = {};
  for (const k of Object.keys(w)) if (!OWNED.test(k)) rest[k] = w[k];
  return { ...value, weights: rest };
 }
 const originalReadKey = readKey, originalWriteKey = writeKey;
 readKey = async function (key) {
  const value = await originalReadKey.apply(this, arguments);
  if (String(key).startsWith('store:')) return hydrate(key.slice(6), value);
  return value;
 };
 writeKey = async function (key, value) {
  if (String(key).startsWith('store:')) value = strip(key.slice(6), value);
  return originalWriteKey.apply(this, [key, value]);
 };

 function currentFile() {
  const id = state?.weights?.macCommissionFileId;
  if (!id) return null;
  return (filesCache && filesCache.files || []).find(f => f.id === id) || null;
 }
 window.macCommissionCurrent = currentFile;

 // ---------- gravação: Cloud primeiro, cache só depois da confirmação ----------
 async function fileToSource(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { name: file.name || 'comissionamento', type: file.type || '', data: btoa(text) };
 }
 async function saveFile(next, storeIds, sharedWith, sourceOverride) {
  const wallet = walletOf();
  const { files, revision } = await loadFiles(true);
  const current = currentFile() || rules.fileForStore(files, currentShopId);
  const catalogChanged = !current || !loaded || JSON.stringify(next) !== JSON.stringify(loaded.catalog);
  const version = current ? (catalogChanged ? (Number(current.version) || 0) + 1 : (Number(current.version) || 1)) : 1;
  const id = (current && current.id) || newId();
  const meta = {
   id, name: (current && current.name) || state?.weights?.macCommissionSourceName || 'comissionamento',
   version, updatedAt: new Date().toISOString(), updatedBy: who(),
   storeIds: (storeIds || []).slice(), sharedWith: (sharedWith || []).slice(),
   checksum: digest(next)
  };
  let source = sourceOverride === undefined ? ((loaded && loaded.source) || null) : sourceOverride;
  // Loja que ainda só tinha catálogo próprio: o original guardado até agora é aproveitado, não duplicado.
  if (!source && !current && state?.weights?.macCommissionSourceKey) {
   try {
    const item = await macRPC('read', { key: 'attachment:' + state.weights.macCommissionSourceKey });
    if (item && item.data) source = { name: item.name || 'comissionamento', type: item.type || '', data: item.data };
   } catch {}
  }
  await macRPC('commission-save', { meta, data: { catalog: next, source }, revision });
  const previous = loaded ? { catalog: loaded.catalog, source: loaded.source || null } : null;
  filesCache = { files: files.filter(f => f.id !== id).concat([meta]), revision: revision + 1 };
  const payload = { id, version: meta.version, catalog: next, source, previous, at: Date.now() };
  await cacheSet(rules.cacheKey(wallet, id, meta.version), payload);
  await cachePrune(rules.cacheKey(wallet, id, meta.version));
  loaded = payload;
  state.weights = applyFields({ ...(state.weights || {}) }, meta, next);
  macMarkUnsaved();
  if (!await persist()) toast('O ficheiro está guardado na Cloud, mas esta loja não foi atualizada. Reabre a loja.', true);
  document.dispatchEvent(new Event('mac-catalog-updated'));
  try { macCommissionShowStatus(); } catch (e) {}
  if (typeof renderConfig === 'function') renderConfig();
  macCommissionShowStatus();
  return meta;
 }
 async function importFile(file) {
  if (!session || !currentShopId) throw Error('Seleciona uma loja antes de importar.');
  if (!rules.canManage(session?.role)) throw Error('Apenas o gestor pode importar ponderações.');
  if (typeof window.macVisionParseWeights !== 'function') throw Error('Leitor de ficheiros não encontrado.');
  const parsed = await window.macVisionParseWeights(file);
  const catalog = { products: (parsed && parsed.products) || [], mobiles: (parsed && parsed.mobiles) || [] };
  if (!catalog.products.length) throw Error('O ficheiro não contém produtos válidos.');
  const wallet = walletOf();
  const { files, revision } = await loadFiles(true);
  const current = rules.fileForStore(files, currentShopId);
  const id = (current && current.id) || newId();
  const meta = {
   id, name: file.name || 'comissionamento', version: (Number(current && current.version) || 0) + 1,
   updatedAt: new Date().toISOString(), updatedBy: who(),
   storeIds: current && current.storeIds && current.storeIds.length ? current.storeIds.slice() : [currentShopId],
   sharedWith: (current && current.sharedWith || []).slice(),
   checksum: digest(catalog)
  };
  const source = await fileToSource(file);
  await macRPC('commission-save', { meta, data: { catalog, source }, revision });
  filesCache = { files: files.filter(f => f.id !== id).concat([meta]), revision: revision + 1 };
  const payload = { id, version: meta.version, catalog, source, previous: loaded && loaded.catalog ? { catalog: loaded.catalog, source: loaded.source || null } : null, at: Date.now() };
  await cacheSet(rules.cacheKey(wallet, id, meta.version), payload);
  await cachePrune(rules.cacheKey(wallet, id, meta.version));
  loaded = payload;
  state.weights = applyFields({ ...(state.weights || {}) }, meta, catalog);
  state.weights.excelCatalogValues = { products: {}, mobiles: {} };
  macMarkUnsaved();
  if (!await persist()) toast('O ficheiro está guardado na Cloud, mas esta loja não foi atualizada. Reabre a loja.', true);
  document.dispatchEvent(new Event('mac-catalog-updated'));
  try { macCommissionShowStatus(); } catch (e) {}
  if (typeof renderConfig === 'function') renderConfig();
  macCommissionShowStatus();
  toast('Ficheiro «' + meta.name + '» guardado na Cloud (v' + meta.version + ') · ' + meta.storeIds.length + (meta.storeIds.length === 1 ? ' loja' : ' lojas') + ' associada(s).');
 }
 async function restorePrevious(storeIds, sharedWith) {
  const prev = loaded && loaded.previous && loaded.previous.catalog;
  if (!prev || !prev.products || !prev.products.length) throw Error('Não existe uma versão anterior registada deste ficheiro.');
  return saveFile(structuredClone(prev), storeIds, sharedWith, (loaded.previous && loaded.previous.source) || null);
 }
 // Retirar uma loja não elimina o ficheiro nem os dados comerciais dessa loja.
 async function removeStore() {
  const file = currentFile();
  if (!file) return;
  const catalog = structuredClone(state?.weights?.importedCatalog || { products: [], mobiles: [] });
  const meta = { ...file, storeIds: (file.storeIds || []).filter(id => id !== currentShopId), version: Number(file.version) || 1, updatedAt: new Date().toISOString(), updatedBy: who(), checksum: rules.checksum(JSON.stringify(catalog)) };
  await macRPC('commission-save', { meta, data: { catalog, source: null }, revision: (filesCache && filesCache.revision) || 0 });
  filesCache = { files: (filesCache.files || []).filter(f => f.id !== file.id).concat([meta]), revision: (filesCache.revision || 0) + 1 };
  const w = { ...(state.weights || {}) };
  for (const k of Object.keys(w)) if (OWNED.test(k)) delete w[k];
  state.weights = w;
  loaded = null;
  macMarkUnsaved();
  if (!await persist()) toast('A associação foi retirada na Cloud, mas esta loja não foi atualizada.', true);
  document.dispatchEvent(new Event('mac-catalog-updated'));
  try { macCommissionShowStatus(); } catch (e) {}
  if (typeof renderConfig === 'function') renderConfig();
  macCommissionShowStatus();
  toast('O ficheiro deixou de estar associado a esta loja. O ficheiro e os dados comerciais foram preservados.');
 }

 // ---------- estado mostrado no menu ----------
 // O script original declara macCommissionShowStatus mais abaixo na página e essa declaração
 // volta a escrever a função, por isso a substituição só é instalada quando o documento termina.
 function paintSharedStatus() {
  const el = $e('macSharedCommissionStatus');
  if (!el) return;
  const file = currentFile();
  if (!file) { if (window.macCommissionOriginalStatus) return window.macCommissionOriginalStatus(); return; }
  const w = state?.weights || {};
  const products = Array.isArray(w.importedCatalog?.products) ? w.importedCatalog.products.length : 0;
  const mobiles = Array.isArray(w.importedCatalog?.mobiles) ? w.importedCatalog.mobiles.length : 0;
  const stores = (w.macCommissionStoreIds || []).length;
  el.innerHTML = '<strong class="mac-shared-ok">● Ficheiro partilhado</strong> · ' + [
   esc(w.macCommissionSourceName || 'Comissionamento'), 'v' + (Number(w.macCommissionVersion) || 0),
   products + ' produtos', mobiles + ' tarifários',
   stores + (stores === 1 ? ' loja' : ' lojas'), 'atualizado por ' + esc(w.macCommissionUpdatedBy || '—')
  ].join(' · ');
 }
 function installSharedStatus() {
  if (window.macCommissionOriginalStatus || typeof macCommissionShowStatus !== 'function') return;
  window.macCommissionOriginalStatus = macCommissionShowStatus;
  macCommissionShowStatus = paintSharedStatus;
  try { paintSharedStatus(); } catch (e) {}
 }
 document.addEventListener('DOMContentLoaded', installSharedStatus, { once: true });
 if (document.readyState !== 'loading') installSharedStatus();

 // ---------- atualização imediata quando outra sessão grava uma nova versão ----------
 async function refresh(force) {
  if (!session || !currentShopId) return;
  if (!force && Date.now() - lastRefresh < 20000) return;
  lastRefresh = Date.now();
  const before = String(state?.weights?.macCommissionFileId || '') + '|' + String(state?.weights?.macCommissionVersion ?? '');
  try { await applyToStore(currentShopId, true); } catch { return; }
  const after = String(state?.weights?.macCommissionFileId || '') + '|' + String(state?.weights?.macCommissionVersion ?? '');
  if (before === after) return;
  if (typeof renderConfig === 'function') renderConfig();
  macCommissionShowStatus();
  toast('Ficheiro de comissionamento atualizado para a versão ' + (state?.weights?.macCommissionVersion || 0) + '.');
 }
 window.macCommissionRefresh = refresh;
 window.macCommissionHydrate = hydrate;
 window.macCommissionCacheClear = cacheClear;
 document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(true).catch(() => {}); });
 window.addEventListener('focus', () => void refresh(false).catch(() => {}));

 // ---------- importação: um ficheiro, uma versão na Cloud, todas as lojas associadas ----------
 document.addEventListener('change', ev => {
  if (ev.target?.id !== 'weightsWorkbookFile') return;
  const file = ev.target.files?.[0];
  ev.target.value = '';
  if (!file) return;
  ev.preventDefault();
  ev.stopImmediatePropagation();
  ev.stopPropagation();
  void importFile(file).catch(e => toast('Não foi possível importar: ' + (e && e.message || e), true));
 }, true);
 document.addEventListener('click', ev => {
  const btn = ev.target?.closest?.('#weightsDeleteBtn');
  if (!btn || !currentShopId || !currentFile()) return;
  ev.preventDefault();
  ev.stopImmediatePropagation();
  ev.stopPropagation();
  const file = currentFile();
  if (!confirm('Retirar «' + (file.name || 'o ficheiro') + '» da loja ' + (currentStore()?.name || 'selecionada') + '? O ficheiro e os dados comerciais desta loja ficam preservados.')) return;
  void removeStore().catch(e => toast(e && e.message || String(e), true));
 }, true);

 // ---------- popup ✏️ Ficheiro de comissionamento ----------
 const cols = [['produto', 'Produto'], ['familia', 'Família'], ['ponderacao', 'Ponderação'], ['comissao', 'Comissão'], ['valor', 'Valor']];
 const mcols = [['pacote', 'Pacote'], ['tarifario', 'Tarifário'], ['escalao', 'Escalão'], ['valor', 'Valor']];
 function table(rows, c, kind, edit) {
  return `<table class="mcw-t"><thead><tr>${c.map(x => `<th>${x[1]}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr>${c.map(([k]) => `<td>${edit ? `<input data-k="${kind}" data-i="${i}" data-f="${k}" value="${esc(r[k])}">` : esc(r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 }
 function storeOptions() {
  const list = typeof accessibleManagerStores === 'function' ? accessibleManagerStores() : (shopRegistry || []);
  return (list || []).filter(s => s && s.id && s.name);
 }
 function peopleOf(storeIds) {
  const seen = new Map();
  for (const s of (macCloudDirectory?.stores || [])) if (storeIds.includes(s.id)) for (const u of s.users || []) if (u && u.id && !seen.has(u.id)) seen.set(u.id, u);
  return [...seen.values()];
 }
 function openDialog() {
  const w = state?.weights || {};
  const cat = w.importedCatalog || { products: [], mobiles: [] };
  const edit = rules.canManage(session?.role);
  const file = currentFile();
  const files = (filesCache && filesCache.files) || [];
  const selected = new Set(file && file.storeIds && file.storeIds.length ? file.storeIds : (currentShopId ? [currentShopId] : []));
  const shared = new Set((file && file.sharedWith) || []);
  const at = w.macCommissionUpdatedAt ? new Date(w.macCommissionUpdatedAt).toLocaleString('pt-PT') : 'Sem registo';
  const d = document.createElement('dialog');
  d.className = 'mac-edit-dialog mcw-d';
  d.innerHTML = `<h2>✏️ Ficheiro de comissionamento</h2>
<p class="smalltext"><strong>Ficheiro:</strong> ${esc(w.macCommissionSourceName || 'Nenhum importado')}<br><strong>Última atualização:</strong> ${esc(at)}<br><strong>Atualizado por:</strong> ${esc(w.macCommissionUpdatedBy || 'Sem registo')}${w.macCommissionVersion ? `<br><strong>Versão:</strong> ${Number(w.macCommissionVersion) || 0}` : ''}</p>
<fieldset class="mcw-fs"><legend>🏬 Lojas associadas ao ficheiro</legend>
<div class="mcw-tools"><input id="mcwStoreSearch" type="search" placeholder="Pesquisar loja pelo nome" aria-label="Pesquisar loja pelo nome"><button type="button" class="btn small" id="mcwStoreAll">Selecionar todas</button><button type="button" class="btn small ghost" id="mcwStoreNone">Limpar seleção</button><span id="mcwStoreCount" class="smalltext"></span></div>
<div id="mcwStores" class="mcw-shops"></div>
<p class="smalltext muted">O mesmo ficheiro fica associado às lojas escolhidas; cada loja mantém os seus colaboradores, vendas, resultados e objetivos.</p></fieldset>
<details open><summary>Produtos (${(cat.products || []).length})</summary><div class="mcw-s">${table(cat.products || [], cols, 'products', edit)}</div></details>
<details><summary>Móveis (${(cat.mobiles || []).length})</summary><div class="mcw-s">${table(cat.mobiles || [], mcols, 'mobiles', edit)}</div></details>
<fieldset class="mcw-fs"><legend>👥 Partilhar com</legend><div id="mcwPeople" class="mcw-shops"></div><p class="smalltext muted">Sem seleção: todos os utilizadores com acesso a uma das lojas associadas. Não há links públicos e as permissões são validadas na Cloud.</p></fieldset>
<div class="mcw-a"><button type="button" class="btn small" data-a="orig" ${loaded && loaded.source ? '' : 'disabled'}>⬇️ Original</button><button type="button" class="btn small" data-a="json">⬇️ Dados atuais</button>${loaded && loaded.previous && loaded.previous.catalog && edit ? '<button type="button" class="btn small" data-a="prev">↩️ Repor versão anterior</button>' : ''}<span style="flex:1"></span><button type="button" class="btn small ghost" data-a="close">Cancelar</button>${edit ? '<button type="button" class="btn small primary" data-a="save">Guardar alterações</button>' : ''}</div>`;
  document.body.appendChild(d);
  d.addEventListener('close', () => d.remove());

  const count = () => { const el = $e('mcwStoreCount'); if (el) el.textContent = selected.size + (selected.size === 1 ? ' loja selecionada' : ' lojas selecionadas'); };
  const paintStores = () => {
   const q = plain($e('mcwStoreSearch').value || '');
   const rows = storeOptions().filter(s => !q || plain(s.name).includes(q));
   $e('mcwStores').innerHTML = rows.map(s => {
    const other = rules.otherFile(files, file, s.id);
    const mine = !!(file && (file.storeIds || []).includes(s.id));
    return `<label class="mcw-shop"><input type="checkbox" data-store="${esc(s.id)}" ${selected.has(s.id) ? 'checked' : ''}><span>${esc(s.name)}</span>${mine ? '<small class="mcw-tag">usa este ficheiro</small>' : ''}${other ? `<small class="mcw-tag warn">usa «${esc(other.name || 'outro ficheiro')}»</small>` : ''}</label>`;
   }).join('') || '<p class="smalltext muted">Sem lojas disponíveis.</p>';
   count();
  };
  const paintPeople = () => {
   const ids = [...(selected.size ? selected : ((file && file.storeIds) || (currentShopId ? [currentShopId] : [])))];
   const people = peopleOf(ids);
   $e('mcwPeople').innerHTML = people.map(u => `<label class="mcw-shop"><input type="checkbox" data-person="${esc(u.id)}" ${shared.has(u.id) ? 'checked' : ''}><span>${esc(u.name)}</span></label>`).join('') || '<p class="smalltext muted">Sem utilizadores nas lojas selecionadas.</p>';
  };
  d.addEventListener('change', ev => {
   const store = ev.target.closest?.('[data-store]');
   if (store) { store.checked ? selected.add(store.dataset.store) : selected.delete(store.dataset.store); count(); return; }
   const person = ev.target.closest?.('[data-person]');
   if (person) person.checked ? shared.add(person.dataset.person) : shared.delete(person.dataset.person);
  });
  d.addEventListener('click', ev => {
   const a = ev.target.closest('[data-a]')?.dataset.a;
   if (!a) return;
   if (a === 'close') { d.close(); return; }
   if (a === 'json') { downloadFile('comissionamento-' + (Number(w.macCommissionVersion) || 0) + '.json', JSON.stringify(cat, null, 1), 'application/json'); return; }
   if (a === 'orig') {
    if (!loaded || !loaded.source) return toast('O ficheiro original não está guardado na Cloud.', true);
    try {
     const bytes = Uint8Array.from(atob(loaded.source.data), c => c.charCodeAt(0));
     const url = URL.createObjectURL(new Blob([bytes], { type: loaded.source.type || 'application/octet-stream' }));
     const link = document.createElement('a');
     link.href = url; link.download = loaded.source.name || 'comissionamento'; link.click();
     setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { toast('Não foi possível descarregar: ' + (e && e.message || e), true); }
    return;
   }
   if (a === 'all') { storeOptions().forEach(s => selected.add(s.id)); paintStores(); return; }
   if (a === 'save' || a === 'prev') void run(a, ev.target);
  });
  $e('mcwStoreSearch').addEventListener('input', paintStores);
  $e('mcwStoreAll').addEventListener('click', () => { storeOptions().forEach(s => selected.add(s.id)); paintStores(); });
  $e('mcwStoreNone').addEventListener('click', () => { selected.clear(); paintStores(); });
  const run = async (kind, button) => {
   const btn = button;
   btn.disabled = true;
   try {
    const next = structuredClone(cat);
    if (kind === 'save') d.querySelectorAll('input[data-k]').forEach(i => {
     const row = next[i.dataset.k] && next[i.dataset.k][+i.dataset.i];
     if (!row) return;
     const f = i.dataset.f, v = i.value;
     row[f] = typeof row[f] === 'number' && v.trim() !== '' && !isNaN(+v.replace(',', '.')) ? +v.replace(',', '.') : v;
    });
    if (!next.products || !next.products.length) throw Error('Não existem produtos válidos.');
    const storeIds = [...selected];
    if (!storeIds.length) throw Error('Escolhe pelo menos uma loja.');
    const clash = rules.needsConfirmation(files, file, storeIds);
    if (clash.length && !confirm('As lojas ' + clash.map(c => '«' + (c.name || c.id) + '»').join(', ') + ' usam outro ficheiro de comissionamento. Queres substituir essa associação?')) { btn.disabled = false; return; }
    const meta = kind === 'prev' ? await restorePrevious(storeIds, [...shared]) : await saveFile(next, storeIds, [...shared]);
    toast('Ficheiro «' + meta.name + '» guardado na Cloud (v' + meta.version + ') · ' + meta.storeIds.length + (meta.storeIds.length === 1 ? ' loja' : ' lojas') + ' associada(s).');
    d.close();
   } catch (e) { toast(e && e.message || String(e), true); btn.disabled = false; }
  };
  paintStores();
  paintPeople();
  d.showModal();
 }
 function ensureButton() {
  const up = $e('weightsUploadBtn');
  if (!up || $e('macWeightsEditBtn')) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.id = 'macWeightsEditBtn';
  b.className = 'btn small';
  b.title = 'Editar, associar lojas, descarregar e partilhar o ficheiro';
  b.setAttribute('aria-label', '✏️ Editar ficheiro de comissionamento');
  b.textContent = '✏️';
  b.addEventListener('click', openDialog);
  up.before(b);
 }
 new MutationObserver(ensureButton).observe(document.documentElement, { childList: true, subtree: true });
 ensureButton();
 void loadFiles(true).catch(() => {});

 const style = document.createElement('style');
 style.textContent = `.mcw-d{width:min(900px,calc(100vw - 24px));max-height:88vh;overflow:auto}
.mcw-s{max-height:46vh;overflow:auto}
.mcw-t{width:100%;border-collapse:collapse;font-size:13px}
.mcw-t th,.mcw-t td{padding:4px;border-bottom:1px solid var(--line,rgba(127,127,127,.25));text-align:left}
.mcw-t input{width:100%;min-width:70px;font:inherit;padding:3px 5px}
.mcw-a{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
#macWeightsEditBtn{margin-right:0}
.mcw-fs{border:1px solid var(--border);border-radius:12px;padding:11px 12px;margin:14px 0}
.mcw-fs legend{font-size:12px;font-weight:850;padding:0 5px}
.mcw-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:9px}
.mcw-tools input{flex:1 1 180px;min-width:0;min-height:38px;padding:7px 10px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font:inherit}
.mcw-shops{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:7px;max-height:230px;overflow:auto;padding:2px}
.mcw-shop{display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:10px;padding:8px 10px;font-size:13px;background:var(--surface);min-width:0}
.mcw-shop span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.mcw-shop input{flex:0 0 auto}
.mcw-tag{font-size:10px;font-weight:800;color:var(--muted);border:1px solid var(--border);border-radius:6px;padding:2px 5px;white-space:nowrap}
.mcw-tag.warn{color:#b45309;border-color:#f0c274}
@media(max-width:600px){.mcw-shops{grid-template-columns:minmax(0,1fr)}.mcw-tools input{flex:1 1 100%}}`;
 document.head.appendChild(style);
})();

// Avatares sempre circulares em toda a aplicação, sem alterar dimensões próprias de cada menu.
(()=>{const st=document.createElement('style');st.textContent=`html body .employee-avatar{aspect-ratio:1/1!important;border-radius:50%!important;overflow:hidden!important;flex-shrink:0!important}html body .employee-avatar img,html body img.employee-avatar{width:100%!important;height:100%!important;object-fit:cover!important;object-position:center!important;border-radius:50%!important;display:block!important}`;(document.head||document.documentElement).appendChild(st);})();
// Bem-vindo: fotografia circular + nome + cargo real (Cloud) do utilizador selecionado, pelo ID único.
window.addEventListener('load',()=>{
 if(typeof renderLoginPhoto!=='function'||typeof selectedLoginAccount!=='function')return;
 const cachePhoto=new Map();let req=0;
 renderLoginPhoto=async function(){
  const n=++req,d=document.getElementById('loginUserPhoto');if(!d)return;
  const {user}=selectedLoginAccount()||{};if(!user){d.innerHTML='';return;}
  const cargo=String(user.cargo||'').trim()||(user.role==='gestor'?'Gestor de Loja':'Colaborador');
  const paint=photo=>{if(n!==req)return;d.innerHTML=avatarFor(user.name,photo||'','login')+'<span class="mac-login-names"><strong>'+h(user.name)+'</strong><small>'+h(cargo)+'</small></span>';};
  const known=cachePhoto.get(user.id);paint(known||user.photo||'');
  if(known!==undefined||user.photo)return;
  try{const photo=await macRPC('login-photo',{id:user.id});cachePhoto.set(user.id,photo||'');paint(photo||'');}catch(_){}
 };
 window.addEventListener('mac-photos-updated',()=>{cachePhoto.clear();try{renderLoginPhoto();}catch(_){}});
 const st=document.createElement('style');st.textContent='#loginUserPhoto .mac-login-names{display:flex;flex-direction:column;text-align:left}#loginUserPhoto .mac-login-names small{font-size:12px;font-weight:400;opacity:.75}';document.head.appendChild(st);
});

// ===== Permissões individuais delegadas (Configurações do MAC Vision) =====
// Fonte única: tabela Cloud de permissões por colaborador e loja; a Cloud valida cada gravação com as mesmas regras.
// Nada é guardado no navegador: a lista vem da Cloud ao entrar, ao voltar ao separador e a cada 20 segundos.
let macDelegated={};let macDelegatedUser='';
window.macCan=function(perm,storeId){
 if(typeof session==='undefined'||!session)return false;
 if(session.role==='gestor')return true;
 const list=macDelegated[String(storeId||currentShopId)]||[];
 return list.includes('all')||list.includes(perm);
};
async function macRefreshDelegated(force){
 if(typeof session==='undefined'||!session){macDelegated={};macDelegatedUser='';return;}
 if(session.role==='gestor'){macDelegated={};macDelegatedUser=session.id;return;}
 let next;try{next=await macRPC('permissions-get',{})||{};}catch(e){return;}
 const changed=JSON.stringify(canonical(next))!==JSON.stringify(canonical(macDelegated))||macDelegatedUser!==session.id;
 macDelegated=next;macDelegatedUser=session.id;
 const cfg=document.getElementById('page-config');
 if(cfg){cfg.classList.toggle('mac-delegated-weights',macCan('weights.manage'));cfg.classList.toggle('mac-delegated-data',macCan('data.export'));}
 if(changed||force){try{refreshNavigation();}catch(_){}try{if(typeof render==='function')render();}catch(_){}}
}
setInterval(()=>{if(typeof session!=='undefined'&&session&&macDelegatedUser!==session.id)void macRefreshDelegated(true);},1500);
setInterval(()=>{if(typeof session!=='undefined'&&session&&!document.hidden)void macRefreshDelegated(false);},20000);
window.addEventListener('focus',()=>void macRefreshDelegated(false));
(()=>{const st=document.createElement('style');st.textContent=`#page-config.mac-role-collaborator.mac-delegated-weights #configHome .mac-settings-home-grid>.config-menu-tile[data-config-target="weights"],#page-config.mac-role-collaborator.mac-delegated-data #configHome .mac-settings-home-grid>.config-menu-tile[data-config-target="data"]{display:flex!important}
#macDelegatedPermissions{margin-top:18px;display:grid;gap:11px}#macDelegatedPermissions .mdp-head{display:flex;flex-wrap:wrap;gap:10px;align-items:center}#macDelegatedPermissions select{min-width:220px;max-width:100%}
#macDelegatedPermissions .mdp-stores{display:flex;flex-wrap:wrap;gap:8px 16px}#macDelegatedPermissions .mdp-stores label{display:flex;gap:6px;align-items:center;font-size:13px}
#macDelegatedPermissions .mdp-group{font-weight:850;font-size:13px;margin:6px 0 -2px;color:var(--muted)}#macDelegatedPermissions .mdp-actions{display:flex;flex-wrap:wrap;gap:8px}#macDelegatedPermissions .mdp-summary{font-size:12px;color:var(--muted);line-height:1.6}`;document.head.appendChild(st);})();
const MAC_DELEGABLE=[
 ['Visualizar',[['dashboard.view','◈ Painel / Visão Geral e indicadores'],['history.view','≡ Histórico de Vendas'],['tickets.view','☷ Tráfego e Produtividade / MOVIIK'],['ios.view','▤ Quadro IOS'],['imports.view','⇪ Importações (consultar)']]],
 ['Vendas',[['sales.edit','✏️ Editar e corrigir vendas de toda a equipa'],['sales.delete','🗑️ Eliminar vendas de toda a equipa']]],
 ['Importações',[['imports.moviik','⇪ Importar ficheiros MOVIIK / PDS e gerir importações']]],
 ['Escala Mensal',[['schedule.edit','▦ Criar, alterar, importar e guardar escalas']]],
 ['Equipa e objetivos',[['employees.manage','👥 Gerir colaboradores e objetivos comerciais']]],
 ['Ponderação e Comissionamento',[['weights.manage','⚖️ Gerir ponderações por produto e comissões']]],
 ['Gestão de Dados',[['data.export','🗂️ Exportar cópias de segurança']]],
];
const MAC_DELEGABLE_KEYS=MAC_DELEGABLE.flatMap(g=>g[1].map(x=>x[0]));
const macPermLabel=k=>k==='all'?'Acesso total às funcionalidades delegáveis':(MAC_DELEGABLE.flatMap(g=>g[1]).find(x=>x[0]===k)?.[1]||k);
let mdp={user:'',stores:[],saved:{},draft:new Set(),status:''};
function mdpManageable(){try{return (typeof accessibleManagerStores==='function'?accessibleManagerStores():[]).filter(s=>typeof macCanAdministerStore!=='function'||macCanAdministerStore(s.id));}catch(_){return [];}}
function mdpCollaborators(){const map=new Map();for(const s of mdpManageable())for(const u of s.users||[])if(u.role==='colaborador'&&!u.isAreaMaster&&u.id!==session?.id){const e=map.get(u.id)||{id:u.id,name:u.name,stores:[]};e.stores.push(s);map.set(u.id,e);}return [...map.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt'));}
async function mdpLoad(uid){mdp.user=uid;mdp.saved={};mdp.status='A carregar da Cloud…';mdpRender();
 try{mdp.saved=await macRPC('permissions-get',{userId:uid})||{};mdp.status='';}catch(e){mdp.status='⚠️ '+e.message;}
 const first=mdp.stores[0];mdp.draft=new Set(first?(mdp.saved[first]||[]):[]);mdpRender();}
function mdpRender(){
 const panel=document.getElementById('configPanelVision');if(!panel||typeof session==='undefined'||!session||session.role!=='gestor')return;
 let root=document.getElementById('macDelegatedPermissions');
 if(!root){root=document.createElement('div');root.id='macDelegatedPermissions';const anchor=document.getElementById('macVisionPermissions');(anchor?.parentNode||panel).insertBefore(root,anchor?anchor.nextSibling:null);
  root.addEventListener('change',mdpChange);root.addEventListener('click',mdpClick);}
 const people=mdpCollaborators();if(mdp.user&&!people.some(p=>p.id===mdp.user)){mdp.user='';mdp.stores=[];}
 const person=people.find(p=>p.id===mdp.user);
 if(person&&!mdp.stores.length)mdp.stores=person.stores.map(s=>s.id);
 const sets=mdp.stores.map(s=>JSON.stringify((mdp.saved[s]||[]).slice().sort()));const differ=new Set(sets).size>1;
 const all=mdp.draft.has('all');const T=(k,label,dis)=>`<div class="mac-permission-row"><div><div class="mac-permission-title">${h(label)}</div></div><label class="mac-permission-toggle"><input type="checkbox" data-mac-permission="delegated" data-mdp-perm="${k}" ${mdp.draft.has(k)||(all&&k!=='all')?'checked':''} ${dis?'disabled':''}><span class="mac-toggle-track" aria-hidden="true"></span><span>${all&&k!=='all'?'Incluído':'Ativo'}</span></label><span></span></div>`;
 const pending=person&&mdp.stores.some(s=>JSON.stringify((mdp.saved[s]||[]).slice().sort())!==JSON.stringify([...mdp.draft].sort()));
 root.innerHTML=`<div class="mac-permission-row" style="display:block"><div class="mac-permission-title">🔑 Permissões individuais por colaborador</div><div class="mac-permission-note">Uma permissão concedida aqui prevalece sobre os bloqueios do perfil Colaborador e é validada na Cloud em cada operação, apenas nas lojas escolhidas. Criar administradores, alterar credenciais, permissões ou regras de segurança continua reservado aos Administradores.</div>
 <div class="mdp-head" style="margin-top:12px"><label class="smalltext" for="mdpUser"><strong>Utilizador</strong></label><select id="mdpUser" data-mac-permission="delegated"><option value="">Escolher colaborador</option>${people.map(p=>`<option value="${h(p.id)}" ${p.id===mdp.user?'selected':''}>${h(p.name)}</option>`).join('')}</select></div>
 ${person?`<div class="mdp-group">Lojas (âmbito)</div><div class="mdp-stores">${person.stores.map(s=>`<label><input type="checkbox" data-mac-permission="delegated" data-mdp-store="${h(s.id)}" ${mdp.stores.includes(s.id)?'checked':''}> ${h(s.name)}</label>`).join('')}</div>${differ?'<p class="smalltext muted">⚠️ As lojas escolhidas têm permissões diferentes; ao guardar, todas ficam com a seleção abaixo.</p>':''}`:'<p class="smalltext muted" style="margin-top:8px">'+(people.length?'Escolhe um colaborador para ver e alterar as permissões.':'Ainda não existem colaboradores nas lojas que administras.')+'</p>'}
 </div>${person?`${T('all','☑ ACESSO TOTAL ÀS FUNCIONALIDADES DELEGÁVEIS',!mdp.stores.length)}${MAC_DELEGABLE.map(([g,items])=>`<div class="mdp-group">${h(g)}</div>${items.map(([k,l])=>T(k,l,all||!mdp.stores.length)).join('')}`).join('')}
 <div class="mdp-actions"><button type="button" class="btn small" data-mdp-act="select">Selecionar todas as permissões delegáveis</button><button type="button" class="btn small" data-mdp-act="clear">Remover todas as permissões delegadas</button><button type="button" class="btn primary" data-mdp-act="save" ${mdp.stores.length?'':'disabled'}>☁️ Guardar na Cloud</button></div>
 <p class="smalltext" aria-live="polite">${h(mdp.status||(pending?'● Alterações por guardar':'✓ Estado igual ao guardado na Cloud'))}</p>
 <div class="mdp-summary"><strong>Acessos efetivos guardados:</strong><br>${person.stores.map(s=>{const l=mdp.saved[s.id]||[];return `${h(s.name)}: ${l.length?h(l.includes('all')?macPermLabel('all'):l.map(macPermLabel).join(' · ')):'apenas o perfil base de Colaborador'}`;}).join('<br>')}</div>`:''}`;
}
function mdpChange(e){const t=e.target;
 if(t.id==='mdpUser'){mdp.stores=[];if(t.value)void mdpLoad(t.value);else{mdp.user='';mdpRender();}return;}
 if(t.dataset.mdpStore){const id=t.dataset.mdpStore;mdp.stores=t.checked?[...new Set([...mdp.stores,id])]:mdp.stores.filter(x=>x!==id);mdp.status='';mdpRender();return;}
 if(t.dataset.mdpPerm){const k=t.dataset.mdpPerm;if(t.checked)mdp.draft.add(k);else mdp.draft.delete(k);if(k==='all'&&t.checked)for(const x of MAC_DELEGABLE_KEYS)mdp.draft.delete(x);mdp.status='';mdpRender();}
}
async function mdpClick(e){const b=e.target.closest('[data-mdp-act]');if(!b)return;const act=b.dataset.mdpAct;
 if(act==='select'){mdp.draft=new Set(['all']);mdp.status='';return mdpRender();}
 if(act==='clear'){mdp.draft=new Set();mdp.status='';return mdpRender();}
 if(act==='save'){b.disabled=true;mdp.status='A guardar na Cloud…';mdpRender();
  try{await macRPC('permissions-save',{userId:mdp.user,stores:mdp.stores,perms:[...mdp.draft]});mdp.saved=await macRPC('permissions-get',{userId:mdp.user})||{};
   mdp.status='✓ Guardado na Cloud às '+new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'});toast('Permissões guardadas na Cloud.');}
  catch(err){mdp.status='⚠️ '+err.message;toast(err.message,true);}
  mdpRender();}
}
document.addEventListener('DOMContentLoaded',()=>{const panel=document.getElementById('configPanelVision');if(!panel)return;
 new MutationObserver(()=>{if(!panel.hidden)mdpRender();}).observe(panel,{attributes:true,attributeFilter:['hidden']});});

// ---- Bem-vindo após logout e segurança de acesso pela escala (validada na Cloud) ----
function macShowShiftPopup(text){
 const pop=document.getElementById('macNoPermissionPopup');
 const p=pop?.querySelector('.mac-no-access-text');if(p)p.textContent=text||'CONTACTA O GESTOR DE LOJA';
 if(pop){pop.hidden=false;document.getElementById('macNoAccessClose')?.focus();}
}
async function macReloadLoginDirectory(){
 // Lista pública de todas as contas ativas; nunca filtrada pela escala nem pela sessão anterior.
 const box=document.getElementById('authError');
 try{
  const dir=await macRPC('public-directory');
  macCloudDirectory=dir;shopRegistry=structuredClone(dir.stores||[]);
  authError('');renderLogin();
 }catch(err){
  console.warn('Bem-vindo: falha ao ligar à Cloud',err);
  if(box){box.innerHTML='Não foi possível ligar à Cloud. <button type="button" id="macDirRetry" class="mac-no-access-close" style="margin-left:6px;padding:4px 10px">Tentar novamente</button>';
   document.getElementById('macDirRetry')?.addEventListener('click',()=>{box.textContent='A ligar…';void macReloadLoginDirectory();});}
 }
}
window.macReloadLoginDirectory=macReloadLoginDirectory;
document.addEventListener('DOMContentLoaded',()=>{
 const clientRule=window.macShiftAccessStatus;
 // A Cloud decide; a regra local só serve enquanto a resposta da Cloud não chega (restauro).
 window.macShiftAccessStatus=function(storeState,user,when){
  const c=window.macShiftCache;
  if(user?.role==='colaborador'&&c&&(c.userId===user.id||c.userId===session?.id)&&c.storeId===(currentShopId||c.storeId)&&Date.now()-c.at<120000&&!when)return c.result;
  return clientRule(storeState,user,when);
 };
 let warned=false,checking=false;
 async function check(){
  if(checking||typeof session==='undefined'||!session||session.role!=='colaborador'||!currentShopId)return;
  checking=true;const s=session,shop=currentShopId;
  try{
   const r=await macRPC('shift-check',{storeId:shop});
   if(session!==s||currentShopId!==shop)return;
   window.macShiftCache={userId:s.id,storeId:shop,at:Date.now(),result:r};
   if(r.allowed){
    const left=r.until?Date.parse(r.until)-Date.now():Infinity;
    if(left<5*60000&&!warned){warned=true;toast('O teu período de acesso termina dentro de 5 minutos. Guarda o que estás a fazer.',true);}
    if(left>5*60000)warned=false;
    return;
   }
   await logout();
   if(!session)macShowShiftPopup(r.message);
  }catch(err){console.warn('Escala: verificação na Cloud indisponível',err);}
  finally{checking=false;}
 }
 setInterval(()=>{if(!document.hidden)void check();},30000);
 window.addEventListener('focus',()=>void check());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});
 window.addEventListener('mac-shift-recheck',()=>void check());
 const prevLogin=loginToStore;
 loginToStore=async function(){const out=await prevLogin.apply(this,arguments);setTimeout(()=>void check(),500);return out;};
});

/* Seleção global de loja: uma única loja ativa para todos os menus, mudanças em série (a última escolha ganha,
   respostas antigas nunca substituem a nova loja) e última loja guardada nas preferências da conta na Cloud. */
window.addEventListener('load',()=>{
 const LAST_STORE_PREF='mac-last-store';
 if(typeof switchManagerStore!=='function'||typeof loginToStore!=='function')return;
 const baseSwitch=switchManagerStore;let chain=Promise.resolve(),wanted=null;
 switchManagerStore=function(storeId){
  wanted=storeId;
  const run=chain.catch(()=>{}).then(async()=>{
   if(wanted!==storeId)return; // uma escolha mais recente substitui esta
   await baseSwitch(storeId);
   if(wanted!==storeId||currentShopId!==storeId)return;
   try{macQueuePreference(LAST_STORE_PREF,storeId);}catch(_){}
   try{const w=document.getElementById('macWeightsStoreSelect');if(w&&w.value!==storeId&&[...w.options].some(o=>o.value===storeId))w.value=storeId;}catch(_){}
   window.dispatchEvent(new CustomEvent('mac-store-changed',{detail:{storeId}}));
  });
  chain=run;return run;
 };
 const baseLogin=loginToStore;
 loginToStore=async function(){
  const out=await baseLogin.apply(this,arguments);
  try{
   if(session?.role==='gestor'){
    const last=macVolatilePrefs.get(LAST_STORE_PREF);
    if(last&&last!==currentShopId&&accessibleManagerStores().some(s=>s.id===last))await switchManagerStore(last);
   }
  }catch(error){console.warn('Última loja não reposta',error);}
  return out;
 };
});
// Chat Vision mobile: o cabeçalho cresce com os separadores, que nunca se sobrepõem às mensagens.
(()=>{const st=document.createElement('style');st.textContent=`html body #macChatPanel .mac-chat-head{height:auto!important;min-height:0!important;max-height:none!important;flex:0 0 auto!important;align-items:flex-start!important;overflow:visible!important}
html body #macChatPanel .mcv-head{min-width:0!important;overflow:hidden}
html body #macChatPanel .mcv-tabs{flex:0 0 auto!important;min-height:42px!important;align-items:center!important;overflow-x:auto!important;overflow-y:hidden!important;padding:2px 1px!important;position:static!important}
html body #macChatPanel .mcv-tab{flex:0 0 auto!important}
html body #macChatPanel .mac-chat-log{position:relative!important;flex:1 1 auto!important;min-height:0!important}
@media(max-width:600px){html body #macChatPanel .mac-chat-head{flex-wrap:nowrap!important}html body #macChatPanel .mac-chat-head{display:flex!important;flex-direction:row!important;justify-content:space-between!important;gap:6px!important}html body #macChatPanel .mcv-head{order:1!important;flex:1 1 auto!important}html body #macChatPanel .mac-chat-head-actions{order:2!important;flex:0 0 auto!important;margin-left:auto!important;display:flex!important;flex-wrap:nowrap!important;gap:4px!important}html body #macChatPanel .mac-chat-head-actions .btn{min-width:34px!important;padding:4px 6px!important}html body #macChatPanel .mcv-tab .employee-avatar{width:28px!important;height:28px!important;min-width:28px!important;max-width:28px!important;min-height:28px!important;max-height:28px!important}}`;(document.head||document.documentElement).appendChild(st);})();
// Mobile: data do histórico e tabela de senhas por colaborador cabem no ecrã.
(()=>{const st=document.createElement('style');st.textContent=`@media(max-width:700px){html body #historyDate{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;-webkit-appearance:none!important;appearance:none!important;height:44px!important;min-height:44px!important;line-height:44px!important;padding:0 12px!important;text-align:center!important}
html body #historyDate::-webkit-date-and-time-value{text-align:center;margin:0}
html body #ticketsByEmployee{overflow:visible!important}html body #ticketsByEmployee .tbl{width:100%!important;min-width:0!important;table-layout:fixed!important}
html body #ticketsByEmployee .tbl th,html body #ticketsByEmployee .tbl td{padding:8px 3px!important;font-size:12px!important;letter-spacing:0!important;white-space:normal!important;word-break:break-word}
html body #ticketsByEmployee .tbl th{font-size:9.5px!important;line-height:1.2!important}
html body #ticketsByEmployee .tbl th:first-child,html body #ticketsByEmployee .tbl td:first-child{width:32%!important;padding-left:6px!important;text-align:left!important}}`;(document.head||document.documentElement).appendChild(st);})();
// Mobile: data do histórico dentro da caixa; Chat Vision com nome à esquerda e botões à direita; mensagens lidas a azul.
(()=>{const st=document.createElement('style');st.textContent=`html body #macChatPanel .mac-chat-message small .mac-chat-read,html body #macChatPanel .mac-chat-message.own small .mac-chat-read{color:#1d8cf8!important;font-weight:700}
@media(max-width:700px){html body #historyDate{width:100%!important;width:-webkit-fill-available!important;max-width:100%!important;flex:0 0 auto!important;align-self:stretch!important;overflow:hidden!important;margin-left:0!important;margin-right:0!important}}
@media(max-width:600px){html body #macChatPanel .mac-chat-head>#mcvHead{order:0!important;flex:0 0 0!important;width:0!important;min-width:0!important;overflow:hidden!important}
html body #macChatPanel .mac-chat-head>#mcvTabs{order:1!important;flex:1 1 0!important;width:auto!important;min-width:0!important;justify-content:flex-start!important}
html body #macChatPanel .mac-chat-head>.mac-chat-head-actions{order:2!important;flex:0 0 auto!important;width:auto!important;margin-left:auto!important;justify-content:flex-end!important}}`;(document.head||document.documentElement).appendChild(st);})();
