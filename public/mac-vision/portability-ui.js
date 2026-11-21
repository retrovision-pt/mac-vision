/* Extensions to the original document; Cloud acknowledgement owns persistence. */
(function(){
 'use strict';
 const rules=window.macPortabilityRules;
 if(!rules)return;
 const E=id=>document.getElementById(id);
 const fullManager=()=>session?.role==='gestor'&&currentStore()?.users.some(u=>u.id===session.id&&u.isAreaMaster&&u.adminRole==='mac');
 const style=document.createElement('style');
 style.textContent=`
 @media(min-width:901px){
  #mainApp .sidebar{height:100dvh!important;min-height:0!important;max-height:100dvh!important;box-sizing:border-box!important;overflow:hidden!important;align-self:flex-start!important;gap:14px!important}
  #mainApp .sidebar>.brand,#mainApp .sidebar>.sidebar-user,#mainApp .sidebar>.mac-mobile-drawer{flex:0 0 auto!important}
  #mainApp .sidebar .mac-mobile-drawer{display:contents!important}
  #mainApp .sidebar #nav{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain}
  #mainApp .sidebar #nav button{flex:0 0 auto!important}
  #mainApp #macSidebarFooterRow{flex:0 0 auto!important;margin-top:0!important}
 }
 @media(max-width:900px){#mainApp .sidebar{height:auto!important;min-height:0!important;max-height:none!important}}
 #macPortabilityDialog{width:min(380px,calc(100vw - 28px));padding:22px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:8px}
 #macPortabilityDialog::backdrop{background:var(--overlay, var(--nav));opacity:.75}
 #macPortabilityDialog .mac-port-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}
 #macPortabilityDialog h2{margin:0;font-size:19px;letter-spacing:0}
 #macPortabilityDialog .mac-port-options{display:flex;gap:12px;margin-top:22px}
 #macPortabilityDialog .mac-port-options .btn{flex:1;min-height:45px;font-weight:800}
 html[data-theme] #macPortabilityDialog .mac-port-yes{background:var(--traffic-good,var(--accent))!important;color:var(--nav)!important;border-color:var(--traffic-good,var(--accent))!important}
 html[data-theme] #macPortabilityDialog .mac-port-no{background:var(--red)!important;color:var(--nav)!important;border-color:var(--red)!important}
 #macPortabilityDialog .mac-port-close{width:32px;min-height:32px;padding:0}
 .mac-history-portability{display:inline-flex;align-items:center;justify-content:center}
 `;
 document.head.appendChild(style);
 // The original document applies zoom; viewport units are scaled by it too.
 function fitSidebar(){
  const sidebar=document.querySelector('#mainApp .sidebar'),drawer=E('macMobileDrawer');
  if(!sidebar||!sidebar.offsetWidth)return;
  const scale=sidebar.getBoundingClientRect().width/sidebar.offsetWidth;
  if(!scale)return;
  if(matchMedia('(max-width:900px)').matches){
   sidebar.style.removeProperty('height');sidebar.style.removeProperty('max-height');
   if(drawer){
    const top=sidebar.getBoundingClientRect().bottom;
    drawer.style.setProperty('top',top/scale+'px','important');
    drawer.style.setProperty('width',innerWidth/scale+'px','important');
    drawer.style.setProperty('height',Math.max(0,innerHeight-top)/scale+'px','important');
    drawer.style.setProperty('max-height',Math.max(0,innerHeight-top)/scale+'px','important');
   }
  }else{
   if(drawer)for(const key of ['top','width','height','max-height'])drawer.style.removeProperty(key);
   const height=Math.max(0,innerHeight-sidebar.getBoundingClientRect().top)/scale+'px';
   sidebar.style.setProperty('height',height,'important');sidebar.style.setProperty('max-height',height,'important');
  }
 }
 window.addEventListener('resize',()=>requestAnimationFrame(fitSidebar));
 E('mobileMenuToggle')?.addEventListener('click',()=>requestAnimationFrame(fitSidebar));
 new ResizeObserver(()=>requestAnimationFrame(fitSidebar)).observe(E('mainApp'));
 requestAnimationFrame(fitSidebar);
 const dialog=document.createElement('dialog');dialog.id='macPortabilityDialog';dialog.setAttribute('aria-labelledby','macPortabilityTitle');
 dialog.innerHTML='<div class="mac-port-heading"><h2 id="macPortabilityTitle">Móvel com Portabilidade?</h2><button type="button" class="btn mac-port-close" aria-label="Fechar">✕</button></div><div class="mac-port-options"><button type="button" class="btn mac-port-yes" data-port-answer="yes">SIM</button><button type="button" class="btn mac-port-no" data-port-answer="no">NÃO</button></div>';
 document.body.appendChild(dialog);
 let resolveAnswer=null;
 function ask(){return new Promise(resolve=>{resolveAnswer=resolve;dialog.showModal();});}
 dialog.addEventListener('click',event=>{
  const button=event.target.closest('[data-port-answer],.mac-port-close');if(!button)return;
  dialog.returnValue=button.dataset.portAnswer||'';dialog.close();
 });
 dialog.addEventListener('cancel',()=>{dialog.returnValue='';});
 dialog.addEventListener('close',()=>{const resolve=resolveAnswer;resolveAnswer=null;resolve?.(dialog.returnValue==='yes'?true:dialog.returnValue==='no'?false:null);dialog.returnValue='';});
 const oldKpis=salesKpis;
 salesKpis=function(sales){const result=oldKpis(sales);result.portIn+=rules.count(sales);return result;};
 let saving=false,failedSaleId='',bypassSubmit=false;
 const form=E('saleForm');
 document.addEventListener('submit',async event=>{
  if(event.target!==form||bypassSubmit)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(saving||!session)return;
  saving=true;const button=E('saveSale');if(button)button.disabled=true;
  try{
   if(failedSaleId&&state.sales.some(s=>s.id===failedSaleId)){
    if(!await macFlushChangesForExit())throw Error('A venda continua por guardar. Tenta novamente sem criar outro registo.');
    failedSaleId='';toast('Venda registada na Cloud.');return;
   }
   const editing=state.sales.find(s=>s.id===E('saleEditId').value);
   const label=E('saleLabel').value;
   const displayed=typeof macProductName==='function'?macProductName('mobile',label):label;
   const selectedKind=E('saleKind').value;
   const candidate={kind:['mobile_products','mobile_sheet'].includes(selectedKind)?'mobile':selectedKind,label,meta:{catalogProduct:displayed}};
   let answer=rules.value(editing);
   if(rules.eligible(candidate)){
    answer=await ask();if(answer===null)return;
   }
   const before=new Set(state.sales.map(s=>s.id)),oldMeta=editing?structuredClone(editing.meta||{}):{};
   bypassSubmit=true;
   try{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}finally{bypassSubmit=false;}
   const record=editing?state.sales.find(s=>s.id===editing.id):state.sales.find(s=>!before.has(s.id));
   if(!record)return;
   record.meta={...oldMeta,...record.meta};
   if(rules.eligible(candidate)){record.meta.mobilePortability=answer;}
   else delete record.meta.mobilePortability;
   macMarkUnsaved();
   failedSaleId=record.id;
   if(!await macFlushChangesForExit())throw Error('A venda está pendente na Cloud. Mantém esta sessão aberta e tenta novamente.');
   failedSaleId='';render();
  }catch(error){toast(error.message||'Não foi possível guardar a venda.',true);}
  finally{saving=false;if(button)button.disabled=false;}
 },true);
 const oldHistory=renderHistory;
 renderHistory=function(){
  const result=oldHistory.apply(this,arguments);
  for(const row of E('historyTable')?.querySelectorAll('tbody tr')||[]){
   const edit=row.querySelector('[data-edit-sale]');if(!edit)continue;
   const sale=state.sales.find(s=>s.id===edit.dataset.editSale);if(!rules.eligible(sale))continue;
   const button=document.createElement('button');button.type='button';button.className='btn small mac-sale-action mac-history-portability';button.dataset.portSale=sale.id;
   button.textContent=rules.value(sale)===true?'📲':'📱';
   button.title='Portabilidade: '+(rules.value(sale)===true?'SIM':'NÃO')+' — Editar';button.setAttribute('aria-label',button.title);
   edit.before(button);
  }
  return result;
 };
 E('historyTable')?.addEventListener('click',async event=>{
  const button=event.target.closest('[data-port-sale]');if(!button||saving)return;
  event.preventDefault();const sale=state.sales.find(s=>s.id===button.dataset.portSale);if(!rules.eligible(sale))return;
  if(isCollaborator()&&norm(sale.employee)!==norm(session?.employee)&&!macCan('sales.edit'))return toast('Só podes editar as tuas próprias vendas.',true);
  saving=true;button.disabled=true;
  try{
   const answer=await ask();if(answer===null)return;
   sale.meta={...sale.meta,mobilePortability:answer};macMarkUnsaved();
   if(!await macFlushChangesForExit())throw Error('Portabilidade não confirmada na Cloud. Mantém a sessão aberta e tenta novamente.');
   render();toast('Portabilidade atualizada na Cloud.');
  }catch(error){toast(error.message,true);}
  finally{saving=false;button.disabled=false;}
 });
 // Administrative deletion must be explicit, never inferred from a missing row.
 let registryBusy=false,registryPending=false;
 async function refreshRegistry(){
  if(registryBusy||!session)return;
  registryBusy=true;
  try{
   const before=JSON.stringify(shopRegistry),directory=await macRPC('directory');
   if(!directory.accounts?.some(a=>a.id===session.id)){await logout();toast('Este acesso foi desativado.',true);return;}
   if(macStateDirty||document.querySelector('dialog[open]')||JSON.stringify(shopRegistry)!==before){registryPending=true;return;}
   macCloudDirectory=directory;shopRegistry=structuredClone(directory.stores);registryPending=false;
   if(!shopRegistry.some(s=>s.id===currentShopId)){await logout();toast('Esta loja foi arquivada. Entra numa loja ativa.',true);return;}
   renderAccess();renderOptions();renderSessionPhoto();
  }catch(error){console.warn('Atualização de acessos não concluída',error);}
  finally{registryBusy=false;}
 }
 E('macAdminProfiles')?.addEventListener('click',async event=>{
  const button=event.target.closest('[data-mac-admin-remove]');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!fullManager())return toast('Só o Gestor MAC Vision pode desativar administradores.',true);
  if(button.disabled)return;
  const id=button.dataset.macAdminRemove,user=shopRegistry.flatMap(s=>s.users||[]).find(u=>u.id===id);
  if(!user||!confirm('Desativar '+user.name+' em todas as lojas? Os históricos e a fotografia serão preservados.'))return;
  button.disabled=true;
  try{await macRPC('remove-access',{id,storeId:''});await refreshRegistry();toast('Conta desativada em todas as lojas; históricos preservados.');}
  catch(error){toast(error.message,true);}
  finally{button.disabled=false;}
 },true);
 window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==location.origin||event.data?.macVisionBridge!==1||event.data.event!=='registry-changed')return;
  registryPending=true;void refreshRegistry();
 });
 document.addEventListener('close',()=>{if(registryPending)void refreshRegistry();},true);
 setInterval(()=>{if(session&&!document.hidden)void refreshRegistry();},15000);
})();