/* Read-only export of the original UI. Cloud refresh never overwrites dirty data. */
(function(){
 'use strict';
 const E=id=>document.getElementById(id);
 let renderer;
 function loadRenderer(){
  if(window.html2canvas)return Promise.resolve(window.html2canvas);
  if(renderer)return renderer;
  renderer=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='/mac-vision/html2canvas.min.js';
   script.onload=()=>window.html2canvas?resolve(window.html2canvas):reject(Error('Não foi possível preparar a imagem.'));
   script.onerror=()=>{script.remove();renderer=null;reject(Error('Não foi possível preparar a imagem. Tenta novamente.'));};
   document.head.appendChild(script);
  });
  return renderer;
 }
 async function render(kind){
  if(!['ios','overview'].includes(kind))throw Error('Quadro inválido.');
  const shopId=currentShopId,date=state.selectedDate,mode=period,pageId=kind==='ios'?'page-ios':'page-dashboard';
  if(page!==(kind==='ios'?'ios':'dashboard'))throw Error('Abre o quadro que pretendes enviar.');
  const selectedShop=E('storeSelect')?.value;
  const checkContext=()=>{
   if(currentShopId!==shopId||state.selectedDate!==date||period!==mode||E('storeSelect')?.value!==selectedShop||page!==(kind==='ios'?'ios':'dashboard'))throw Error('A seleção mudou. Tenta enviar novamente.');
  };
  if(!window.macRefreshForExport)throw Error('A atualização Cloud não está disponível. Atualiza a página.');
  await window.macRefreshForExport();checkContext();
  if(kind==='ios')renderIOS();
  else{
   await window.macRefreshOverviewForExport?.();checkContext();
   renderMetrics();renderDashboard();
   if(typeof macAreaOverview==='function')await macAreaOverview();
  }
  checkContext();
  await document.fonts.ready;
  const main=E('mainApp')?.querySelector('main');
  if(!main||!E(pageId))throw Error('O quadro não está disponível.');
  await Promise.all([...main.querySelectorAll('#'+pageId+' img')].map(img=>img.complete?null:new Promise(r=>{img.addEventListener('load',r,{once:true});img.addEventListener('error',r,{once:true});setTimeout(r,8000);})));
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const capture=await loadRenderer();checkContext();
  const shop=E('storeSelect')?.selectedOptions[0]?.textContent?.trim()||currentStore()?.name||'Loja';
  const canvas=await capture(main,{
   scale:2,width:1360,windowWidth:1360,windowHeight:1800,
   scrollX:0,scrollY:0,useCORS:true,allowTaint:false,imageTimeout:15000,logging:false,
   backgroundColor:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
   onclone:doc=>{
    const root=doc.getElementById('mainApp'),content=root?.querySelector('main');
    if(!root||!content)throw Error('O quadro não está disponível.');
    const style=doc.createElement('style');
    style.textContent=`html,body{width:1360px!important;min-width:1360px!important;height:auto!important;overflow:visible!important}
     #mainApp{display:block!important;width:1360px!important;min-width:0!important;height:auto!important;overflow:visible!important;background:var(--bg)!important}
     #mainApp>aside{display:none!important}
     #mainApp main.main{box-sizing:border-box!important;width:1360px!important;max-width:none!important;min-width:0!important;height:auto!important;margin:0!important;padding:24px!important;overflow:visible!important;transform:none!important}
     #mainApp main>.page{display:none!important}
     #mainApp main>#${pageId}{display:block!important;height:auto!important;overflow:visible!important}
     #mainApp .mac-ios-scroll,#mainApp .tablewrap{overflow:visible!important;max-height:none!important;height:auto!important}
     #mainApp .mac-ios-row{min-width:0!important}
     #mainApp .mac-ios-table{width:100%!important;min-width:0!important}
     #mainApp .mac-ios-goal-caption{display:none!important}
     #mainApp .topbar{margin-bottom:24px!important}
     #mainApp main *{animation:none!important;transition:none!important}
     #mainApp .topbar{display:flex!important;flex-wrap:nowrap!important;align-items:flex-start!important;justify-content:space-between!important;gap:16px!important}
     #mainApp .topbar>*{min-width:0!important}
     #mainApp #metrics{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:10px!important;align-items:stretch!important}
     #mainApp #trafficMetrics{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:10px!important;align-items:stretch!important}
     #mainApp #trafficMetrics>*{grid-column:span 2!important;min-width:0!important}
     #mainApp #trafficMetrics>*:nth-child(-n+2){grid-column:span 3!important}
     #mainApp #metrics>*,#mainApp .dash-three>*{min-width:0!important;height:auto!important}
     #mainApp .dash-three{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:16px!important;align-items:stretch!important}
     #mainApp .production-heading{display:flex!important;flex-wrap:nowrap!important;align-items:center!important}
     #mainApp #page-dashboard .metric *{overflow-wrap:anywhere!important}
     #mainApp #page-dashboard>.surface.card:last-child{display:none!important}
     #mainApp #page-ios .mac-ios-table{--mac-ios-template:230px repeat(12,minmax(0,1fr))!important;width:100%!important}
     #mainApp #page-ios .mac-ios-row{width:100%!important;min-width:0!important;grid-template-columns:var(--mac-ios-template)!important}
     #mainApp #page-ios .mac-ios-row>*{min-width:0!important;overflow:hidden!important;white-space:nowrap!important;text-overflow:clip!important}
     #mainApp #page-ios .ios-kpis{grid-template-columns:repeat(6,minmax(0,1fr))!important}
     #mainApp #page-ios #iosProducts,#mainApp #page-ios #iosProducts~*,#mainApp #page-ios .surface.card:has(#iosProducts),#mainApp #page-ios #iosCollaboratorSchedule{display:none!important}
     #mainApp [title]:hover::after{display:none!important}`;
    doc.head.appendChild(style);
    // The app applies a user zoom to <html>; html2canvas cannot render CSS zoom, so the export stage always uses 1:1.
    doc.documentElement.style.zoom='1';doc.body.style.zoom='1';
    root.querySelectorAll('[style*="zoom"]').forEach(node=>{node.style.zoom='1';});
    const keep=kind==='ios'?'macShareIOS':'macShareOverview';
    root.querySelectorAll('#macShareIOS,#macShareOverview').forEach(button=>{if(button.id!==keep)button.style.setProperty('display','none','important');});
    root.querySelectorAll('.mac-ios-goal-caption').forEach(node=>node.remove());
    root.querySelectorAll('#macShareIOS,#macShareOverview').forEach(button=>{button.textContent='▲';button.disabled=false;});
    content.querySelectorAll('img').forEach(image=>{image.loading='eager';});
   }
  });
  checkContext();
  canvas.macExportMetadata={date,shop};
  return canvas;
 }
 window.macExportImage={render};
})();
