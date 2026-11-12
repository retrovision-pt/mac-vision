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
window.addEventListener('beforeunload',event=>{if(macStateDirty||saveTimer!==null){event.preventDefault();event.returnValue='';}});