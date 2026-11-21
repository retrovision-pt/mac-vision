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
  for(const row of document.querySelectorAll('#macIosTopGrid .mac-ios-total-row,#macIosPeopleGrid .mac-ios-person-row')){
   const name=row.querySelector('.mac-ios-employee-name')?.textContent?.trim();
   const id=name?rules.personId(currentStore(),state,name):null;
   const goals=name&&!id?{}:targets(state,id,date,mode);
   for(const cell of row.querySelectorAll('[data-ios-key]')){
    const goal=goals[cell.dataset.iosKey],actual=cell.dataset.actual===''?null:Number(cell.dataset.actual);
    const status=rules.goal(actual,goal);
    if(goal==null)continue;
    cell.dataset.goal=goal;cell.classList.add('mac-ios-goal');if(status)cell.classList.add('mac-ios-goal-'+status);
    const small=document.createElement('small');small.className='mac-ios-goal-caption';small.textContent='Objetivo '+format(cell.dataset.iosKey,goal);cell.appendChild(small);
   }
  }
 }
 const oldIOS=renderIOS;
 renderIOS=function(){const out=oldIOS.apply(this,arguments);applyGoals();return out;};
 const dialog=document.createElement('dialog');dialog.id='macIOSGoalsDialog';dialog.className='mac-edit-dialog';
 dialog.setAttribute('aria-labelledby','macIOSGoalsTitle');
 dialog.innerHTML='<h2 id="macIOSGoalsTitle">Editar Objetivos</h2><p id="macIOSGoalsContext" class="smalltext muted"></p><form id="macIOSGoalsForm"><div class="mac-ios-goals-header"><span>Indicador</span><span>Objetivo</span><span>Realizado</span></div><div id="macIOSGoalsRows"></div><div class="mac-ios-goals-actions"><button type="submit" class="btn primary">Gravar</button><button type="button" class="btn" id="macIOSGoalsCancel">Cancelar</button></div></form>';
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
   E('macIOSGoalsRows').innerHTML=rules.defs.map(([label,key])=>'<div class="mac-ios-goals-row" data-key="'+h(key)+'"><label for="macGoal-'+h(key)+'">'+h(label.replace('|',' '))+'</label><input id="macGoal-'+h(key)+'" name="'+h(key)+'" aria-label="Objetivo '+h(label.split('|')[1])+'" type="number" min="0" step="any" value="'+(saved[key]==null?'':h(saved[key]))+'"><output>—</output></div>').join('');
   await refreshPopup();dialog.showModal();
  }catch(error){toast(error.message,true);}
 }
 async function refreshPopup(){
  const c=context;if(!c)return;
  const data=await dataForStore(c.shopId),shop=shopRegistry.find(s=>s.id===c.shopId);
  const inPeriod=r=>c.mode==='month'?String(r.date).startsWith(c.date.slice(0,7)):r.date===c.date;
  const match=r=>!c.userId||rules.personId(shop,data,r.employee)===c.userId;
  const values=summarize((data.sales||[]).filter(r=>inPeriod(r)&&match(r)),(data.tickets||[]).filter(r=>inPeriod(r)&&match(r)));
  if(context!==c)return;
  for(const row of E('macIOSGoalsRows').children){
   const input=row.querySelector('input'),actual=values[row.dataset.key],status=rules.goal(actual,input.value);
   row.classList.toggle('mac-ios-goal-good',status==='good');row.classList.toggle('mac-ios-goal-bad',status==='bad');
   row.querySelector('output').textContent=format(row.dataset.key,actual);
  }
 }
 E('macIOSGoalsRows').addEventListener('input',()=>void refreshPopup().catch(e=>toast(e.message,true)));
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
 setInterval(()=>{if(dialog.open&&!busy)void refreshPopup().catch(()=>{});},3000);
 function fitLegend(){
  const sample=E('calendarWrap')?.querySelector('.cal-cell'),legend=E('shiftLegend');if(!sample||!legend)return;
  const css=getComputedStyle(sample);legend.style.setProperty('--mac-shift-width',css.width);legend.style.setProperty('--mac-shift-height',css.height);legend.style.setProperty('--mac-shift-radius',css.borderRadius);legend.style.setProperty('--mac-shift-font',css.fontSize);
 }
 const oldSchedule=renderSchedule;renderSchedule=function(){const result=oldSchedule.apply(this,arguments);fitLegend();return result;};
 window.addEventListener('resize',()=>requestAnimationFrame(fitLegend));
 window.macIOSGoals={summarize,format,targets,applyGoals};
})();