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
let selectedCloudShop='';
function gate(){
 let el=document.getElementById('macCloudGate');if(el)return el;
 const screen=document.getElementById('authScreen'),card=screen?.querySelector('.auth-card');
 if(!card)throw Error('Ecrã de entrada MAC Vision indisponível.');
 const original=[...card.children].map(node=>({node,hidden:node.hidden}));
 original.forEach(({node})=>node.hidden=true);
 screen.hidden=false;document.body.classList.remove('mac-starting');
 el=document.createElement('div');el.id='macCloudGate';el.className='auth-block';
 el.innerHTML=`
 <div class="auth-header"><div class="brand-mark">MAC</div><div><strong style="font-size:19px">MAC Vision</strong><div class="smalltext muted">Mapa de Acompanhamento Comercial</div></div></div>
 <div><h1 class="auth-title">Bem-vindo</h1><p class="auth-subtitle">Seleciona o acesso, o utilizador e introduz a palavra-passe.</p></div>
 <form id="macCloudAuthForm" class="auth-block" autocomplete="on">
 <div class="auth-step"><label for="macCloudRole">Acesso</label><select id="macCloudRole" required><option value="">Selecionar acesso</option><option value="admin">👑 Administrador</option><option value="gestor">🔐 Gestor</option><option value="colaborador">👤 Colaborador</option></select></div>
 <div class="auth-step"><label for="macCloudName">Utilizador</label><select id="macCloudName" required disabled><option value="">Selecionar utilizador</option></select><button type="button" id="macCloudRetry" class="btn ghost" hidden>Tentar novamente</button></div>
 <div class="auth-step"><label for="macCloudPassword">Password</label><input type="password" id="macCloudPassword" required autocomplete="current-password" placeholder="Introduzir palavra-passe"></div>
 <button type="submit" class="btn primary auth-btn" id="macCloudAuthButton">ENTRAR NO MAC VISION →</button>
 </form>
 <form id="macCloudShopForm" class="auth-block" hidden><div class="auth-step"><label for="macCloudShop">Loja</label><select id="macCloudShop" required></select></div><button type="submit" class="btn primary auth-btn">ENTRAR NO MAC VISION →</button><button type="button" class="btn ghost" id="macCloudBack">Voltar</button></form>
 <p id="macCloudError" class="auth-message" role="alert" aria-live="polite"></p>`;
 card.appendChild(el);
 el.restoreOriginal=()=>{el.remove();original.forEach(({node,hidden})=>node.hidden=hidden);};
 return el;
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
  if(!hasConfig()){status('A configuração da ligação está incompleta.');return;}
  const form=document.getElementById('macCloudAuthForm'),shopForm=document.getElementById('macCloudShopForm');
  const roleInput=document.getElementById('macCloudRole'),nameInput=document.getElementById('macCloudName'),retry=document.getElementById('macCloudRetry'),loginButton=document.getElementById('macCloudAuthButton');
  let listRequest=0;
  function syncLoginButton(){loginButton.disabled=!roleInput.value||nameInput.disabled||!nameInput.value;}
  async function loadUsers(){
    const role=roleInput.value,req=++listRequest;
    nameInput.disabled=true;
    retry.hidden=true;
    status('');
    nameInput.replaceChildren(new Option(role?'A carregar utilizadores…':'Selecionar utilizador',''));
    syncLoginButton();
    if(!role)return;
    try{
      const result=await raw('/functions/v1/mac-vision-login-list',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role})});
      if(req!==listRequest||role!==roleInput.value)return;
      if(!Array.isArray(result?.names))throw Error('Resposta inválida.');
      const names=result.names.filter(n=>typeof n==='string'&&n.trim());
      nameInput.replaceChildren(new Option(names.length?'Selecionar utilizador':'Sem utilizadores registados',''),...names.map(n=>new Option(n,n)));
      nameInput.disabled=!names.length;
    }catch(err){
      if(req!==listRequest||role!==roleInput.value)return;
      nameInput.replaceChildren(new Option('Lista indisponível',''));
      retry.hidden=false;
      status('Não foi possível carregar os utilizadores. '+err.message);
    }finally{if(req===listRequest)syncLoginButton();}
  }
  roleInput.addEventListener('change',()=>{document.getElementById('macCloudPassword').value='';void loadUsers();});
  nameInput.addEventListener('change',()=>{document.getElementById('macCloudPassword').value='';syncLoginButton();});
  retry.addEventListener('click',()=>void loadUsers());
  syncLoginButton();
  const finish=()=>{el.restoreOriginal();resolve();};
  async function chooseShop(){
    // Administradores e gestores entram diretamente; a loja inicial é resolvida em autoLogin.
    if(profile?.role==='admin'||profile?.role==='gestor'){selectedCloudShop='';finish();return;}
    const rows=await authRequest('/rest/v1/mac_vision_directory?select=shop_id,data&order=shop_id.asc');
    const choices=rows.filter(x=>(x.data?.users||[]).some(u=>String(u.id)===String(profile.app_user_id)));
    if(choices.length<2){selectedCloudShop=choices[0]?.shop_id||'';finish();return;}
    const select=document.getElementById('macCloudShop');
    select.replaceChildren(new Option('Selecionar loja',''),...choices.map(x=>new Option(x.data?.name||x.shop_id,x.shop_id)));
    form.hidden=true;shopForm.hidden=false;select.focus();
  }
  shopForm.addEventListener('submit',e=>{e.preventDefault();const shop=document.getElementById('macCloudShop').value;if(!shop)return;selectedCloudShop=shop;finish();});
  document.getElementById('macCloudBack').addEventListener('click',async()=>{try{await authRequest('/auth/v1/logout',{method:'POST'})}catch{}sessionSave(null);profile=null;access=[];selectedCloudShop='';shopForm.hidden=true;form.hidden=false;void loadUsers();});
  form.addEventListener('submit',async e=>{
   e.preventDefault();const button=document.getElementById('macCloudAuthButton');button.disabled=true;status('');
   const pw=document.getElementById('macCloudPassword');
   try{
    const name=document.getElementById('macCloudName').value.trim(),role=document.getElementById('macCloudRole').value;
    const t=await raw('/functions/v1/mac-vision-name-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,role,password:pw.value})});
    sessionSave(t);await loadProfile();await chooseShop();
   }catch(err){sessionSave(null);profile=null;access=[];status('Não foi possível entrar: '+err.message);}finally{pw.value='';syncLoginButton();}
  });
  (async()=>{
   const cached=sessionGet();if(!cached?.access_token)return;
   try{sessionSave(cached);await loadProfile();finish()}catch(e){sessionSave(null);profile=null;access=[];status('A sessão anterior terminou. Entra novamente.');}
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
 for(const st of [...allowed].sort((a,b)=>Number(b.id===selectedCloudShop)-Number(a.id===selectedCloudShop)||String(a.name||'').localeCompare(String(b.name||''),'pt-PT',{sensitivity:'base',numeric:true}))){const u=(st.users||[]).find(x=>String(x.id)===String(accountId));
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
