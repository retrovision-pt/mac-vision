/* MAC Vision | Supabase Auth + REST com revisões e deteção de conflitos.
 * Ficheiro publicável: só contém a chave publishable, nunca segredos administrativos.
 * Todas as autorizações de loja são validadas pelas políticas RLS do PostgreSQL.
 */
(function(){
'use strict';
// Match the existing employee selector typography on the sale form, including its mobile breakpoints.
const saleFontStyle=document.createElement('style');
saleFontStyle.id='mac-sale-uniform-field-font';
saleFontStyle.textContent=`
#page-sales #saleForm :is(#saleKind,#saleLabel,#saleQuantity,#saleCatalogValue,#saleUnitPoints){font-size:16px!important}
@media(max-width:600px){#page-sales #saleForm :is(#saleKind,#saleLabel,#saleQuantity,#saleCatalogValue,#saleUnitPoints){font-size:clamp(13px,3.4vw,16px)!important}}
@media(max-width:560px){#page-sales #saleForm :is(#saleKind,#saleLabel,#saleQuantity,#saleCatalogValue,#saleUnitPoints){font-size:13px!important}}
`;
document.head.appendChild(saleFontStyle);
// Animate only the existing mobile drawer; its fixed header and navigation handlers stay unchanged.
const mobileMotionStyle=document.createElement('style');
mobileMotionStyle.id='mac-mobile-drawer-motion';
mobileMotionStyle.textContent=`
@media(max-width:900px){
 #mainApp .sidebar #macMobileDrawer{
  display:flex!important;opacity:0;visibility:hidden;pointer-events:none!important;
  transform:translateY(12px);transition:transform 260ms cubic-bezier(.22,.8,.25,1),opacity 220ms ease,visibility 0s linear 260ms;
 }
 #mainApp .sidebar.mobile-open #macMobileDrawer{
  opacity:1;visibility:visible;pointer-events:auto!important;transform:translateY(0);
  transition:transform 260ms cubic-bezier(.22,.8,.25,1),opacity 220ms ease,visibility 0s;
 }
 html body #macMobileBackdrop{
  display:block!important;opacity:0;visibility:hidden;pointer-events:none!important;
  transition:opacity 220ms ease,visibility 0s linear 260ms;
 }
 html body #macMobileBackdrop.is-open{
  opacity:1;visibility:visible;pointer-events:auto!important;transition:opacity 220ms ease,visibility 0s;
 }
 #mainApp .sidebar #mobileMenuToggle .mobile-menu-bars i{transition:transform 240ms ease,opacity 180ms ease}
 #mainApp .sidebar #mobileMenuToggle{transition:background-color 180ms ease,transform 120ms ease}
 #mainApp .sidebar #mobileMenuToggle:active{transform:scale(.94)}
 /* Keep the chat launcher out of the open navigation drawer without changing unread state. */
 body:has(#mainApp .sidebar.mobile-open) #macChatBubble{visibility:hidden!important;pointer-events:none!important;opacity:0!important}
 body:has(#mainApp .sidebar.mobile-open) #macChatPanel{visibility:hidden!important;pointer-events:none!important;opacity:0!important}
}
@media(max-width:900px) and (prefers-reduced-motion:reduce){
 #mainApp .sidebar #macMobileDrawer,#mainApp .sidebar.mobile-open #macMobileDrawer,html body #macMobileBackdrop,html body #macMobileBackdrop.is-open,#mainApp .sidebar #mobileMenuToggle,#mainApp .sidebar #mobileMenuToggle .mobile-menu-bars i{transition:none!important;transform:none}
 #mainApp .sidebar.mobile-open #mobileMenuToggle .mobile-menu-bars i:first-child{transform:translateY(6px) rotate(45deg)}
 #mainApp .sidebar.mobile-open #mobileMenuToggle .mobile-menu-bars i:last-child{transform:translateY(-6px) rotate(-45deg)}
}
`;
document.head.appendChild(mobileMotionStyle);
// Match the iPhone safe-area / status-bar background to the fixed green header.
const mobileStatusBarStyle=document.createElement('style');
mobileStatusBarStyle.id='mac-mobile-green-status-bar';
mobileStatusBarStyle.textContent=`
@media(max-width:900px){
 html[data-theme="uni"] body #mainApp:not(.is-locked)>.sidebar::before{
  background:inherit!important;
  box-shadow:none!important;
 }
}
`;
document.head.appendChild(mobileStatusBarStyle);
 // Keep in-app notices below the fixed mobile header, including top-layer popovers.
 const mobileNoticeStyle=document.createElement('style');
 mobileNoticeStyle.id='mac-mobile-safe-notifications';
 mobileNoticeStyle.textContent=`
 @media(max-width:900px){
  html body:has(#mainApp:not(.is-locked)) .toast,
  html body:has(#mainApp:not(.is-locked)) .toast.bad,
  html body:has(#mainApp:not(.is-locked)) .toast[popover],
  html body:has(#mainApp:not(.is-locked)) .toast[popover].show:popover-open{
   top:max(calc(var(--mac-mobile-header-bottom,calc(70px + env(safe-area-inset-top,0px))) + 14px),var(--mac-toast-top,0px))!important;
   bottom:auto!important;
  }
  html body:has(#mainApp:not(.is-locked)) #macChatNudgeNotice{
   top:calc(var(--mac-mobile-header-bottom,calc(70px + env(safe-area-inset-top,0px))) + 14px)!important;
   right:max(12px,env(safe-area-inset-right,0px))!important;
   width:min(330px,calc(100vw - 24px))!important;
   box-sizing:border-box!important;
  }
 }
 `;
 document.head.appendChild(mobileNoticeStyle);
 // Match the mobile browser toolbar and overscroll background to the open drawer.
 const mobileDrawerChromeStyle=document.createElement('style');
 mobileDrawerChromeStyle.id='mac-mobile-drawer-chrome';
 mobileDrawerChromeStyle.textContent=`
 @media(max-width:900px){
  html:has(#mainApp:not(.is-locked) .sidebar.mobile-open),
  html body:has(#mainApp:not(.is-locked) .sidebar.mobile-open){
   background:#292932!important;overscroll-behavior:none;
   overflow:hidden!important;
  }
  #mainApp:not(.is-locked) .sidebar.mobile-open #macMobileDrawer{
   bottom:0!important;max-height:none!important;
   overscroll-behavior:contain;
  }
  #mainApp .sidebar.mobile-open #macMobileDrawer .nav{
   scrollbar-width:none;overscroll-behavior:contain;
  }
  #mainApp .sidebar.mobile-open #macMobileDrawer .nav::-webkit-scrollbar{display:none}
 }
 `;
 document.head.appendChild(mobileDrawerChromeStyle);
 function syncMobileDrawerChrome(){
  const sidebar=document.querySelector('#mainApp .sidebar'),app=document.getElementById('mainApp'),meta=document.querySelector('meta[name="theme-color"]');
  if(!sidebar||!app||!meta)return;
  const mobile=window.matchMedia('(max-width:900px)');
  let previous=null;
  function update(){
   const open=mobile.matches&&!app.classList.contains('is-locked')&&sidebar.classList.contains('mobile-open');
   if(open){
    if(previous===null)previous=meta.content;
    if(meta.content!=='#292932')meta.content='#292932';
   }else if(previous!==null){
    const color=previous;previous=null;meta.content=color;
   }
  }
  const observer=new MutationObserver(update);
  observer.observe(sidebar,{attributes:true,attributeFilter:['class']});
  observer.observe(app,{attributes:true,attributeFilter:['class']});
  if(mobile.addEventListener)mobile.addEventListener('change',update);else mobile.addListener(update);
  update();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncMobileDrawerChrome,{once:true});else syncMobileDrawerChrome();


const cfg=window.MAC_CLOUD_CONFIG||{};
const registryKey='rc-clean-install-20261110-registry-v2';
const AUTH_CACHE='mac-vision-cloud-session-v1';
const NAV_CACHE='mac-vision-cloud-navigation-v1';
let resumeCloudNavigation=false,navTrackingInstalled=false;
const navPages=['dashboard','sales','history','imports','daily','tickets','ios','schedule','config'];
const navSettings=['home','appearance','access','employees','weights','data','language','vision'];
const navAppearance={display:'macAppearanceDisplay',themes:'macAppearanceThemes',fonts:'macAppearanceFonts',audio:'macAppearanceAudio'};
const navAccess={stores:'accessStoresPanel',users:'accessUsersPanel',managers:'accessManagersPanel',admins:'accessAdminsPanel'};
const navData={backup:'dataPanelBackup',audit:'dataPanelAudit',delete:'dataPanelDelete'};
function navVisible(id){const el=document.getElementById(id);return !!el&&!el.hidden&&el.getClientRects().length>0;}
function navSubpanel(map){return Object.keys(map).find(k=>navVisible(map[k]))||'';}
function saveCloudNavigation(){
 if(!tokens||!profile||typeof session==='undefined'||!session||document.getElementById('mainApp')?.classList.contains('is-locked'))return;
 if(!navPages.includes(page))return;
 const view=page==='config'&&navSettings.includes(configView)?configView:'home';
 const sub=view==='appearance'?navSubpanel(navAppearance):view==='access'?navSubpanel(navAccess):view==='data'?navSubpanel(navData):'';
 try{sessionStorage.setItem(NAV_CACHE,JSON.stringify({owner:profile.user_id,role:profile.role,store:String(currentShopId||''),page,view,sub}));}catch{}
}
function readCloudNavigation(){
 if(!resumeCloudNavigation||!profile)return null;
 try{
  const saved=JSON.parse(sessionStorage.getItem(NAV_CACHE)||'null');
  if(saved?.owner===profile.user_id&&saved.role===profile.role&&navPages.includes(saved.page))return saved;
  // Existing installations already record the current page; accept it only for the verified account.
  const old=JSON.parse(localStorage.getItem('rc-clean-install-20261110-remembered-session-v1')||'null');
  if(old?.userId===profile.app_user_id&&old.accessKind===(profile.role==='admin'?'administrador':profile.role)&&navPages.includes(old.page))return {page:old.page,store:old.storeId,view:'home',sub:''};
 }catch{}return null;
}
function restoreCloudNavigation(saved){
 if(!saved||!navPages.includes(saved.page))return;
 const button=document.querySelector('#nav [data-go="'+saved.page+'"]');
 if(saved.page!=='dashboard'&&(!button||button.hidden||button.disabled||getComputedStyle(button).display==='none'))return;
 if(saved.page!==page)go(saved.page);
 if(page!=='config'||saved.page!=='config'||!navSettings.includes(saved.view)||saved.view==='home')return;
 const tile=document.querySelector('#configHome [data-config-target="'+saved.view+'"]');
 if(saved.view==='employees')return; // Nested access-only entry is restored through the normal settings menu.
 if(!tile||tile.hidden||tile.disabled||getComputedStyle(tile).display==='none')return;
 showConfigView(saved.view);
 if(configView!==saved.view)return;
 const map=saved.view==='appearance'?navAppearance:saved.view==='access'?navAccess:saved.view==='data'?navData:null;
 if(!map||!Object.hasOwn(map,saved.sub))return;
 const target=document.querySelector('[data-'+saved.view+'-target="'+saved.sub+'"]');
 if(target&&!target.hidden&&!target.disabled&&getComputedStyle(target).display!=='none')target.click();
}
function installCloudNavigationTracking(){
 if(navTrackingInstalled)return;navTrackingInstalled=true;
 const previous=go;go=function(...args){const result=previous.apply(this,args);saveCloudNavigation();return result;};
 document.addEventListener('click',()=>queueMicrotask(saveCloudNavigation),true);
 window.addEventListener('pagehide',saveCloudNavigation);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)saveCloudNavigation();});
}
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
function beginTransition(message='Loading'){
 document.body.classList.add('mac-cloud-transition');
 let layer=document.getElementById('macCloudTransition');
 if(!layer){
   layer=document.createElement('div');layer.id='macCloudTransition';layer.setAttribute('role','status');layer.setAttribute('aria-live','polite');
   layer.style.cssText='position:fixed;inset:0;z-index:100000;display:grid;place-content:center;justify-items:center;gap:16px;background:var(--bg,#111827);color:var(--text,#e5e7eb);font:inherit;text-align:center;padding:24px';
   const logo=document.createElement('span');logo.className='brand-mark';logo.textContent=window.rcGetLogoMark?.()||'MAC';
   const caption=document.createElement('span');caption.id='macCloudTransitionText';
   const spinner=document.createElement('span');spinner.className='mac-loading-spinner';spinner.setAttribute('aria-hidden','true');
   logo.classList.add('mac-loading-logo');layer.append(logo,spinner,caption);document.body.append(layer);
   const style=document.createElement('style');style.id='macCloudTransitionStyle';style.textContent='body.mac-cloud-transition #authScreen,body.mac-cloud-transition #mainApp{visibility:hidden!important}';document.head.append(style);
 }
 const caption=document.getElementById('macCloudTransitionText');caption.textContent=message;caption.hidden=!message;
 document.getElementById('macCloudTransition').setAttribute('aria-label',message||'A carregar MAC Vision');
}
function endTransition(){
 document.getElementById('macCloudTransition')?.remove();
 document.getElementById('macCloudTransitionStyle')?.remove();
 document.body.classList.remove('mac-cloud-transition');
}

