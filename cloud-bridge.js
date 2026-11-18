/* MAC Vision | Supabase Auth + REST com revisões e deteção de conflitos.
 * Ficheiro publicável: só contém a chave publishable, nunca segredos administrativos.
 * Todas as autorizações de loja são validadas pelas políticas RLS do PostgreSQL.
 */
(function(){
'use strict';
const cfg=window.MAC_CLOUD_CONFIG||{};
const registryKey='rc-clean-install-20261110-registry-v2';
const AUTH_CACHE='mac-vision-cloud-session-v1';
const endpoint=String(cfg.url||'').replace(/\/$/,'');
let tokens=null,profile=null,access=[],lastCloudError='',bootPromise=null;
const versions=new Map(),bases=new Map();
const encode=s=>encodeURIComponent(String(s));
const clone=v=>v===undefined||typeof v==='symbol'?v:structuredClone(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function shared(key){return key===registryKey||/^store:[^:]+$/.test(String(key));}
function hasConfig(){return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(endpoint)&&String(cfg.publishableKey||'').startsWith('sb_publishable_');}
function errorFrom(body,status){return new Error(body?.message||body?.msg||body?.error_description||body?.error||`Erro do servidor (${status}).`)}
function gate(){
  let el=document.getElementById('macCloudGate');if(el)return el;
  el=document.createElement('div');el.id='macCloudGate';el.innerHTML=`
  <div class="mac-cloud-panel" role="dialog" aria-modal="true" aria-label="Acesso MAC Vision Cloud">
   <div class="mac-cloud-logo">MAC</div><h1>MAC Vision</h1>
   <p>Inicia sessão para aceder à base de dados partilhada. Vendas, escalas e senhas ficam disponíveis nos dispositivos autorizados.</p>
   <form id="macCloudAuthForm">
    <label>Email de acesso<input type="email" id="macCloudEmail" required autocomplete="username" placeholder="nome@empresa.pt"></label>
    <label>Palavra-passe<input type="password" id="macCloudPassword" required autocomplete="current-password"></label>
    <button type="submit" class="mac-cloud-primary" id="macCloudAuthButton">Entrar na base de dados</button>
   </form>
   <p id="macCloudError" class="mac-cloud-error" aria-live="polite"></p>
   <p class="mac-cloud-foot">O acesso é gerido no Supabase Auth. A publicação no GitHub não guarda dados de colaboradores.</p>
  </div>`;
  const css=document.createElement('style');css.textContent=`
  #macCloudGate{position:fixed;inset:0;z-index:99999;background:radial-gradient(circle at 20% 8%,#214d39,#060e19 60%);display:grid;place-items:center;padding:18px;font-family:Arial,sans-serif;color:#f5f9ff;overflow:auto}
  .mac-cloud-panel{background:#122035;border:1px solid #3b5364;border-radius:20px;max-width:460px;width:100%;padding:30px;box-shadow:0 24px 90px #0009}
  .mac-cloud-logo{display:inline-grid;place-items:center;background:#bad80a;color:#102016;font-weight:900;border-radius:12px;width:52px;height:48px}
  .mac-cloud-panel h1{font-size:28px;margin:16px 0 7px}.mac-cloud-panel p{font-size:13px;line-height:1.7;color:#bdc9d9}
  #macCloudAuthForm{display:grid;gap:15px;margin-top:23px}#macCloudAuthForm label{font-size:12px;font-weight:700;display:grid;gap:7px}
  #macCloudAuthForm input{box-sizing:border-box;width:100%;background:#0c1625;color:#fff;padding:14px;border:1px solid #4b6178;border-radius:10px;font-size:14px}
  .mac-cloud-primary{background:#bad80a;border:0;border-radius:11px;min-height:45px;font-size:14px;font-weight:800;color:#142017;cursor:pointer}
  .mac-cloud-primary:disabled{opacity:.5;cursor:wait}.mac-cloud-error{color:#ff9bab!important;min-height:17px;margin:8px 0 0!important}
  .mac-cloud-foot{font-size:11px!important;margin-top:20px}`;
  document.head.appendChild(css);document.body.appendChild(el);return el;
}
function status(text){const x=document.getElementById('macCloudError');if(x)x.textContent=text||'';lastCloudError=text||'';}
function sessionGet(){try{return JSON.parse(sessionStorage.getItem(AUTH_CACHE)||'null')}catch{return null}}
function sessionSave(t){tokens=t;try{if(t)sessionStorage.setItem(AUTH_CACHE,JSON.stringify(t));else sessionStorage.removeItem(AUTH_CACHE)}catch{}}
async function raw(path,options={}){
 const headers={'apikey':cfg.publishableKey,...options.headers};
 const r=await fetch(endpoint+path,{...options,headers});
 let body;const ct=r.headers.get('content-type')||'';
 if(ct.includes('application/json'))body=await r.json();else body=await r.text();
 if(!r.ok)throw errorFrom(body,r.status);
 return body;
}
async function refresh(){
 if(!tokens?.refresh_token)throw Error('Sessão expirada. Volta a iniciar sessão.');
 const next=await raw('/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:tokens.refresh_token})});
 sessionSave(next);return next;
}
async function authRequest(path,options={},isRetry=false){
 if(!tokens?.access_token)throw Error('Não foi iniciada sessão na Cloud.');
 if(tokens.expires_at && Date.now()/1000>tokens.expires_at-90){await refresh();}
 try{
  return await raw(path,{...options,headers:{Authorization:'Bearer '+tokens.access_token,...options.headers}});
 }catch(e){
  if(!isRetry&&/JWT|expired|token|401|autentica/i.test(e.message||'')){
   try{await refresh();return authRequest(path,options,true)}catch{}
  }
  throw e;
 }
}
function setBase(key,row){
 if(!row){versions.set(key,0);bases.set(key,undefined);return undefined;}
 versions.set(key,Number(row.revision)||1);bases.set(key,clone(row.data));return clone(row.data);
}
async function get(key){
 if(!shared(key))throw Error('Esta chave não pertence à base de dados partilhada.');
 if(key===registryKey){
  const shops=await authRequest('/rest/v1/mac_vision_directory?select=data&order=shop_id.asc');
  const reg=shops.map(x=>x.data);
  if(profile?.role==='admin'){const docs=await authRequest('/rest/v1/mac_vision_docs?key=eq.'+encode(key)+'&select=revision&limit=1');versions.set(key,Number(docs[0]?.revision||0));}
  else versions.set(key,0);
  bases.set(key,clone(reg));return reg;
 }
 const rows=await authRequest('/rest/v1/mac_vision_docs?key=eq.'+encode(key)+'&select=data,revision&limit=1');
 return setBase(key,rows[0]);
}
const MISSING=Symbol('missing');
function idFor(row,path){
 if(!row||typeof row!=='object'||Array.isArray(row))return null;
 for(const k of ['id','uuid','saleId','ticketId','macAttachmentKey'])if(row[k]!=null&&String(row[k])!=='')return k+':'+String(row[k]);
 // Horário por colaborador/data; a mesma pessoa pode ter vários códigos ao longo dos dias.
 if(path.endsWith('.schedules')&&row.employee&&row.date)return 'shift:'+row.employee+'|'+row.date;
 return null;
}
function merge(base,local,remote,path='data'){
 if(same(local,remote))return clone(local);
 if(same(local,base))return clone(remote);
 if(same(remote,base))return clone(local);
 if(Array.isArray(local)&&Array.isArray(remote)&&Array.isArray(base)){
  const all=[...base,...local,...remote];const ids=all.map(x=>idFor(x,path));
  if(ids.some(x=>x===null)||new Set(ids.slice(0,base.length)).size!==base.length ||
     new Set(local.map(x=>idFor(x,path))).size!==local.length ||
     new Set(remote.map(x=>idFor(x,path))).size!==remote.length)
   throw Error('Conflito no campo '+path+'. Recarrega os dados antes de repetir. O registo local não foi substituído.');
  const maps=[base,local,remote].map(a=>new Map(a.map(x=>[idFor(x,path),x])));
  const order=[...new Set([...remote,...local,...base].map(x=>idFor(x,path)))];
  const combined=[];
  for(const id of order){
   const b=maps[0].has(id)?maps[0].get(id):MISSING;
   const l=maps[1].has(id)?maps[1].get(id):MISSING;
   const r=maps[2].has(id)?maps[2].get(id):MISSING;
   const v=merge(b,l,r,path+'['+id+']');if(v!==MISSING)combined.push(v);
  }
  return combined;
 }
 if(local!==MISSING && remote!==MISSING && local && remote && typeof local==='object'&&typeof remote==='object'&&
    !Array.isArray(local)&&!Array.isArray(remote)&&(!base||typeof base==='object'&&!Array.isArray(base))){
   const obj={};for(const k of new Set([...Object.keys(base&&base!==MISSING?base:{}),...Object.keys(local),...Object.keys(remote)])){
    const b=base&&base!==MISSING&&Object.hasOwn(base,k)?base[k]:MISSING;
    const l=Object.hasOwn(local,k)?local[k]:MISSING;
    const r=Object.hasOwn(remote,k)?remote[k]:MISSING;
    const v=merge(b,l,r,path+'.'+k);if(v!==MISSING)obj[k]=v;
   }return obj;
 }
 if(local===MISSING&&remote===MISSING)return MISSING;
 if(local===MISSING&&base!==MISSING&&!same(base,remote))throw Error('Conflito de eliminação em '+path);
 if(remote===MISSING&&base!==MISSING&&!same(base,local))throw Error('Conflito de eliminação em '+path);
 if(base===MISSING){if(local===MISSING)return clone(remote);if(remote===MISSING)return clone(local);}
 throw Error('O mesmo campo foi alterado em simultâneo ('+path+'). Recarrega antes de guardar.');
}
async function put(key,value){
 if(!shared(key))throw Error('Chave não partilhada.');
 // A lista de colaboradores inteira é uma operação administrativa; não substituir dados silenciosamente.
 if(key===registryKey){
  if(profile?.role!=='admin')throw Error('Apenas administradores podem alterar o registo de lojas e utilizadores.');
  const revision=Number(versions.get(key)||0);
  if(revision){
   const result=await authRequest('/rest/v1/mac_vision_docs?key=eq.'+encode(key)+'&revision=eq.'+revision,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({data:value})});
   if(!result.length)throw Error('A lista de utilizadores foi alterada por outra sessão. Atualiza a página antes de guardar.');
   versions.set(key,Number(result[0].revision));
  }else{
   try{const inserted=await authRequest('/rest/v1/mac_vision_docs',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({key,data:value})});versions.set(key,Number(inserted[0]?.revision||1));}
   catch(e){throw Error('Outro administrador já iniciou a configuração. Recarrega a página antes de guardar: '+e.message);}
  }
  bases.set(key,clone(value));return {data:clone(value),merged:false};
 }
 let base=clone(bases.get(key)),revision=Number(versions.get(key)||0),candidate=clone(value);
 for(let attempt=0;attempt<4;attempt++){
  try{
   if(revision===0){
    const ins=await authRequest('/rest/v1/mac_vision_docs',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({key,data:candidate})});
    setBase(key,ins[0]);return {data:clone(candidate),merged:!same(candidate,value)};
   }
   const updated=await authRequest('/rest/v1/mac_vision_docs?key=eq.'+encode(key)+'&revision=eq.'+revision,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({data:candidate})});
   if(updated.length){setBase(key,updated[0]);return {data:clone(candidate),merged:!same(candidate,value)};}
  }catch(e){if(!/duplicate key|23505|409|unique/i.test(e.message))throw e;}
  // Outro utilizador gravou primeiro: juntar apenas alterações independentes.
  const rows=await authRequest('/rest/v1/mac_vision_docs?key=eq.'+encode(key)+'&select=data,revision&limit=1');
  const latest=rows[0];if(!latest)throw Error('A loja foi eliminada entretanto.');
  candidate=merge(base,value,latest.data);
  revision=Number(latest.revision);
 }
 throw Error('A loja foi alterada muitas vezes durante a gravação. Tenta novamente.');
}
async function remove(key){
 if(!shared(key))throw Error('Chave não partilhada.');
 await authRequest('/rest/v1/mac_vision_docs?key=eq.'+encode(key),{method:'DELETE'});
 versions.delete(key);bases.delete(key);
}
function loadGate(){
 return new Promise((resolve,reject)=>{
  const el=gate();
  if(!hasConfig()){status('A configuração da base de dados está incompleta. Consulta o ficheiro cloud-config.js.');return;}
  const form=document.getElementById('macCloudAuthForm');
  form.addEventListener('submit',async e=>{
   e.preventDefault();const button=document.getElementById('macCloudAuthButton');button.disabled=true;status('');
   try{
    const email=document.getElementById('macCloudEmail').value.trim();
    const password=document.getElementById('macCloudPassword').value;
    const t=await raw('/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    sessionSave(t);await loadProfile();el.remove();resolve();
   }catch(err){sessionSave(null);status('Não foi possível entrar: '+err.message);}finally{button.disabled=false;}
  });
  (async()=>{
   const cached=sessionGet();if(!cached?.access_token)return;
   try{sessionSave(cached);await loadProfile();el.remove();resolve()}catch(e){sessionSave(null);status('A sessão anterior terminou. Entra novamente.');}
  })();
 });
}
async function loadProfile(){
 const user=await authRequest('/auth/v1/user');if(!user?.id)throw Error('Não foi possível validar o utilizador.');
 const p=await authRequest('/rest/v1/mac_vision_profiles?user_id=eq.'+encode(user.id)+'&select=*&limit=1');
 if(!p.length)throw Error('A tua conta ainda não tem autorização MAC Vision. Pede ao administrador para configurar o perfil.');
 profile=p[0];access=await authRequest('/rest/v1/mac_vision_shop_access?user_id=eq.'+encode(user.id)+'&select=shop_id,can_write');
}
async function autoLogin(){
 if(!profile)throw Error('Sem perfil Cloud.');
 const accountId=profile.app_user_id;
 if(!accountId){
  if(profile.role==='admin' && !shopRegistry.some(s=>(s.users||[]).length)){return;}
  if(profile.role==='admin'){
   const matches=shopRegistry.flatMap(st=>(st.users||[]).filter(u=>u.isAreaMaster&&String(u.name||'').trim().toLowerCase()===String(profile.display_name||'').trim().toLowerCase()));
   const unique=[...new Map(matches.map(u=>[u.id,u])).values()];
   if(unique.length===1){await bindIdentity(unique[0].id);return autoLogin();}
  }
  throw Error('O administrador tem de associar esta conta Cloud ao utilizador MAC Vision (app_user_id).');
 }
 const allowed=profile.role==='admin'?shopRegistry:shopRegistry.filter(st=>access.some(a=>a.shop_id===st.id));
 let shop=null,account=null;
 for(const st of allowed){const u=(st.users||[]).find(x=>String(x.id)===String(accountId));
  if(u && (profile.role==='admin' ? u.role==='gestor' : profile.role===u.role)){shop=st;account=u;break;}}
 if(!shop||!account)throw Error('Conta Cloud sem loja ou utilizador MAC Vision associado. Confirma as permissões no Supabase.');
 const mgr={};if(account.role==='gestor')for(const st of allowed){if(st.users.some(u=>u.id===account.id))mgr[st.id]=account.id;}
 await loginToStore(shop,account,mgr,profile.role==='admin'?'administrador':'gestor');
}
async function bindIdentity(id){
 if(profile?.role!=='admin')throw Error('Só um administrador pode associar esta conta.');
 const data=await authRequest('/rest/v1/mac_vision_profiles?user_id=eq.'+encode(profile.user_id),{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({app_user_id:String(id)})});
 if(!data.length)throw Error('Falha ao associar o administrador.');profile=data[0];
}
async function signOut(){
 try{if(tokens?.access_token)await authRequest('/auth/v1/logout',{method:'POST'})}catch(e){console.warn('Logout remoto:',e)}
 sessionSave(null);profile=null;access=[];versions.clear();bases.clear();
 location.reload();
}
async function uploadAttachment(blob,id,shopId){
 if(!(blob instanceof Blob))throw Error('Anexo inválido.');
 const path=encode(shopId)+'/'+encode(id);
 const r=await fetch(endpoint+'/storage/v1/object/mac-vision-attachments/'+path,{method:'POST',headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+tokens.access_token,'Content-Type':blob.type||'application/octet-stream','x-upsert':'true'},body:blob});
 if(!r.ok)throw errorFrom(await r.json().catch(()=>({})),r.status);return {id,status:'stored'};
}
async function downloadAttachment(id,shopId){
 const path=encode(shopId)+'/'+encode(id);
 const r=await fetch(endpoint+'/storage/v1/object/authenticated/mac-vision-attachments/'+path,{headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+tokens.access_token}});
 if(r.status===404)return null;if(!r.ok)throw errorFrom(await r.json().catch(()=>({})),r.status);return await r.blob();
}
async function removeAttachment(id,shopId){
 const path=encode(shopId)+'/'+encode(id);
 const r=await fetch(endpoint+'/storage/v1/object/mac-vision-attachments/'+path,{method:'DELETE',headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+tokens.access_token}});
 if(!r.ok&&r.status!==404)throw errorFrom(await r.json().catch(()=>({})),r.status);
}
window.macCloud={shared,get,put,remove,loadGate,autoLogin,bindIdentity,signOut,uploadAttachment,downloadAttachment,removeAttachment,
 get profile(){return profile},get access(){return access},get session(){return tokens},get lastCloudError(){return lastCloudError}
};
})();
