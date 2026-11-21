/* Original-document extension, persisted through its versioned Cloud store documents. */
(function(){
 'use strict';
 const E=id=>document.getElementById(id),rules=window.macIOSRules;
 if(!rules)return;
 function summarize(rows,ts){
  const k=salesKpis(rows),att=ts.filter(isTerminated),canc=ts.filter(isCancelled),pts=rows.reduce((sum,x)=>sum+num(x.points),0);
  const pointsFor=kind=>rows.filter(x=>x.kind===kind).reduce((sum,x)=>sum+num(x.points),0);
  const energyAlarm=rows.filter(x=>x.kind==='business'&&norm(x.label).includes('ENERGIA')&&norm(x.label).includes('ALARME')).reduce((sum,x)=>sum+num(x.qty),0);
  return {points:pts,fixed:pointsFor('fixed'),mobile:pointsFor('mobile'),marks:pointsFor('mark'),business:pointsFor('business'),nc:k.nc,alarms:k.alarms,alarmPme:k.alarmsPme,energyTv:k.energyTv||0,energyAlarm,standalone:k.energyStandalone||0,attended:att.length,te:att.length?100*pts/att.length:null,td:att.length?100*canc.length/att.length:null,tma:att.length?avg(att.map(x=>num(x.serviceSec))):null};
 }
 const format=(key,value)=>value==null?'—':['te','td'].includes(key)?nf(value,1)+'%':key==='tma'?secTime(value):nf(value,['points','fixed','mobile','marks','business'].includes(key)?2:0);
 const targets=rules.targets;
 function applyGoals(){
  if(!session)return;
  const date=isCollaborator()?localTodayIso():state.selectedDate,mode=isCollaborator()?'day':period;
  const sales=isCollaborator()?state.sales.filter(x=>x.date===date):dataSales();
  const tickets=isCollaborator()?state.tickets.filter(x=>x.date===date):dataTickets();
  for(const row of document.querySelectorAll('#macIosTopGrid .mac-ios-total-row,#macIosPeopleGrid .mac-ios-person-row')){
   const name=row.querySelector('.mac-ios-employee-name')?.textContent?.trim();
   const id=name?rules.personId(currentStore(),state,name):null;
   const goals=name&&!id?{}:targets(state,id,date,mode);
   const matches=record=>!name||(id?rules.personId(currentStore(),state,record.employee)===id:rules.key(record.employee)===rules.key(name));
   const hasSales=sales.some(matches),hasTickets=tickets.some(matches);
   for(const cell of row.querySelectorAll('[data-ios-key]')){
     cell.querySelectorAll('.mac-ios-goal-caption').forEach(caption=>caption.remove());
     cell.classList.remove('mac-ios-goal','mac-ios-goal-good','mac-ios-goal-bad');delete cell.dataset.goal;
    const goal=goals[cell.dataset.iosKey],actual=cell.dataset.actual===''?null:Number(cell.dataset.actual);
    const status=rules.goal(actual,goal,['attended','te','td','tma'].includes(cell.dataset.iosKey)?hasTickets:hasSales);
    if(goal==null)continue;
    cell.dataset.goal=goal;cell.classList.add('mac-ios-goal');if(status)cell.classList.add('mac-ios-goal-'+status);
     const small=document.createElement('small');small.className='mac-ios-goal-caption';small.textContent=nf(goal,Number.isInteger(Number(goal))?0:2);small.setAttribute('aria-label','Objetivo '+small.textContent);cell.appendChild(small);
   }
  }
 }
 const oldIOS=renderIOS;
 renderIOS=function(){const out=oldIOS.apply(this,arguments);applyGoals();return out;};
 const dialog=document.createElement('dialog');dialog.id='macIOSGoalsDialog';dialog.className='mac-edit-dialog';
 dialog.setAttribute('aria-labelledby','macIOSGoalsTitle');
  dialog.innerHTML='<h2 id="macIOSGoalsTitle">Editar Objetivos</h2><p id="macIOSGoalsContext" class="smalltext muted"></p><form id="macIOSGoalsForm"><div class="mac-ios-goals-header"><span>Indicador</span><span>Objetivo</span></div><div id="macIOSGoalsRows"></div><div class="mac-ios-goals-actions"><button type="submit" class="btn primary">Gravar</button><button type="button" class="btn" id="macIOSGoalsCancel">Cancelar</button></div></form>';
 document.body.appendChild(dialog);
 let context=null,busy=false;
 async function openGoals(shopId,userId){
  try{
   if(!macCanAdministerStore(shopId))throw Error('Não tens permissão para editar os objetivos desta loja.');
   const shop=shopRegistry.find(s=>s.id===shopId),data=await dataForStore(shopId);
   const user=userId?shop?.users.find(u=>u.id===userId):null;
   if(userId&&!user)throw Error('O colaborador já não está disponível nesta loja.');
   const date=state.selectedDate,mode=period;
   context={shopId,userId,date,mode};
   E('macIOSGoalsContext').textContent=(user?.name||shop?.name||'Loja')+' · '+(mode==='month'?date.slice(0,7):datePT(date))+' · TMA (segundos)';
   const saved=targets(data,userId,date,mode);
    E('macIOSGoalsRows').innerHTML=rules.defs.map(([label,key])=>'<div class="mac-ios-goals-row" data-key="'+h(key)+'"><label for="macGoal-'+h(key)+'">'+h(label.replace('|',' '))+'</label><input id="macGoal-'+h(key)+'" name="'+h(key)+'" aria-label="Objetivo '+h(label.split('|')[1])+'" type="number" min="0" step="any" value="'+(saved[key]==null?'':h(saved[key]))+'"></div>').join('');
    dialog.showModal();
  }catch(error){toast(error.message,true);}
 }
 E('macIOSGoalsCancel').addEventListener('click',()=>{if(!busy)dialog.close();});
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 dialog.addEventListener('close',()=>{context=null;});
 E('macIOSGoalsForm').addEventListener('submit',async event=>{
  event.preventDefault();const c=context;if(!c||busy)return;
  if(!macCanAdministerStore(c.shopId))return toast('Não tens permissão para editar estes objetivos.',true);
  busy=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{
   if(c.shopId===currentShopId&&!await macFlushChangesForExit())throw Error('Existem alterações por guardar. Tenta novamente.');
   const values={};for(const input of dialog.querySelectorAll('input')){if(input.value==='')continue;const value=Number(input.value);if(!Number.isFinite(value)||value<0)throw Error('Introduz objetivos iguais ou superiores a zero.');values[input.name]=value;}
   const data=await dataForStore(c.shopId);
   rules.setTargets(data,c.userId,c.date,c.mode,values);
   if(c.shopId===currentShopId){macMarkUnsaved();if(!await persist())throw Error('Objetivos por guardar na Cloud. Mantém esta janela aberta e tenta novamente.');}
   else await writeKey('store:'+c.shopId,data);
   renderIOS();if(page==='dashboard')renderDashboard();dialog.close();toast('Objetivos guardados na Cloud.');
  }catch(error){toast(error.message,true);}
  finally{busy=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
 });
 function addButton(parent,id,open){
  if(!parent)return;
  const button=document.createElement('button');button.type='button';button.id=id;button.className='btn small mac-goal-open';button.textContent='🏪';button.title='Editar Objetivos';button.setAttribute('aria-label','Editar Objetivos');parent.appendChild(button);button.addEventListener('click',open);
 }
 addButton(E('editUserNameRow'),'macEditUserGoals',()=>void openGoals(E('editUserStoreId').value,E('editUserId').value));
 const storeField=E('editStoreName')?.closest('.field');if(storeField){storeField.classList.add('mac-store-goal-field');addButton(storeField,'macEditStoreGoals',()=>void openGoals(E('editStoreId').value,null));}
  const linesDialog=document.createElement('dialog');linesDialog.id='macScheduleLinesDialog';linesDialog.className='mac-edit-dialog';
  linesDialog.setAttribute('aria-labelledby','macScheduleLinesTitle');
  linesDialog.innerHTML='<h2 id="macScheduleLinesTitle">✏️ Gerir Linhas da Escala</h2><p id="macScheduleLinesContext" class="smalltext muted"></p><div id="macScheduleLinesRows"></div><div class="mac-ios-goals-actions"><button type="button" class="btn" id="macScheduleLinesClose">Fechar</button></div>';
  document.body.appendChild(linesDialog);
  const upload=document.querySelector('#page-schedule label[for="fileSchedule"]');
  const linesButton=document.createElement('button');linesButton.type='button';linesButton.id='macScheduleLinesOpen';linesButton.className='btn small';linesButton.textContent='✏️';linesButton.title='Gerir Linhas da Escala';linesButton.setAttribute('aria-label',linesButton.title);upload?.before(linesButton);
  const canManageLines=()=>session?.role==='gestor'?macCanAdministerStore(currentShopId):isCollaborator()&&macCan('schedule.edit');
  let linesContext=null,linesBusy=false;
  function renderLines(){
   const c=linesContext;if(!c||c.shopId!==currentShopId)return;
   E('macScheduleLinesContext').textContent=(currentStore()?.name||'Loja')+' · '+c.month.slice(5,7)+'/'+c.month.slice(0,4);
   E('macScheduleLinesRows').innerHTML=rules.scheduleLines(state,c.month).filter(row=>!isScheduleHeadingName(row.name)).sort((a,b)=>a.name.localeCompare(b.name,'pt')).map(row=>{
    const name=state.macScheduleAliasesByMonth?.[c.month]?.[norm(row.name)]||row.name;
    return '<div class="mac-schedule-line-row"><span>'+h(name)+'</span><span class="smalltext muted">'+(row.hidden?'Oculta':'Visível')+'</span><button type="button" class="btn small" data-schedule-line="'+h(row.name)+'" data-visible="'+row.hidden+'">'+(row.hidden?'Reverter':'Ocultar')+'</button></div>';
   }).join('')||'<div class="empty">Sem colaboradores nesta escala.</div>';
  }
  linesButton.addEventListener('click',()=>{
   if(!canManageLines())return toast('Não tens permissão para editar esta escala.',true);
   linesContext={shopId:currentShopId,month:E('scheduleMonth').value||state.selectedDate.slice(0,7)};renderLines();linesDialog.showModal();
  });
  E('macScheduleLinesClose').addEventListener('click',()=>{if(!linesBusy)linesDialog.close();});
  linesDialog.addEventListener('cancel',event=>{if(linesBusy)event.preventDefault();});
  linesDialog.addEventListener('close',()=>{linesContext=null;});
  E('macScheduleLinesRows').addEventListener('click',async event=>{
   const button=event.target.closest('[data-schedule-line]'),c=linesContext;
   if(!button||!c||linesBusy||c.shopId!==currentShopId||!canManageLines())return;
   linesBusy=true;linesDialog.querySelectorAll('button').forEach(b=>b.disabled=true);
   try{
    if(!await macFlushChangesForExit())throw Error('Existem alterações por guardar. Tenta novamente.');
    if(linesContext!==c||c.shopId!==currentShopId)return;
    rules.setScheduleVisibility(state,button.dataset.scheduleLine,c.month,button.dataset.visible==='true');macMarkUnsaved();renderSchedule();
    if(!await persist())throw Error('Alteração por guardar na Cloud. Mantém esta janela aberta e tenta novamente.');
    renderLines();toast('Visibilidade guardada na Cloud.');
   }catch(error){toast(error.message,true);}
   finally{linesBusy=false;linesDialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
  });
 function fitLegend(){
  const sample=E('calendarWrap')?.querySelector('.cal-cell'),legend=E('shiftLegend');if(!sample||!legend)return;
  const css=getComputedStyle(sample);legend.style.setProperty('--mac-shift-width',css.width);legend.style.setProperty('--mac-shift-height',css.height);legend.style.setProperty('--mac-shift-radius',css.borderRadius);legend.style.setProperty('--mac-shift-font',css.fontSize);
 }
  const oldSchedule=renderSchedule;renderSchedule=function(){const result=oldSchedule.apply(this,arguments);fitLegend();linesButton.hidden=!canManageLines();if(linesDialog.open&&!linesBusy)renderLines();return result;};
 window.addEventListener('resize',()=>requestAnimationFrame(fitLegend));
 window.macIOSGoals={summarize,format,targets,applyGoals};
})();