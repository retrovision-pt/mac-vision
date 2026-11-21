/* Read-only rules used by the original document's image exports. */
(function(root){
 'use strict';
 const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
 const codes=new Set(['A','B','C','D','E','G','H','I']);
 root.macExportRules={
  key,
  scheduled:(schedules,date)=>new Set((schedules||[]).filter(turn=>turn.date===date&&codes.has(String(turn.code||'').trim().toUpperCase())).map(turn=>key(turn.employee))),
  goal:(actual,target)=>Number.isFinite(actual)&&Number.isFinite(target)?(actual>=target?'good':'bad'):null
 };
})(typeof window==='undefined'?globalThis:window);