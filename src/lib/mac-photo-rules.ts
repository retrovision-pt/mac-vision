// Regras puras das fotografias: uma fotografia por ID Cloud, aplicada a todas as cópias (registo e colaboradores).
const norm=(s:any)=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function linkedUserId(store:any,employeeName:string):string{
  const n=norm(employeeName);if(!n)return '';
  const hits=(store?.users||[]).filter((u:any)=>u?.id&&(norm(u.employee)===n||norm(u.name)===n));
  const ids=[...new Set(hits.map((u:any)=>String(u.id)))];
  return ids.length===1?ids[0] as string:''; // nomes repetidos nunca recebem fotografia por adivinhação
}
export function applyRegistryPhotos(stores:any[],photos:Record<string,string>){
  for(const s of stores||[])for(const u of s.users||[])if(u?.id&&photos[u.id])u.photo=photos[u.id];
  return stores;
}
export function applyEmployeePhotos(doc:any,store:any,photos:Record<string,string>){
  if(!doc||!Array.isArray(doc.employees))return doc;
  return {...doc,employees:doc.employees.map((e:any)=>{const id=linkedUserId(store,e?.name);return id&&photos[id]?{...e,photo:photos[id]}:e;})};
}
/** Devolve o documento a gravar (sem as fotografias apenas exibidas) e as fotografias realmente alteradas pelo utilizador. */
export function splitEmployeePhotos(local:any,base:any,store:any,photos:Record<string,string>){
  const changes:Record<string,string>={};
  if(!local||!Array.isArray(local.employees))return {doc:local,changes};
  const baseBy=new Map<string,any>((base?.employees||[]).map((e:any)=>[norm(e?.name),e]));
  const employees=local.employees.map((e:any)=>{
    const id=linkedUserId(store,e?.name);if(!id)return e;
    const was=baseBy.get(norm(e?.name));const shown=photos[id]||'';const original=was?.photo??'';
    if((e.photo||'')===shown)return shown===(original||'')?e:{...e,photo:original};
    if((e.photo||'')!==(original||''))changes[id]=e.photo||'';
    return e;
  });
  return {doc:{...local,employees},changes};
}
export function registryPhotoChanges(stores:any[],photos:Record<string,string>,previous:Record<string,string>){
  const changes:Record<string,string>={};
  for(const s of stores||[])for(const u of s.users||[]){
    if(!u?.id)continue;const now=u.photo||'';const was=photos[u.id]??previous[u.id]??'';
    if(now!==was)changes[u.id]=now;
  }
  return changes;
}
