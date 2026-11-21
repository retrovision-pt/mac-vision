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
     #mainApp main *{animation:none!important;transition:none!important}`;
    doc.head.appendChild(style);
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
