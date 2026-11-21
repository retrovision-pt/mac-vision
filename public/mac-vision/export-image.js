/* Export-only layout. Never modifies the live document or its Cloud records. */
(function(){
 'use strict';
 const E=id=>document.getElementById(id),rules=window.macExportRules;
 const clean=node=>{if(!node)return '';const copy=node.cloneNode(true);copy.querySelectorAll('img,.avatar,.mac-ios-rank,button[data-go]').forEach(n=>n.remove());return copy.textContent.trim().replace(/\s+/g,' ');};
 const visible=node=>!!node&&!node.hidden&&getComputedStyle(node).display!=='none';
 const token=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
 const cell=node=>{
  const css=getComputedStyle(node),target=node.getAttribute('data-target')??node.getAttribute('data-goal'),actual=node.getAttribute('data-actual');
  const goal=target!==null&&actual!==null?rules.goal(Number(actual),Number(target)):null;
  return {text:clean(node),photo:node.querySelector('img')?.src||'',fg:css.color,bg:goal?token(goal==='good'?'--traffic-good':'--red'):css.backgroundColor};
 };
 function personGoal(item,name,actual){
  // The existing target field is a daily weighted-points goal, not a monthly or store goal.
  if(period!=='day')return item;
  const employee=(state.employees||[]).find(e=>rules.key(e.name)===rules.key(name));
  const target=employee?.target;
  if(target==null||!Number.isFinite(Number(target)))return item;
  const result=rules.goal(actual,Number(target));if(!result)return item;
  item.text+=' · Objetivo: '+nf(Number(target),2);
  item.bg=token(result==='good'?'--traffic-good':'--red');item.fg=token('--nav');
  return item;
 }
 function table(node,title,allowed){
  if(!node)return null;
  const ios=node.querySelector('.mac-ios-table-header');
  const header=ios?[...ios.children]:[...(node.querySelector('thead tr')?.children||[])];
  const rows=ios?[...node.querySelectorAll('.mac-ios-row:not(.mac-ios-table-header)')]:[...node.querySelectorAll('tbody tr')];
  if(!header.length)return null;
  return {title,rows:[header.map(cell),...rows.filter(row=>!allowed||allowed.has(rules.key(clean(row.querySelector('.mac-ios-employee-name')||row.children[0])))).map(row=>{
   const items=[...row.children].map(cell),name=clean(row.querySelector('.mac-ios-employee-name')||row.children[0]);
   const points=row.querySelector('[data-ios-key="points"]');
   if(points&&row.classList.contains('mac-ios-person-row')){
    const index=[...row.children].indexOf(points),value=Number(clean(points).replace(/\s/g,'').replace(',','.'));
    personGoal(items[index],name,value);
   }
   return items;
  })],header:true};
 }
 function list(node,title,allowed){
  if(!node)return null;
  const rows=[...node.querySelectorAll('.rank-row,.chart-row,.mac-area-employee-line')].map(row=>{
   const person=row.querySelector('.person-line,.rank-title,[data-mac-area-staff]')||row.children[0];
   const explicitName=person?.querySelector('.mac-person-name,.mac-employee-name');
   const name=(person?.dataset.macAreaStaff||clean(explicitName||person)).split(' · ')[0].replace(/\s+\d+[,.]\d+\s*pts.*$/i,'');
   if(allowed&&!allowed.has(rules.key(name)))return null;
   const label=cell(person||row);label.text=name;
   if(!label.photo&&typeof employeePhotoIn==='function')label.photo=employeePhotoIn(state,name)||'';
   const value=row.querySelector('.standout,.n,strong,.tag');
   const result=value?cell(value):{text:''};
   if((node.id==='ranking'||row.classList.contains('mac-area-employee-line'))&&value)personGoal(result,name,Number(clean(value).replace(/pts/g,'').trim().replace(',','.')));
   const time=row.querySelector('.smalltext');
   return [label,result,...(time?[cell(time)]:[])];
  }).filter(Boolean);
  return {title,rows,header:false};
 }
 function metrics(node,title){
  const rows=[...(node?.querySelectorAll('.metric')||[])].map(metric=>{
   const head=metric.querySelector('.ico span:first-child');
   const value=metric.querySelector('.value');
   return [{text:clean(head)},...(value?[cell(value)]:[]),...([...metric.querySelectorAll('.metric-sub span,.detail')].map(cell))];
  });
  return {title,rows,header:false};
 }
 function wrap(ctx,text,width){
  const lines=[];let line='';
  for(const word of String(text||'').split(/\s+/)){
   if(ctx.measureText(word).width>width){
    if(line){lines.push(line);line='';}
    for(const char of word){if(ctx.measureText(line+char).width>width){lines.push(line);line='';}line+=char;}
   }else if(line&&ctx.measureText(line+' '+word).width>width){lines.push(line);line=word;}
   else line+=(line?' ':'')+word;
  }
  if(line)lines.push(line);return lines.length?lines:[''];
 }
 async function photo(src){
  if(!src)return null;
  const image=new Image();image.crossOrigin='anonymous';image.src=src;
  try{await Promise.race([image.decode(),new Promise((_,reject)=>setTimeout(()=>reject(Error('photo timeout')),6000))]);return image;}catch{return null;}
 }
 async function render(kind){
  if(!rules)throw Error('As regras de partilha não estão disponíveis. Atualiza a página.');
  const date=state.selectedDate;
  const allowed=rules.scheduled(state.schedules,date);
  // Match schedule aliases using the same canonical name as the original IOS screen.
  for(const turn of state.schedules||[])if(allowed.has(rules.key(turn.employee))&&typeof employeeName==='function')allowed.add(rules.key(employeeName(turn.employee)));
  const blocks=[];
  if(kind==='ios'){
   blocks.push(table(E('macIosTopGrid'),'Resultados da loja'),table(E('macIosPeopleGrid'),'Resultados e objetivos individuais'));
   const products=E('iosProducts');if(visible(products)&&clean(products))blocks.push({title:'Detalhe de produtos e ações',rows:[[{text:clean(products)}]]});
  }else{
   blocks.push(metrics(E('metrics'),'Vendas'),metrics(E('trafficMetrics'),'Tráfego'));
   blocks.push(list(E('ranking'),'Ponderação por colaborador',allowed),list(E('breakdown'),'Distribuição de Vendas'),list(E('todaySchedule'),'Escala da data selecionada',allowed));
   blocks.push(table(E('productivityTable'),'Produtividade e Atendimento',allowed));
   const area=E('macAreaOverview');if(visible(area))blocks.push(list(area,'Colaboradores escalados',allowed));
   // Include only IOS data actually displayed in the overview, never hidden/stale IOS panels.
   for(const node of E('page-dashboard').querySelectorAll('.mac-ios-table,table')){
    if(visible(node)&&!node.closest('#productivityTable'))blocks.push(table(node,'Objetivos e resultados IOS',allowed));
   }
  }
  const sections=blocks.filter(b=>b&&b.rows.length);
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw Error('Este navegador não permite gerar imagens.');
  ctx.font='600 18px Arial';
  let width=1200;
  for(const block of sections){
   const count=Math.max(...block.rows.map(row=>row.length));
   block.widths=Array.from({length:count},(_,i)=>Math.min(i===0?420:240,Math.max(i===0?260:110,...block.rows.map(row=>ctx.measureText(row[i]?.text||'').width+40))));
   width=Math.max(width,block.widths.reduce((a,b)=>a+b,0)+64+4*(count-1));
  }
  let height=160;
  for(const block of sections){
   const extra=(width-64-4*(block.widths.length-1)-block.widths.reduce((a,b)=>a+b,0))/block.widths.length;
   block.widths=block.widths.map(w=>w+extra);
   block.heights=block.rows.map(row=>Math.max(60,...row.map((item,i)=>wrap(ctx,item.text,block.widths[i]-32-(item.photo?48:0)).length*26+24)));
   height+=60+block.heights.reduce((a,b)=>a+b+4,0)+28;
  }
  const scale=Math.min(2,32760/Math.max(width,height),Math.sqrt(60000000/(width*height)));
  if(scale<1)throw Error('O quadro é demasiado grande para uma única imagem legível. Seleciona uma loja ou um período menor.');
  canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);ctx.scale(scale,scale);
  const bg=token('--bg')||token('--surface'),surface=token('--surface'),fg=token('--text'),border=token('--border'),accent=token('--traffic-good')||token('--accent');
  ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);ctx.fillStyle=fg;ctx.font='800 34px Arial';ctx.fillText(kind==='ios'?'Quadro IOS':'Visão Geral',32,52);
  ctx.font='600 18px Arial';ctx.fillText((window.macWalletHeader?.()||'MAC Vision')+' · '+(E('globalDateView')?.value||date),32,87);
  const choice=E('storeSelect')?.selectedOptions[0];
  canvas.macExportMetadata={date,shop:choice?.textContent?.trim()||currentStore()?.name||'Loja'};
  ctx.fillText(canvas.macExportMetadata.shop+' · '+(E('displayPeriod')?.textContent||''),32,119);
  const images=new Map();await Promise.all([...new Set(sections.flatMap(b=>b.rows.flatMap(row=>row.map(c=>c.photo).filter(Boolean))))].map(async src=>images.set(src,await photo(src))));
  let y=160;
  for(const block of sections){
   ctx.fillStyle=fg;ctx.font='800 23px Arial';ctx.fillText(block.title,32,y+28);y+=52;
   block.rows.forEach((row,r)=>{
    let x=32;const h=block.heights[r];
    row.forEach((item,i)=>{
     const w=block.widths[i];ctx.fillStyle=item.bg&&item.bg!=='rgba(0, 0, 0, 0)'?item.bg:surface;
     ctx.fillRect(x,y,w,h);ctx.strokeStyle=border;ctx.strokeRect(x,y,w,h);
     let tx=x+16;
     const image=images.get(item.photo);
     if(image){ctx.save();ctx.beginPath();ctx.arc(x+32,y+h/2,20,0,Math.PI*2);ctx.clip();const side=Math.min(image.width,image.height);ctx.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,x+12,y+h/2-20,40,40);ctx.restore();ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+32,y+h/2,21,0,Math.PI*2);ctx.stroke();ctx.lineWidth=1;tx+=48;}
     ctx.font=block.header&&r===0?'800 18px Arial':'600 18px Arial';ctx.fillStyle=item.fg||fg;
     const lines=wrap(ctx,item.text,w-32-(item.photo?48:0));lines.forEach((line,j)=>ctx.fillText(line,tx,y+(h-lines.length*26)/2+20+j*26));x+=w+4;
    });y+=h+4;
   });y+=28;
  }
  return canvas;
 }
 window.macExportImage={render};
})();