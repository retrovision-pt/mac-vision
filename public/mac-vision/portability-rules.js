(function(root){
 'use strict';
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const eligible=sale=>sale?.kind==='mobile'&&/^convergente(?:\s|$)/.test(normalize(sale.meta?.catalogProduct||sale.label).replace(/^[^a-z]+/,''));
 const value=sale=>eligible(sale)&&typeof sale.meta?.mobilePortability==='boolean'?sale.meta.mobilePortability:null;
 function count(sales){
  const seen=new Set();let total=0;
  for(const sale of sales||[]){if(!sale?.id||seen.has(sale.id))continue;seen.add(sale.id);if(value(sale)===true)total++;}
  return total;
 }
 root.macPortabilityRules={eligible,value,count};
})(globalThis);