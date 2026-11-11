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
 if(data.kind==='event'&&session&&!macStateDirty){void (async()=>{const next=await readKey('store:'+currentShopId);if(next){state=shape(next);render();}})().catch(console.warn);}
});
const macSessionDraft=new Map();
let macCloudDirectory=null;
initDB=async function(){db=null;storageKind='cloud';macCloudDirectory=await macRPC('directory');};
readKey=async function(key){
 if(key===REGISTRY_KEY)return macCloudDirectory?.stores||[];
 if(macSessionDraft.has(key))return macSessionDraft.get(key);
 try{return await macRPC('read',{key});}catch(error){if(!session&&!pendingSetupManager)return null;throw error;}
};
writeKey=async function(key,value){
 if(key===REGISTRY_KEY){await macRPC('registry-save',{stores:value});macCloudDirectory=await macRPC('directory');return true;}
 if(key===MAC_PENDING_MANAGER_KEY||key===MAC_SETUP_WORKSPACE_KEY){macSessionDraft.set(key,structuredClone(value));return macRPC('write',{key,value});}
 return macRPC('write',{key,value});
};
deleteKey=async function(key){if(key===MAC_PENDING_MANAGER_KEY||key===MAC_SETUP_WORKSPACE_KEY){macSessionDraft.delete(key);return;}return macRPC('delete',{key});};
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
 if(!pendingSetupManager&&!session&&macCloudDirectory?.wallets?.length&&!macCloudDirectory?.stores?.length){
  const account=macCloudDirectory.accounts?.find(a=>a.name===name&&a.role==='admin');
  if(!account)throw Error('A carteira já tem administrador. Usa a conta existente.');
  await macRPC('login',{id:account.id,password});
  return {id:account.id,name,role:'gestor',isAreaMaster:true,adminRole:'area'};
 }
 if(!pendingSetupManager&&!session&&!(macCloudDirectory?.wallets?.length)){
  const wallet=document.getElementById('setupCarteira').value.trim().toUpperCase();
  return macRPC('bootstrap',{name,role,password,wallet,appName:document.getElementById('setupAppName').value});
 }
 return macRPC('account',{name,role,password,employee});
};
const macOriginalSubmitLogin=submitLogin;
submitLogin=async function(event){
 event.preventDefault();const {shop,user}=selectedLoginAccount();if(!shop||!user)return authError('Escolhe acesso, utilizador e loja.');
 try{await macRPC('login',{id:user.id,password:document.getElementById('loginPassword').value});const access=Object.fromEntries(shopRegistry.filter(s=>s.users.some(u=>u.id===user.id)).map(s=>[s.id,user.id]));await loginToStore(shop,user,access,document.getElementById('loginRole').value);authError('');}catch(error){authError(error.message);}
};
const macOriginalLogout=logout;
logout=async function(){const result=await macOriginalLogout.apply(this,arguments);if(!session)await macRPC('logout');return result;};
const macOriginalLoadRegistry=loadRegistry;
loadRegistry=async function(){shopRegistry=macCloudDirectory?.stores||[];};
const macOriginalStart=start;
start=async function(){
 const field=document.getElementById('setupCarteira');
 const label=document.querySelector('label[for="setupCarteira"]');if(label)label.textContent='Nome da Carteira';
 field?.setAttribute('pattern','[A-Z0-9_\\-]{1,20}');
 field?.addEventListener('input',()=>{field.value=field.value.toUpperCase();});
 await macOriginalStart();
};
const macOriginalFinish=finishAreaSetup;
finishAreaSetup=async function(){
 if(pendingSetupManager){
  const master={...pendingSetupManager,adminOnly:true,salesEnabled:false};
  const stores=pendingSetupWorkspace.stores.map(store=>({...store,users:[master,...pendingSetupWorkspace.managers.filter(u=>u.setupPermission!=='store'||u.assignedStoreIds?.includes(store.id))]}));
  await macRPC('registry-save',{stores});
 }
 return macOriginalFinish();
};

const macVolatilePrefs=new Map();
Object.defineProperty(window,'localStorage',{value:{
 getItem:key=>macVolatilePrefs.get(String(key))??null,
 setItem(key,value){macVolatilePrefs.set(String(key),String(value));if(session)void macRPC('preference',{key:String(key),value:String(value)}).catch(console.warn);},
 removeItem(key){macVolatilePrefs.delete(String(key));},
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
 return macRPC('write',{key:'attachment:'+key,value:{data:btoa(text),name:file.name||'',type:file.type||'',storeId:currentShopId}});
}
async function macGetBlob(key){const item=await macRPC('read',{key:'attachment:'+key});if(!item)return null;return new File([Uint8Array.from(atob(item.data),c=>c.charCodeAt(0))],item.name,{type:item.type});}