function gate(){
 let el=document.getElementById('macCloudGate');if(el)return el;
 const screen=document.getElementById('authScreen'),card=screen?.querySelector('.auth-card');
 if(!card)throw Error('Ecrã de entrada MAC Vision indisponível.');
 // Reutilizar a estrutura visual original, sem executar o login local.
 const original=[...card.children].map(node=>({node,hidden:node.hidden}));
 const source=id=>{const node=document.getElementById(id);if(!node)throw Error('Elemento original em falta: '+id);return node;};
 const copy=(id,map={})=>{
   const node=source(id).cloneNode(true);
   for(const item of [node,...node.querySelectorAll('[id],[for]')]){
     if(item.id)item.id=map[item.id]||'cloudOriginal-'+item.id;
     if(item.hasAttribute('for')){const target=item.getAttribute('for');item.setAttribute('for',map[target]||'cloudOriginal-'+target);}
   }
   node.hidden=false;return node;
 };
 el=document.createElement('div');el.id='macCloudGate';el.style.display='contents';
 const brand=copy('rcAuthBrand',{rcAuthBrand:'macCloudBrand'});
 const welcome=copy('macSetupWelcomeRow',{macSetupWelcomeRow:'macCloudWelcome',authTitle:'macCloudTitle',authSubtitle:'macCloudSubtitle'});
 welcome.querySelector('.rc-setup-hero-logo')?.setAttribute('hidden','');
 welcome.querySelector('#macCloudTitle').textContent='Bem-vindo';
 welcome.querySelector('#macCloudSubtitle').textContent='Seleciona o acesso, a loja, o colaborador e a password.';
 welcome.querySelector('#macCloudSubtitle').style.cssText='display:block;font-size:13px;color:#6b7280;font-weight:400;';
 const form=copy('loginForm',{loginForm:'macCloudAuthForm',loginRole:'macCloudRole',loginUser:'macCloudName',loginUserPhoto:'macCloudUserPhoto',macLoginStoreField:'macCloudOriginalStoreField',loginStore:'macCloudOriginalStore',loginPassword:'macCloudPassword',rcLoginButton:'macCloudAuthButton'});
 form.setAttribute('autocomplete','on');
 const role=form.querySelector('#macCloudRole');role.querySelector('option[value="administrador"]').value='admin';role.value='';
 const names=form.querySelector('#macCloudName');names.replaceChildren(new Option('Selecionar user',''));names.disabled=true;names.closest('.auth-step').hidden=true;
 const storeField=form.querySelector('#macCloudOriginalStoreField');storeField.hidden=true;const store=form.querySelector('#macCloudOriginalStore');store.required=false;store.disabled=true;names.closest('.auth-step').before(storeField);store.replaceChildren(new Option('Selecionar loja',''));
 const retry=document.createElement('button');retry.type='button';retry.id='macCloudRetry';retry.className='btn ghost';retry.hidden=true;retry.textContent='Tentar novamente';names.closest('.auth-step').after(retry);
 const button=form.querySelector('#macCloudAuthButton');button.textContent='ENTRAR →';button.hidden=true;button.disabled=true;const password=form.querySelector('#macCloudPassword');password.closest('.auth-step').hidden=true;password.disabled=true;
 const shopForm=document.createElement('form');shopForm.id='macCloudShopForm';shopForm.className='auth-block';shopForm.hidden=true;
 shopForm.innerHTML='<div class="auth-step"><label for="macCloudShop">Loja</label><select id="macCloudShop" required></select></div><button type="submit" class="btn primary auth-btn">ENTRAR →</button><button type="button" class="btn ghost" id="macCloudBack">Voltar</button>';
 const error=copy('authError',{authError:'macCloudError'});error.textContent='';
 const block=document.createElement('div');block.className='auth-block';const panel=document.createElement('div');panel.className='auth-block';const recovery=document.createElement('form');recovery.id='macCloudRecovery';recovery.className='auth-block';recovery.hidden=true;recovery.innerHTML='<p class="smalltext muted">Configuração inicial: entra com a conta técnica de recuperação.</p><div class="auth-step"><label for="macCloudRecoveryEmail">Email</label><input id="macCloudRecoveryEmail" type="email" autocomplete="username" required></div><div class="auth-step"><label for="macCloudRecoveryPassword">Palavra-passe</label><input id="macCloudRecoveryPassword" type="password" autocomplete="current-password" required></div><button class="btn primary auth-btn" type="submit">CONFIGURAR MAC VISION →</button>';panel.append(form,shopForm,recovery);block.append(panel,error);
 el.append(brand,welcome,block);
 const css=document.createElement('style');css.textContent='#authScreen.mac-cloud-login-active .auth-card > :not(#macCloudGate){display:none!important}#authScreen.mac-cloud-login-active .auth-card{width:min(540px,100%);max-width:540px}#macCloudWelcome .mac-setup-welcome-copy{flex:1 1 auto;min-width:0}#macCloudTitle{margin:0 0 5px;line-height:1.18}#macCloudSubtitle{margin:0;line-height:1.42}#macCloudAuthForm .auth-step[hidden],#macCloudAuthForm button[hidden],#macCloudUserPhoto[hidden],#macCloudOriginalStoreField[hidden],#macCloudRetry[hidden],#macCloudAuthForm[hidden],#macCloudRecovery[hidden],#macCloudShopForm[hidden],#macCloudWelcome .rc-setup-hero-logo[hidden]{display:none!important}#macCloudAuthForm .auth-step>select,#macCloudAuthForm .auth-step>input,#macCloudShopForm .auth-step>select,#macCloudRecovery .auth-step>input{font-size:14px!important;color:#6b7280!important;-webkit-text-fill-color:#6b7280!important;font-weight:400!important}#macCloudAuthForm .auth-step>input::placeholder,#macCloudRecovery .auth-step>input::placeholder{color:#6b7280!important;-webkit-text-fill-color:#6b7280!important;opacity:1}#macCloudAuthForm .auth-step>select option,#macCloudShopForm .auth-step>select option{color:#6b7280;font-size:14px}';
 document.head.append(css);
 original.forEach(({node})=>node.hidden=true);
 screen.classList.add('mac-cloud-login-active');screen.hidden=false;document.body.classList.remove('mac-starting');
 card.appendChild(el);
 for(const node of el.querySelectorAll('.brand-mark'))node.textContent=window.rcGetLogoMark?.()||node.textContent;
 el.restoreOriginal=()=>{el.remove();css.remove();screen.classList.remove('mac-cloud-login-active');original.forEach(({node,hidden})=>node.hidden=hidden);};
 return el;
}
function status(text){const x=document.getElementById('macCloudError');if(x)x.textContent=text||'';lastCloudError=text||'';}
function sessionGet(){try{return JSON.parse(sessionStorage.getItem(AUTH_CACHE)||'null')}catch{return null}}
function sessionSave(t){tokens=t;try{if(t)sessionStorage.setItem(AUTH_CACHE,JSON.stringify(t));else {sessionStorage.removeItem(AUTH_CACHE);sessionStorage.removeItem(NAV_CACHE)}}catch{}}
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
// Read shared branding from the authorized directory without altering registry revision state.
async function readBrand(){
 const rows=await authRequest('/rest/v1/mac_vision_directory?select=data&order=shop_id.asc');
 return rows.map(row=>row.data?.rcSharedBrand).filter(x=>x&&/^[A-Z0-9]{2,6}$/.test(x.mark||'')).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0))[0]||null;
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
// Store-manager removals are explicit server operations, not inferred from a cached registry diff.
const originalRemoveUser=removeUser;
const managerRemovalBusy=new Set();
removeUser=async function(id,shopId=viewedAccessShop()?.id){
 if(!tokens||profile?.role!=='gestor')return originalRemoveUser.apply(this,arguments);
 if(session?.role!=='gestor'||!shopId||!macCanAdministerStore(shopId))throw Error('Não tens acesso a esta loja.');
 const shop=shopRegistry.find(st=>String(st.id)===String(shopId));
 const user=shop?.users?.find(u=>String(u.id)===String(id));
 if(!user)throw Error('O utilizador já não está nesta loja. Atualiza a lista.');
 if(user.role!=='colaborador'||user.isAreaMaster||user.adminOnly||String(user.id)===String(session.id))throw Error('Só podes remover colaboradores da tua loja.');
 const key=String(shopId)+'|'+String(id);
 if(managerRemovalBusy.has(key))return;
 if(!confirm('Remover o acesso de '+user.name+' à loja '+shop.name+'? O histórico de vendas será mantido.'))return;
 managerRemovalBusy.add(key);
 try{
  const response=await authRequest('/functions/v1/mac-vision-add-collaborator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'remove',shopId:String(shopId),userId:String(id)})});
  if(!response?.ok)throw Error('Não foi possível remover o colaborador.');
  // Only mutate the local view after the server confirms success.
  shop.users=shop.users.filter(u=>String(u.id)!==String(id));
  const before=bases.get(registryKey);
  if(Array.isArray(before)){
   const prior=before.find(st=>String(st.id)===String(shopId));
   if(prior)prior.users=(prior.users||[]).filter(u=>String(u.id)!==String(id));
  }
  try{const fresh=await get(registryKey);if(Array.isArray(fresh))shopRegistry=fresh;}catch(e){console.warn('A lista será sincronizada na próxima atualização.',e.message);}
  signalMacLocalChange('registry','');renderAccess();renderOptions();
  toast('Colaborador removido da loja.');
 }finally{managerRemovalBusy.delete(key);}
};
async function put(key,value){
 if(!shared(key))throw Error('Chave não partilhada.');
 // A lista de colaboradores inteira é uma operação administrativa; não substituir dados silenciosamente.
 if(key===registryKey){
  if(profile?.role==='gestor'){
   const before=bases.get(key);
   if(!Array.isArray(before)||!Array.isArray(value))throw Error('Atualiza a lista de utilizadores antes de guardar.');
   const changes=[];
   for(const shop of value){
    const prior=before.find(st=>st.id===shop.id);
    if(!prior)throw Error('Apenas administradores podem criar lojas.');
    for(const u of shop.users||[]){
     if(!(prior.users||[]).some(p=>p.id===u.id)){
      if(u.role!=='colaborador')throw Error('Apenas administradores podem criar gestores.');
      changes.push({action:'add',shopId:shop.id,user:u});
     }
    }
    for(const u of prior.users||[]){
     if(!(shop.users||[]).some(p=>p.id===u.id)){
      if(u.role!=='colaborador'||u.isAreaMaster||u.adminOnly)throw Error('Apenas podes eliminar colaboradores das tuas lojas.');
      changes.push({action:'remove',shopId:shop.id,userId:u.id});
     }
    }
   }
   if(changes.length!==1)throw Error('Os gestores podem adicionar ou eliminar um colaborador de cada vez.');
   try{
    await authRequest('/functions/v1/mac-vision-add-collaborator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(changes[0])});
   }catch(e){
    // Restore the authoritative directory after a rejected mutation.
    try{const latest=await get(key);if(Array.isArray(latest)){shopRegistry=latest;renderAccess();renderOptions();}}catch{}
    throw e;
   }
   const fresh=await get(key);
   return {data:fresh,merged:!same(fresh,value)};
  }
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
  const storeInput=document.getElementById('macCloudOriginalStore'),storeField=document.getElementById('macCloudOriginalStoreField'),userLabel=form.querySelector('label[for="macCloudName"]');
  const passwordInput=document.getElementById('macCloudPassword'),passwordField=passwordInput.closest('.auth-step'),userField=nameInput.closest('.auth-step');
  const collaborator=()=>roleInput.value==='colaborador';
  let listRequest=0,photoRequest=0;
  const photoBox=document.getElementById('macCloudUserPhoto');
  photoBox.style.cssText='margin-top:17px;display:flex;justify-content:center;align-items:center;gap:12px;text-align:left;min-width:0';
  function clearUserPreview(){
    photoRequest++;
    photoBox.replaceChildren();
    photoBox.hidden=true;
    photoBox.style.display='none';
  }
  function drawUserPreview(name,cargo,photo){
    photoBox.replaceChildren();
    photoBox.hidden=false;
    photoBox.style.display='flex';
    const avatar=document.createElement('span');
    avatar.className='employee-avatar login';
    avatar.setAttribute('aria-label','Fotografia de '+name);
    const pieces=name.trim().split(/\s+/).filter(Boolean);
    const initials=((pieces[0]?.[0]||'')+(pieces.length>1?pieces[pieces.length-1][0]:'' )).toUpperCase();
    if(typeof photo==='string'&&photo.length<220000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo)){
      const img=document.createElement('img');
      img.alt='';img.src=photo;
      img.addEventListener('error',()=>{avatar.textContent=initials;},{once:true});
      avatar.append(img);
    }else avatar.textContent=initials;
    const info=document.createElement('div');
    info.style.cssText='min-width:0;display:flex;flex-direction:column;gap:2px;line-height:1.25';
    const title=document.createElement('strong');
    title.style.cssText='font-size:15px;overflow-wrap:anywhere';
    title.textContent=name;
    const sub=document.createElement('span');
    sub.className='photo-hint';sub.style.fontSize='12px';sub.textContent=cargo;
    info.append(title,sub);photoBox.append(avatar,info);
  }
  async function loadUserPreview(){
    clearUserPreview();
    const req=photoRequest,name=nameInput.value,role=roleInput.value,shopId=collaborator()?storeInput.value:undefined;
    if(!name||!role)return;
    const fallback=role==='admin'?'Administrador':role==='gestor'?'Gestor de Loja':'Colaborador';
    drawUserPreview(name,fallback,'');
    try{
      const result=await raw('/functions/v1/mac-vision-login-list',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,name,...(shopId?{shopId}:{})})});
      if(req!==photoRequest||name!==nameInput.value||role!==roleInput.value||(shopId!==undefined&&shopId!==storeInput.value))return;
      const p=result?.profile;
      if(p&&typeof p.name==='string')drawUserPreview(p.name,typeof p.cargo==='string'&&p.cargo?p.cargo:fallback,p.photo);
    }catch(e){console.warn('Pré-visualização do perfil indisponível.');}
  }
  clearUserPreview();
  function syncLoginButton(){
    const showStore=collaborator();
    const showUser=!!roleInput.value&&(!showStore||!!storeInput.value);
    const showPassword=showUser&&!nameInput.disabled&&!!nameInput.value;
    storeField.hidden=!showStore;userField.hidden=!showUser;
    passwordField.hidden=!showPassword;passwordInput.disabled=!showPassword;
    loginButton.hidden=!showPassword;loginButton.disabled=!showPassword;
    if(!showPassword)passwordInput.value='';
  }
  function resetNames(label){
    clearUserPreview();nameInput.disabled=true;nameInput.replaceChildren(new Option(label,''));syncLoginButton();
  }
  async function loadShops(){
    const req=++listRequest;retry.hidden=true;status('');
    resetNames('Selecionar primeiro a loja');
    storeInput.disabled=true;storeInput.replaceChildren(new Option('A carregar lojas…',''));
    try{
      const result=await raw('/functions/v1/mac-vision-login-list',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'colaborador'})});
      if(req!==listRequest||!collaborator())return;
      if(!Array.isArray(result?.shops))throw Error('Lista de lojas indisponível.');
      const shops=result.shops.filter(x=>typeof x?.id==='string'&&x.id&&typeof x.name==='string'&&x.name.trim()).sort((a,b)=>Number(/^P-/i.test(b.name.trim()))-Number(/^P-/i.test(a.name.trim()))||a.name.trim().localeCompare(b.name.trim(),'pt-PT',{sensitivity:'base',numeric:true}));
      storeInput.replaceChildren(new Option(shops.length?'Selecionar loja':'Sem lojas registadas',''),...shops.map(x=>new Option(x.name,x.id)));
      storeInput.disabled=!shops.length;
    }catch(err){
      if(req!==listRequest||!collaborator())return;
      storeInput.replaceChildren(new Option('Lista de lojas indisponível',''));
      retry.hidden=false;status('Não foi possível carregar as lojas. '+err.message);
    }finally{if(req===listRequest)syncLoginButton();}
  }
  async function loadUsers(){
    const role=roleInput.value,shopId=collaborator()?storeInput.value:undefined,req=++listRequest;
    document.getElementById('macCloudRecovery').hidden=true;
    retry.hidden=true;status('');
    resetNames(!role?'Selecionar utilizador':collaborator()&&!shopId?'Selecionar primeiro a loja':'A carregar utilizadores…');
    if(!role||(collaborator()&&!shopId))return;
    try{
      const result=await raw('/functions/v1/mac-vision-login-list',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,...(shopId?{shopId}:{})})});
      if(req!==listRequest||role!==roleInput.value||(shopId!==undefined&&shopId!==storeInput.value))return;
      if(!Array.isArray(result?.names))throw Error('Resposta inválida.');
      const names=result.names.filter(n=>typeof n==='string'&&n.trim());
      nameInput.replaceChildren(new Option(names.length?(collaborator()?'Selecionar colaborador':'Selecionar utilizador'):(collaborator()?'Sem colaboradores nesta loja':'Sem utilizadores registados'),''),...names.map(n=>new Option(n,n)));
      nameInput.disabled=!names.length;
      document.getElementById('macCloudRecovery').hidden=role!=='admin'||names.length>0;
    }catch(err){
      if(req!==listRequest||role!==roleInput.value)return;
      nameInput.replaceChildren(new Option('Lista indisponível',''));
      retry.hidden=false;status('Não foi possível carregar os utilizadores. '+err.message);
    }finally{if(req===listRequest)syncLoginButton();}
  }
  function changeRole(){
    passwordInput.value='';storeField.hidden=!collaborator();storeInput.required=collaborator();
    storeInput.disabled=true;storeInput.replaceChildren(new Option('Selecionar loja',''));
    if(userLabel)userLabel.textContent=collaborator()?'Colaborador':'User';
    document.getElementById('macCloudRecovery').hidden=true;
    if(collaborator())void loadShops();else void loadUsers();
  }
  roleInput.addEventListener('change',changeRole);
  storeInput.addEventListener('change',()=>{passwordInput.value='';void loadUsers();});
  nameInput.addEventListener('change',()=>{passwordInput.value='';status('');void loadUserPreview();syncLoginButton();});
  retry.addEventListener('click',()=>{if(collaborator()&&storeInput.disabled)void loadShops();else void loadUsers();});
  syncLoginButton();
  const finish=()=>{beginTransition('');el.restoreOriginal();resolve();};
  document.getElementById('macCloudRecovery').addEventListener('submit',async e=>{
   e.preventDefault();const button=e.currentTarget.querySelector('button'),pw=document.getElementById('macCloudRecoveryPassword');button.disabled=true;status('');
   try{const t=await raw('/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('macCloudRecoveryEmail').value.trim(),password:pw.value})});sessionSave(t);await loadProfile();if(profile?.role!=='admin'||profile.app_user_id)throw Error('Conta sem autorização de configuração inicial.');const rows=await authRequest('/rest/v1/mac_vision_directory?select=shop_id&limit=1');if(rows.length)throw Error('A aplicação já está configurada.');finish();}catch(e){sessionSave(null);profile=null;access=[];status('Não foi possível recuperar a configuração: '+e.message);}finally{pw.value='';button.disabled=false;}
  });
  async function chooseShop(requestedShop=''){
    // Administradores e gestores entram diretamente; a loja inicial é resolvida em autoLogin.
    if(profile?.role==='admin'||profile?.role==='gestor'){selectedCloudShop='';finish();return;}
    const rows=await authRequest('/rest/v1/mac_vision_directory?select=shop_id,data&order=shop_id.asc');
    const choices=rows.filter(x=>(x.data?.users||[]).some(u=>String(u.id)===String(profile.app_user_id)));
    if(requestedShop){if(!choices.some(x=>x.shop_id===requestedShop)||!access.some(a=>a.shop_id===requestedShop))throw Error('O colaborador não está autorizado a entrar nesta loja.');selectedCloudShop=requestedShop;finish();return;}
    if(choices.length<2){selectedCloudShop=choices[0]?.shop_id||'';finish();return;}
    const select=document.getElementById('macCloudShop');
    select.replaceChildren(new Option('Selecionar loja',''),...choices.map(x=>new Option(x.data?.name||x.shop_id,x.shop_id)));
    form.hidden=true;shopForm.hidden=false;select.focus();
  }
  shopForm.addEventListener('submit',e=>{e.preventDefault();const shop=document.getElementById('macCloudShop').value;if(!shop)return;selectedCloudShop=shop;finish();});
  document.getElementById('macCloudBack').addEventListener('click',async()=>{try{await authRequest('/auth/v1/logout',{method:'POST'})}catch{}sessionSave(null);profile=null;access=[];selectedCloudShop='';shopForm.hidden=true;form.hidden=false;changeRole();});
  form.addEventListener('submit',async e=>{
   e.preventDefault();const button=document.getElementById('macCloudAuthButton');if(button.disabled||button.hidden)return;button.disabled=true;status('');
   const pw=document.getElementById('macCloudPassword');
   try{
    const name=document.getElementById('macCloudName').value.trim(),role=document.getElementById('macCloudRole').value;
    const shopId=role==='colaborador'?storeInput.value:undefined;
    if(role==='colaborador'&&!shopId)throw Error('Seleciona a loja.');
    const t=await raw('/functions/v1/mac-vision-name-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,role,password:pw.value,...(shopId?{shopId}:{})})});
    sessionSave(t);await loadProfile();await chooseShop(shopId);
   }catch(err){sessionSave(null);profile=null;access=[];status('Não foi possível entrar: '+err.message);}finally{pw.value='';syncLoginButton();}
  });
  (async()=>{
   const cached=sessionGet();if(!cached?.access_token)return;
   beginTransition('');
   try{sessionSave(cached);await loadProfile();resumeCloudNavigation=true;finish()}catch(e){sessionSave(null);profile=null;access=[];status('A sessão anterior terminou. Entra novamente.');endTransition();}
  })();
 });
}
async function loadProfile(){
 const user=await authRequest('/auth/v1/user');if(!user?.id)throw Error('Não foi possível validar o utilizador.');
 const p=await authRequest('/rest/v1/mac_vision_profiles?user_id=eq.'+encode(user.id)+'&select=*&limit=1');
 if(!p.length)throw Error('A tua conta ainda não tem autorização MAC Vision. Pede ao administrador para configurar o perfil.');
 profile=p[0];access=await authRequest('/rest/v1/mac_vision_shop_access?user_id=eq.'+encode(user.id)+'&select=shop_id,can_write');
}
// New employee accounts carry an onboarding marker; existing accounts are unchanged.
const createAccountBeforeWelcome=makeUser;
makeUser=async function(...args){
 const account=await createAccountBeforeWelcome.apply(this,args);
 if(account?.role==='colaborador')account.macWelcomePending=true;
 return account;
};
async function welcomeRequest(action,fields={}){
 return authRequest('/functions/v1/mac-vision-welcome',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...fields})});
}
async function showFirstEmployeeWelcome(){
 if(profile?.role!=='colaborador'||!session||document.getElementById('macEmployeeWelcome'))return;
 const owner=profile.user_id;
 const result=await welcomeRequest('status');
 if(!result?.pending||profile?.user_id!==owner||!session)return;
 const dialog=document.createElement('dialog');dialog.id='macEmployeeWelcome';dialog.lang='pt-PT';dialog.setAttribute('aria-labelledby','macEmployeeWelcomeTitle');
 const style=document.createElement('style');
 style.textContent=`
 #macEmployeeWelcome{width:min(450px,calc(100vw - 28px));max-height:calc(100dvh - 36px);overflow:auto;box-sizing:border-box;border:1px solid var(--border);border-radius:22px;padding:24px;background:var(--surface);color:var(--text);box-shadow:0 25px 80px #0006;text-align:center}
 #macEmployeeWelcome::backdrop{background:rgba(10,15,23,.54);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
 #macEmployeeWelcome .welcome-mark{display:grid;place-items:center;width:64px;height:64px;margin:0 auto 15px;border-radius:19px;background:#bad80a;color:#202510;font-weight:900;font-size:21px}
 #macEmployeeWelcome h2{font-size:23px;line-height:1.2;margin:0 0 9px}
 #macEmployeeWelcome p{font-size:14px;line-height:1.55;margin:0 0 14px;color:var(--muted)}
 #macEmployeeWelcome .welcome-motivation{background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:16px;margin:16px 0;text-align:justify;text-justify:inter-word;box-sizing:border-box;max-width:100%;overflow-wrap:break-word;hyphens:auto}
 #macEmployeeWelcome .welcome-motivation strong{display:block;margin-bottom:7px;font-size:15px;color:var(--text)}
 #macEmployeeWelcome .welcome-motivation p{margin:0;text-align:justify;text-justify:inter-word;line-height:1.6;hyphens:auto;overflow-wrap:break-word}
 #macEmployeeWelcome .welcome-actions{display:grid;gap:9px;margin-top:17px}
 #macEmployeeWelcome .welcome-actions button{width:100%;min-height:43px;white-space:normal}
 #macEmployeeWelcome .field{text-align:left;margin:12px 0}
 #macEmployeeWelcome .field input{width:100%;box-sizing:border-box}
 #macEmployeeWelcome [hidden]{display:none!important}
 #macEmployeeWelcomeError{color:var(--red)!important;font-size:12px!important;margin:10px 0!important;min-height:0}
 @media(prefers-reduced-motion:no-preference){#macEmployeeWelcome[open]{animation:macEmployeeWelcomeEnter .24s ease-out}@keyframes macEmployeeWelcomeEnter{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}}
 `;
 dialog.innerHTML='<div class="welcome-mark" aria-hidden="true">MAC</div><h2 id="macEmployeeWelcomeTitle"></h2><div id="macWelcomeIntro"><div class="welcome-motivation"><strong>🚀 Cada atendimento é uma oportunidade!</strong><p>Escuta o cliente, identifica as suas necessidades e apresenta a melhor solução. Trabalha com foco, confiança e ambição. Cada venda conta e cada conquista aproxima-te dos teus objetivos. Vamos fazer acontecer!</p></div><p>Personaliza a tua password para começares esta nova etapa com segurança.</p><div class="welcome-actions"><button type="button" class="btn primary" id="macWelcomeChange">🔑 Alterar password</button></div></div><form id="macWelcomePasswordForm" hidden autocomplete="off"><div class="field"><label for="macWelcomeCurrent">Password atual</label><input id="macWelcomeCurrent" type="password" required autocomplete="current-password" inputmode="numeric" value="1234"></div><div class="field"><label for="macWelcomeNew">Nova password</label><input id="macWelcomeNew" type="password" required minlength="4" maxlength="64" pattern="[0-9]{4,64}" inputmode="numeric" autocomplete="new-password" placeholder="Mínimo 4 números"></div><div class="field"><label for="macWelcomeConfirm">Confirmar nova password</label><input id="macWelcomeConfirm" type="password" required minlength="4" maxlength="64" pattern="[0-9]{4,64}" inputmode="numeric" autocomplete="new-password"></div><div class="welcome-actions"><button type="submit" class="btn primary">Começar a vender →</button><button type="button" class="btn ghost" id="macWelcomeBack">Voltar</button></div></form><p id="macEmployeeWelcomeError" role="alert"></p>';
 const E=id=>dialog.querySelector('#'+id);
 E('macEmployeeWelcomeTitle').textContent='Bem-vindo, '+String(session.name||session.employee||'')+'!';
 const mark=dialog.querySelector('.welcome-mark');mark.textContent=window.rcGetLogoMark?.()||'MAC';
 let busy=false;
 const form=E('macWelcomePasswordForm'),intro=E('macWelcomeIntro'),error=E('macEmployeeWelcomeError');
 function showForm(on){intro.hidden=on;form.hidden=!on;error.textContent='';if(!on)form.reset();else E('macWelcomeCurrent').focus();}
 function closeWelcome(){form.reset();dialog.close();dialog.remove();style.remove();}
 async function complete(action,fields={}){
  if(busy)return;busy=true;error.textContent='';
  const buttons=[...dialog.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{
   const response=await welcomeRequest(action,fields);
   if(!response?.ok)throw Error('Não foi possível guardar. Tenta novamente.');
   if(profile?.user_id!==owner)return;
   for(const shop of shopRegistry)for(const u of shop.users||[])if(String(u.id)===String(session.id)&&u.role==='colaborador'){u.macWelcomePending=false;}
   closeWelcome();if(response.changed&&typeof toast==='function')toast('Password alterada com sucesso.');
  }catch(e){error.textContent=e.message||'Não foi possível guardar. Tenta novamente.';}
  finally{busy=false;buttons.forEach(b=>b.disabled=false);}
 }
 E('macWelcomeChange').addEventListener('click',()=>showForm(true));
 E('macWelcomeBack').addEventListener('click',()=>showForm(false));
 form.addEventListener('submit',e=>{
  e.preventDefault();const currentPassword=E('macWelcomeCurrent').value,newPassword=E('macWelcomeNew').value;
  if(newPassword!==E('macWelcomeConfirm').value){error.textContent='As passwords não coincidem.';return;}
  if(currentPassword===newPassword){error.textContent='Escolhe uma password diferente da atual.';return;}
  void complete('password',{currentPassword,newPassword});
 });
 dialog.addEventListener('cancel',e=>e.preventDefault());
 document.head.append(style);document.body.append(dialog);dialog.showModal();
}
async function autoLogin(){
 if(!profile)throw Error('Sem perfil Cloud.');
 const accountId=profile.app_user_id;
 if(!accountId){
  if(profile.role==='admin' && !shopRegistry.some(s=>(s.users||[]).length)){endTransition();return;}
  if(profile.role==='admin'){
   const matches=shopRegistry.flatMap(st=>(st.users||[]).filter(u=>u.isAreaMaster&&String(u.name||'').trim().toLowerCase()===String(profile.display_name||'').trim().toLowerCase()));
   const unique=[...new Map(matches.map(u=>[u.id,u])).values()];
   if(unique.length===1){await bindIdentity(unique[0].id);return autoLogin();}
  }
  throw Error('O administrador tem de associar esta conta Cloud ao utilizador MAC Vision (app_user_id).');
 }
 const allowed=profile.role==='admin'?shopRegistry:shopRegistry.filter(st=>access.some(a=>a.shop_id===st.id));
 const savedNavigation=readCloudNavigation();
 if(savedNavigation?.store&&allowed.some(st=>st.id===savedNavigation.store&&(st.users||[]).some(u=>String(u.id)===String(accountId))))selectedCloudShop=savedNavigation.store;
 let shop=null,account=null;
 for(const st of [...allowed].sort((a,b)=>Number(b.id===selectedCloudShop)-Number(a.id===selectedCloudShop)||String(a.name||'').localeCompare(String(b.name||''),'pt-PT',{sensitivity:'base',numeric:true}))){const u=(st.users||[]).find(x=>String(x.id)===String(accountId));
  if(u && (profile.role==='admin' ? u.role==='gestor' : profile.role===u.role)){shop=st;account=u;break;}}
 if(!shop||!account)throw Error('Conta Cloud sem loja ou utilizador MAC Vision associado. Confirma as permissões no Supabase.');
 const mgr={};if(account.role==='gestor')for(const st of allowed){if(st.users.some(u=>u.id===account.id))mgr[st.id]=account.id;}
 await loginToStore(shop,account,mgr,profile.role==='admin'?'administrador':'gestor');
 try{restoreCloudNavigation(savedNavigation);}catch(e){console.warn('Não foi possível recuperar a página anterior.',e);}
 resumeCloudNavigation=false;installCloudNavigationTracking();saveCloudNavigation();
 endTransition();
 if(profile?.role==='colaborador')void showFirstEmployeeWelcome().catch(e=>console.warn('Boas-vindas indisponíveis.',e.message));
}
async function bindIdentity(id){
 if(profile?.role!=='admin')throw Error('Só um administrador pode associar esta conta.');
 const data=await authRequest('/rest/v1/mac_vision_profiles?user_id=eq.'+encode(profile.user_id),{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({app_user_id:String(id)})});
 if(!data.length)throw Error('Falha ao associar o administrador.');profile=data[0];
}
async function factoryReset(confirmation){
 if(profile?.role!=='admin')throw Error('Apenas um administrador pode repor a aplicação.');
 const result=await authRequest('/functions/v1/mac-vision-factory-reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation})});
 if(!result?.reset)throw Error('A reposição da Cloud não foi confirmada.');
 versions.clear();bases.clear();access=[];selectedCloudShop='';if(profile)profile={...profile,app_user_id:null};return result;
}
async function signOut(){
 beginTransition('A terminar sessão…');
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
// Native notification display for incoming Cloud chat messages while the page is running.
const notificationBase=new URL('../',document.currentScript?.src||location.href);
let notificationRegistration=null,notificationOwner='',notificationMembers=[],notificationSeen=new Set(),notificationBaselined=false;
const notificationSupported=()=>window.isSecureContext&&'serviceWorker' in navigator&&'Notification' in window;
const notificationKey=()=>notificationOwner?'mac-chat-native-notifications:'+notificationOwner:'';
function nativeEnabled(){try{return !!notificationKey()&&localStorage.getItem(notificationKey())==='1';}catch{return false}}
function nativePreference(on){try{if(notificationKey())localStorage.setItem(notificationKey(),on?'1':'0');}catch{}}
function syncNativeButton(){
 for(const b of document.querySelectorAll('[data-mac-native-notifications]')){
  const on=notificationSupported()&&Notification.permission==='granted'&&nativeEnabled();
  b.checked=on;
 }
}
function notificationFeedback(message){if(typeof toast==='function')toast(message);else alert(message);}
async function nativeRegistration(){
 if(!notificationSupported())throw Error('Notificações indisponíveis neste navegador.');
 if(!notificationRegistration)notificationRegistration=navigator.serviceWorker.register(new URL('mac-notifications-sw.js',notificationBase),{scope:notificationBase.href}).then(()=>navigator.serviceWorker.ready).catch(e=>{notificationRegistration=null;throw e;});
 return notificationRegistration;
}
function installNativeNotificationControls(){
 if(!document.querySelector('link[rel="manifest"]')){
  const link=document.createElement('link');link.rel='manifest';link.href=new URL('mac-notifications.webmanifest',notificationBase).href;document.head.append(link);
 }
 if(!document.querySelector('link[rel="apple-touch-icon"]')){
  const link=document.createElement('link');link.rel='apple-touch-icon';link.href=new URL('public/apple-touch-icon.png',notificationBase).href;document.head.append(link);
 }
 if(notificationSupported())void nativeRegistration().catch(()=>{});
 const audioRow=document.querySelector('[data-mac-audio="chatNotify"]')?.closest('.mac-switch-row');
 if(audioRow&&!document.querySelector('[data-mac-native-notifications]')){
  const row=document.createElement('label');row.className='mac-switch-row';
  const description=document.createElement('span');description.innerHTML='<strong>Notificações do dispositivo</strong><small>Receber avisos do Chat Vision na central de notificações do iPhone ou Android</small>';
  const button=document.createElement('input');button.type='checkbox';button.dataset.macNativeNotifications='1';button.setAttribute('aria-label','Notificações do dispositivo');
  button.addEventListener('change',async()=>{
   if(!notificationOwner){syncNativeButton();notificationFeedback('Inicia sessão e aguarda a ligação ao Chat Vision.');return;}
   if(!button.checked){nativePreference(false);syncNativeButton();return;}
   if(!notificationSupported()){syncNativeButton();notificationFeedback('No iPhone, adiciona o MAC Vision ao ecrã principal pelo Safari e abre-o a partir do ícone. No Android, utiliza o Chrome.');return;}
   const owner=notificationOwner;button.disabled=true;
   try{
    // Call the permission prompt directly from the click, before waiting on registration.
    const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
    if(permission!=='granted'){notificationFeedback('Autoriza as notificações nas definições do dispositivo ou do navegador.');return;}
    const reg=await nativeRegistration();if(owner!==notificationOwner||!tokens)return;nativePreference(true);syncNativeButton();
    await reg.showNotification('MAC Vision · Chat Vision',{body:'Notificações do dispositivo ativadas.',icon:new URL('public/apple-touch-icon.png',notificationBase).href,tag:'mac-chat-notification-test'});
   }catch(e){if(owner===notificationOwner)nativePreference(false);notificationFeedback('Não foi possível ativar as notificações. '+e.message);}finally{button.disabled=false;syncNativeButton();}
  });
  row.append(description,button);audioRow.after(row);
 }
 syncNativeButton();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installNativeNotificationControls,{once:true});else installNativeNotificationControls();
function observeNativeChat(action,args,result){
 if(!tokens||!profile)return;
 if(action==='hello'){
  const owner=String(result?.user?.id||'');
  if(owner!==notificationOwner){notificationOwner=owner;notificationSeen.clear();notificationBaselined=false;}
  notificationMembers=Array.isArray(result?.members)?result.members:[];syncNativeButton();
  return;
 }
 if(action!=='load'||!notificationOwner||!Array.isArray(result?.messages))return;
 if(Array.isArray(result.members))notificationMembers=result.members;
 const read=new Set(result.readIds||[]),memberships=new Set(notificationMembers.filter(m=>String(m.user_id)===notificationOwner&&m.active!==false).map(m=>String(m.store_id)));
 const incoming=result.messages.filter(m=>m.id!=null&&!m.deleted_at&&String(m.sender_id)!==notificationOwner&&!read.has(m.id)&&!notificationSeen.has(m.id)&&(String(m.recipient_id)===notificationOwner||m.recipient_id==null&&memberships.has(String(m.store_id))));
 for(const m of result.messages)notificationSeen.add(m.id);
 if(notificationSeen.size>4000)notificationSeen=new Set(result.messages.map(m=>m.id));
 if(!notificationBaselined){notificationBaselined=true;return;}
 if(!incoming.length||!notificationSupported()||Notification.permission!=='granted'||!nativeEnabled())return;
 const ownMember=notificationMembers.find(m=>String(m.user_id)===notificationOwner&&String(m.store_id)===String(args.storeId));
 if(result.settings?.[args.storeId]===false&&ownMember?.role==='colaborador')return;
 const chatPanel=document.getElementById('macChatPanel');
 if(!document.hidden&&chatPanel?.classList.contains('mac-chat-manually-open')&&!chatPanel.hidden)return;
 const latest=incoming[incoming.length-1],owner=notificationOwner;
 void nativeRegistration().then(reg=>{
  if(!tokens||owner!==notificationOwner||!nativeEnabled())return;
  return reg.showNotification('MAC Vision · Chat Vision',{body:incoming.length===1?'Recebeste uma nova mensagem.':'Recebeste '+incoming.length+' novas mensagens.',icon:new URL('public/apple-touch-icon.png',notificationBase).href,tag:'mac-chat-'+String(latest.id)});
 }).catch(()=>{});
}
async function chat(action,args={}){
 const result=await authRequest('/rest/v1/rpc/mac_vision_chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_args:args})});
 try{observeNativeChat(action,args,result);}catch(e){console.warn('Notificações do dispositivo indisponíveis.');}
 return result;
}
window.macCloud={shared,get,put,remove,readBrand,loadGate,autoLogin,bindIdentity,signOut,factoryReset,chat,beginTransition,endTransition,uploadAttachment,downloadAttachment,removeAttachment,
 get profile(){return profile},get access(){return access},get session(){return tokens},get lastCloudError(){return lastCloudError}
};
})();
