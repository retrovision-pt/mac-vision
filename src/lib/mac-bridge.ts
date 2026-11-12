import { supabase } from '@/integrations/supabase/client';
import { macBootstrap, macSetupAuthorization, macCreateAccount, macDirectory, macPrivateDirectory, macSaveRegistry, macUpdatePassword, macUpdateWallet, macPinLogin, macRemoveAccess } from './mac.functions';
import { mergeChanges, registryChanges } from './mac-rules';
import { friendlyError } from './mac-pin';
import { applyRegistryPhotos, applyEmployeePhotos, splitEmployeePhotos, registryPhotoChanges } from './mac-photo-rules';

export function mountMacBridge(frame: HTMLIFrameElement) {
  const cache = new Map<string,{value:any;revision:number}>();
  let registryBase:any[]=[];
  let setupToken=new URLSearchParams(window.location.hash.slice(1)).get('configurar')||'';
  if(setupToken){window.sessionStorage.setItem('mac-private-setup',setupToken);window.history.replaceState(null,'',window.location.pathname+window.location.search);}
  else setupToken=window.sessionStorage.getItem('mac-private-setup')||'';
  let walletId='';
  // Read-only memory cache (stale-while-revalidate via Realtime); never persisted, cleared on sign-in/out.
  const readCache=new Map<string,{value:any;revision:number}>();
  let realtimeLive=false;
  const META_KEY='mac-vision-session-meta';
  const metaGet=()=>{try{return JSON.parse(window.localStorage.getItem(META_KEY)||'null')}catch{return null}};
  const send=(data:any)=>frame.contentWindow?.postMessage(data,window.location.origin);
  // Fotografias: uma por ID Cloud no Storage privado; referência no perfil; cache por caminho versionado.
  let photos:Record<string,string>={};let photoPaths:Record<string,string>={};let photoLoad:Promise<Record<string,string>>|null=null;
  const PHOTO_CACHE='mac-photo:';
  const blobToData=(b:Blob)=>new Promise<string>((ok,ko)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=()=>ko(r.error);r.readAsDataURL(b);});
  async function fetchPhotos(){
    const r=await supabase.rpc('mac_wallet_photos' as any);if(r.error)throw Error(r.error.message);
    const next:Record<string,string>={},paths:Record<string,string>={};
    await Promise.all(((r.data as any[])||[]).map(async row=>{
      const id=String(row.user_id),path=String(row.path);paths[id]=path;
      if(photoPaths[id]===path&&photos[id]){next[id]=photos[id];return;}
      let data='';try{data=window.localStorage.getItem(PHOTO_CACHE+path)||'';}catch{}
      if(!data){const d=await supabase.storage.from('mac-photos').download(path);if(d.error||!d.data)return;data=(await blobToData(d.data)).replace(/^data:[^;]+;/,'data:image/jpeg;');try{window.localStorage.setItem(PHOTO_CACHE+path,data);}catch{}}
      next[id]=data;
    }));
    for(const [id,old] of Object.entries(photoPaths))if(paths[id]!==old){try{window.localStorage.removeItem(PHOTO_CACHE+old);}catch{}}
    photos=next;photoPaths=paths;return photos;
  }
  const loadPhotos=(force=false)=>{if(force||!photoLoad)photoLoad=fetchPhotos().catch(e=>{photoLoad=null;throw e;});return photoLoad;};
  let photoChannel:any=null;
  async function savePhoto(id:string,data:string){
    let path='';
    if(data){
      const bin=atob(data.split(',')[1]||'');const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
      path=`${id}/${Date.now()}.jpg`;
      const up=await supabase.storage.from('mac-photos').upload(path,new Blob([bytes],{type:'image/jpeg'}),{contentType:'image/jpeg',upsert:false});
      if(up.error)throw Error('Não foi possível guardar a fotografia na Cloud.');
      try{window.localStorage.setItem(PHOTO_CACHE+path,data);}catch{}
    }
    const r=await supabase.rpc('mac_set_photo' as any,{u:id,p:path||null});if(r.error)throw Error(r.error.message);
    if(data){photos[id]=data;photoPaths[id]=path;}else{delete photos[id];delete photoPaths[id];}
  }
  async function savePhotos(changes:Record<string,string>,quiet=false){
    const ids=Object.keys(changes);if(!ids.length)return;
    for(const id of ids){try{await savePhoto(id,changes[id]||"");}catch(e){if(!quiet)throw e;}}
    photoLoad=Promise.resolve(photos);
    send({macVisionBridge:1,kind:'event',event:'photos-changed',photos:{...photos}});
    photoChannel?.send({type:'broadcast',event:'photo',payload:{at:Date.now()}});
  }
  function joinPhotoChannel(){
    if(photoChannel||!walletId)return;
    photoChannel=supabase.channel(`mac-photos-${walletId}`).on('broadcast',{event:'photo'},async()=>{
      try{const map=await loadPhotos(true);send({macVisionBridge:1,kind:'event',event:'photos-changed',photos:{...map}});}catch{}
    }).subscribe();
  }
  const storeOf=(id:string)=>registryBase.find((s:any)=>String(s.id)===id);
  const withPhotos=(key:string,value:any)=>isStore(key)?applyEmployeePhotos(value,storeOf(key.slice(6)),photos):value;
  async function identity(){
    const {data,error}=await supabase.auth.getUser();
    if(error||!data.user)throw Error('Inicia sessão na Cloud.');
    const account=await supabase.from('mac_accounts').select('*').eq('id',data.user.id).single();
    if(account.error||!account.data)throw Error('Conta sem carteira.');
    walletId=account.data.wallet_id;return account.data;
  }
  async function startSession(tokens:{access_token:string;refresh_token:string}){
    const r=await supabase.auth.setSession(tokens);
    if(r.error||!r.data.session)throw Error('Não foi possível iniciar sessão na Cloud. Tenta novamente.');
    await supabase.realtime.setAuth(r.data.session.access_token);
  }
  const isStore=(k:string)=>k.startsWith('store:');
  async function loadSales(storeId:string){
    const out:any[]=[];for(let o=0;;o+=1000){
      const r=await supabase.from('mac_sales').select('data').eq('store_id',storeId).is('deleted_at',null).order('created_at').order('id').range(o,o+999);
      if(r.error)throw Error(r.error.message);out.push(...r.data.map(x=>x.data));if(r.data.length<1000)break;
    }
    return out;
  }
  async function withSales(key:string,value:any){
    if(!isStore(key)||!value||typeof value!=='object')return value;
    return {...value,sales:await loadSales(key.slice(6))};
  }
  async function read(key:string){
    const hit=realtimeLive&&walletId?readCache.get(key):undefined;
    if(hit){if(!cache.has(key))cache.set(key,structuredClone(hit));return withPhotos(key,structuredClone(hit.value));}
    await identity();
    const result=await supabase.from('mac_documents').select('value,revision').eq('wallet_id',walletId).eq('key',key).maybeSingle();
    if(result.error)throw Error(result.error.message);
    const value=await withSales(key,result.data?.value??null);
    if(!cache.has(key))cache.set(key,{value:structuredClone(value),revision:result.data?.revision??0});
    readCache.set(key,{value:structuredClone(value),revision:result.data?.revision??0});
    return withPhotos(key,value);
  }
  async function write(key:string,value:any){
    await identity();
    if(!cache.has(key))await read(key);
    const base=cache.get(key)||{value:null,revision:0};
    if(isStore(key)&&value&&typeof value==='object'){
      // Sales live in their own Cloud table: send only changed/removed sales, keyed by their id (idempotent on retry).
      const storeId=key.slice(6);
      const split=splitEmployeePhotos(value,base.value,storeOf(storeId),photos);value=split.doc;
      await savePhotos(split.changes);
      const before=new Map<string,any>((base.value?.sales||[]).map((x:any)=>[String(x.id),x]));
      const now=(value.sales||[]) as any[];
      const ids=new Set(now.map(x=>String(x.id)));
      const upserts=now.filter(x=>JSON.stringify(before.get(String(x.id)))!==JSON.stringify(x));
      const deletes=[...before.keys()].filter(id=>!ids.has(id));
      if(upserts.length||deletes.length){
        const r=await supabase.rpc('mac_put_sales',{w:walletId,s:storeId,upserts,deletes});
        if(r.error)throw Error(r.error.message);
      }
      const {sales:_l,...docLocal}=value;const {sales:_b,...docBase}=base.value||{};
      let rev=base.revision,next:any=docLocal,saved=false;
      if(JSON.stringify(docLocal)===JSON.stringify(docBase))saved=true;
      for(let i=0;!saved&&i<5;i++){
        const result=await supabase.rpc('mac_put_document',{w:walletId,k:key,s:storeId,v:next,r:rev});
        if(!result.error){rev=result.data;saved=true;break;}
        if(!result.error.message.includes('CONFLICT'))throw Error(result.error.message);
        const remote=await supabase.from('mac_documents').select('value,revision').eq('wallet_id',walletId).eq('key',key).maybeSingle();
        if(remote.error)throw Error(remote.error.message);
        const {sales:_r,...docRemote}=(remote.data?.value as any)||{};
        rev=remote.data?.revision||0;next=mergeChanges(docBase,docLocal,docRemote);
      }
      if(!saved)throw Error('Alterações simultâneas: tenta guardar novamente.');
      // Base keeps only the sales this page knows, so another device's new sale is never mistaken for a deletion.
      cache.set(key,{value:structuredClone({...next,sales:now}),revision:rev});readCache.delete(key);
      return true;
    }
    let next=value,rev=base.revision;
    for(let i=0;i<5;i++){
      const storeId=key.startsWith('store:')?key.slice(6):key.startsWith('status:')?key.slice(7):key.startsWith('attachment:')?value.storeId||'':key.includes('audit-v1:')?key.split('audit-v1:')[1]||'':'';
      const result=await supabase.rpc('mac_put_document',{w:walletId,k:key,s:storeId,v:next,r:rev});
      if(!result.error){cache.set(key,{value:structuredClone(next),revision:result.data});readCache.set(key,{value:structuredClone(next),revision:result.data});return true;}
      if(!result.error.message.includes('CONFLICT'))throw Error(result.error.message);
      const remote=await supabase.from('mac_documents').select('value,revision').eq('wallet_id',walletId).eq('key',key).maybeSingle();
      if(remote.error)throw Error(remote.error.message);
      rev=remote.data?.revision||0;next=mergeChanges(base.value,value,remote.data?.value??null);
    }
    throw Error('Alterações simultâneas: tenta guardar novamente.');
  }
  async function action(name:string,p:any){
    if(name==='ping'){
      const {data:{session}}=await supabase.auth.getSession();
      if(session){const r=await supabase.auth.getUser();if(r.error||!r.data.user)throw Error('Sessão Cloud inválida.');return true;}
      const r=await fetch(`${import.meta.env['VITE_SUPABASE_URL']}/auth/v1/health`,{headers:{apikey:import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY']}});
      if(!r.ok)throw Error('Sem ligação à Cloud.');return true;
    }
    if(name==='session-meta-get'){
      const m=metaGet();if(!m)return null;
      const u=await supabase.auth.getUser();
      if(u.error||!u.data.user||u.data.user.id!==m.userId)return null;
      return m;
    }
    if(name==='session-meta-set'){
      const prev=metaGet();
      window.localStorage.setItem(META_KEY,JSON.stringify({userId:String(p.userId),storeId:String(p.storeId),accessKind:String(p.accessKind||''),page:String(p.page||'dashboard'),at:Math.max(Math.min(Number(p.at)||0,Date.now()),prev?.userId===p.userId?Number(prev.at)||0:0)}));
      return true;
    }
    if(name==='session-meta-clear'){window.localStorage.removeItem(META_KEY);return true;}
    if(name==='directory'){
      const setupAuthorized=await macSetupAuthorization({data:{token:setupToken}});
      if(setupAuthorized){await supabase.auth.signOut({scope:'local'});cache.clear();walletId='';return {wallets:[],accounts:[],stores:[],setupAuthorized:true};}
      const session=await supabase.auth.getUser();
      if(session.error)await supabase.auth.signOut({scope:'local'});
      const directory=session.data.user?await macPrivateDirectory():await macDirectory();
      if(session.data.user){
        try{await identity();joinPhotoChannel();await Promise.race([loadPhotos(),new Promise(r=>setTimeout(r,3000))]);}catch{}
        // Fotografias antigas guardadas só no registo passam para o Storage (sem apagar nada), quando há permissão.
        const legacy:Record<string,string>={};
        for(const s of directory.stores as any[])for(const u of s.users||[])if(u?.id&&!photoPaths[u.id]&&typeof u.photo==='string'&&u.photo.startsWith('data:image/jpeg;base64,'))legacy[u.id]=u.photo;
        applyRegistryPhotos(directory.stores as any[],photos);
        if(Object.keys(legacy).length)void savePhotos(legacy,true);
        if(photoLoad)photoLoad.then(map=>send({macVisionBridge:1,kind:'event',event:'photos-changed',photos:{...map}})).catch(()=>{});
      }
      registryBase=structuredClone(directory.stores);
      return {...directory,setupAuthorized:false};
    }
    if(name==='bootstrap'){
      const result=await macBootstrap({data:{...p,token:setupToken}});
      setupToken='';window.sessionStorage.removeItem('mac-private-setup');
      await startSession(result.session);
      cache.clear();readCache.clear();walletId=result.walletId;return {id:result.id,name:p.name,role:'gestor',isAreaMaster:true,adminRole:'area',carteira:p.wallet,rcAppName:p.appName};
    }
    if(name==='login'){
      await startSession(await macPinLogin({data:{id:String(p.id||''),pin:String(p.password||'')}}));
      cache.clear();readCache.clear();return identity();
    }
    if(name==='logout'){if(photoChannel){void supabase.removeChannel(photoChannel);photoChannel=null;}const u=await supabase.auth.getUser();if(u.data.user)await supabase.from('mac_presence').delete().eq('user_id',u.data.user.id);await supabase.auth.signOut();window.localStorage.removeItem(META_KEY);walletId='';cache.clear();readCache.clear();return true;}
    if(name==='account')return macCreateAccount({data:p});
    if(name==='password')return macUpdatePassword({data:p});
    if(name==='remove-access')return macRemoveAccess({data:p});
    if(name==='registry-save'){
      const prev:Record<string,string>={};for(const s of registryBase)for(const u of s.users||[])if(u?.id&&u.photo)prev[u.id]=u.photo;
      await savePhotos(registryPhotoChanges(p.stores,{},prev));
      const changes=registryChanges(registryBase,p.stores);
      if(changes.length)await macSaveRegistry({data:{stores:changes}});
      registryBase=structuredClone(p.stores);return true;
    }
    if(name==='read'&&p.key==='rc-clean-install-20261110-app-global-settings-v1'){
      const me=await identity();const w=await supabase.from('mac_wallets').select('name,app_name').eq('id',me.wallet_id).single();
      return w.data?{appName:w.data.app_name,carteira:w.data.name}:null;
    }
    if(name==='read'&&['custom-fonts','mac-vision-personalized-error-audio-v1'].includes(p.key)){
      const me=await identity();const r=await supabase.from('profiles').select('preferences').eq('id',me.id).single();
      if(r.error)throw Error(r.error.message);return (r.data.preferences as Record<string,any>)[p.key]??null;
    }
    if(name==='read'){if(p.accept)cache.delete(p.key);return read(p.key);}
    if(name==='write'&&['custom-fonts','mac-vision-personalized-error-audio-v1'].includes(p.key)){
      await identity();const r=await supabase.rpc('mac_set_preference',{k:p.key,v:p.value});if(r.error)throw Error(r.error.message);return true;
    }
    if(name==='write'&&p.key==='rc-clean-install-20261110-app-global-settings-v1')return macUpdateWallet({data:p.value});
    if(name==='write')return write(p.key,p.value);
    if(name==='delete'){
      if(['custom-fonts','mac-vision-personalized-error-audio-v1'].includes(p.key)){
        await identity();const r=await supabase.rpc('mac_set_preference',{k:p.key,v:null});if(r.error)throw Error(r.error.message);return true;
      }
      await identity();const r=await supabase.rpc('mac_delete_document',{w:walletId,k:p.key});
      if(r.error)throw Error(r.error.message);cache.delete(p.key);return true;
    }
    const me=await identity();
    if(name==='preferences'){
      const result=await supabase.from('profiles').select('preferences').eq('id',me.id).single();
      if(result.error)throw Error(result.error.message);return result.data.preferences;
    }
    if(name==='preference'){
      const result=await supabase.rpc('mac_set_preference',{k:p.key,v:p.value});
      if(result.error)throw Error(result.error.message);return true;
    }
    // Ponderação e Comissionamento: um único ficheiro partilhado por várias lojas.
    // Metadados leves (nome, versão, lojas associadas) + catálogo pesado lido só quando a versão muda.
    if(name==='commission-files'){
      const result=await supabase.from('mac_documents').select('value,revision').eq('wallet_id',walletId).eq('key','commission:files').maybeSingle();
      if(result.error)throw Error(result.error.message);
      const files=Array.isArray((result.data?.value as any)?.files)?(result.data!.value as any).files:[];
      return {files,revision:result.data?.revision??0};
    }
    if(name==='commission-read'){
      const result=await supabase.rpc('mac_get_commission',{w:walletId,f:String(p.fileId||'')});
      if(result.error)throw Error(result.error.message);
      return (result.data as any)??null;
    }
    if(name==='commission-save'){
      const fileId=String((p.meta as any)?.id||'');
      const result=await supabase.rpc('mac_put_commission',{w:walletId,meta:p.meta,data:p.data,r:Number(p.revision)||0});
      if(result.error)throw Error(result.error.message.includes('CONFLICT')
        ?'O ficheiro de comissionamento foi alterado noutra sessão. Reabre o popup e tenta novamente.'
        :result.error.message);
      for(const key of ['commission:files','commission:data:'+fileId]){cache.delete(key);readCache.delete(key);}
      return true;
    }
    if(name==='hello'){
      const members=await supabase.from('mac_memberships').select('*');
      const accounts=await supabase.from('mac_accounts').select('id,name');
      const settings=await supabase.from('mac_chat_settings').select('*');
      return {user:{id:me.id},members:(members.data||[]).map(m=>({...m,display_name:accounts.data?.find(a=>a.id===m.user_id)?.name||'',active:true})),settings:Object.fromEntries((settings.data||[]).map(s=>[s.store_id,s.enabled]))};
    }
    if(name==='load'){
      const messages=[];for(let offset=0;;offset+=500){
        const r=await supabase.from('mac_messages').select('*').eq('wallet_id',walletId).order('created_at').order('id').range(offset,offset+499);
        if(r.error)throw Error(r.error.message);messages.push(...r.data);if(r.data.length<500)break;
      }
      const receipts:Record<string,string[]>={};const ownReads:string[]=[];
      for(let offset=0;;offset+=500){const r=await supabase.from('mac_reads').select('message_id,user_id').order('message_id').order('user_id').range(offset,offset+499);
        if(r.error)throw Error(r.error.message);for(const row of r.data){(receipts[row.message_id]||=[]).push(row.user_id);if(row.user_id===me.id)ownReads.push(row.message_id);}if(r.data.length<500)break;
      }
      const presence=await supabase.from('mac_presence').select('*');
      const settings=await supabase.from('mac_chat_settings').select('*');
      return {messages,readIds:ownReads,receipts,presence:Object.fromEntries((presence.data||[]).map(u=>[u.user_id,u.last_seen])),settings:Object.fromEntries((settings.data||[]).map(s=>[s.store_id,s.enabled]))};
    }
    if(name==='send'){
      const result=await supabase.from('mac_messages').insert({wallet_id:walletId,store_id:p.storeId,sender_id:me.id,recipient_id:p.recipientId||null,body:String(p.body).slice(0,1000)});
      if(result.error)throw Error(result.error.message);return true;
    }
    if(name==='read-messages'){
      const result=await supabase.from('mac_reads').upsert((p.ids||[]).map((id:string)=>({message_id:id,user_id:me.id})));
      if(result.error)throw Error(result.error.message);return true;
    }
    // Background chat timers are not human activity; presence is written only by 'human-presence'.
    if(name==='presence')return true;
    if(name==='human-presence'){const at=Math.min(Number(p.at)||Date.now(),Date.now());const r=await supabase.from('mac_presence').upsert({user_id:me.id,wallet_id:me.wallet_id,last_seen:new Date(at).toISOString()});if(r.error)throw Error(r.error.message);return true;}
    if(name==='presence-list'){const r=await supabase.from('mac_presence').select('user_id,last_seen');if(r.error)throw Error(r.error.message);return Object.fromEntries(r.data.map(u=>[u.user_id,u.last_seen]));}
    if(name==='admin-moderate'){const r=await supabase.rpc('mac_moderate_message',{m:String(p.messageId),b:p.body===null?null as any:String(p.body)});if(r.error)throw Error(r.error.message);return true;}
    if(name==='legacy-presence'){const r=await supabase.from('mac_presence').upsert({user_id:me.id,wallet_id:me.wallet_id,last_seen:new Date().toISOString()});if(r.error)throw Error(r.error.message);return true;}
    if(name==='set_store_enabled'){const r=await supabase.from('mac_chat_settings').upsert({store_id:p.storeId,enabled:!!p.enabled});if(r.error)throw Error(r.error.message);return true;}
    if(name==='moderate'){
      const r=await supabase.from('mac_messages').update(p.body===null?{deleted_at:new Date().toISOString()}:{body:String(p.body).slice(0,1000),edited_at:new Date().toISOString()}).eq('id',p.messageId).eq('sender_id',me.id).select('id');
      if(r.error||!r.data?.length)throw Error('Só podes editar as tuas mensagens.');return true;
    }
    if(name==='delete_conversation'){
      const r=await supabase.from('mac_messages').update({deleted_at:new Date().toISOString()}).in('id',p.ids||[]).eq('sender_id',me.id).select('id');
      if(r.error)throw Error(r.error.message);return {count:r.data.length};
    }
    throw Error('Esta operação Cloud ainda não está disponível; nenhum dado foi alterado.');
  }
  async function listener(event:MessageEvent){
    if(event.origin!==window.location.origin||event.source!==frame.contentWindow)return;
    const d=event.data;if(d?.kind!=='request'||(!d.macVisionBridge&&!d.macVisionChatBridge))return;
    const marker=d.macVisionChatBridge?{macVisionChatBridge:1}:{macVisionBridge:1};
    try{const result=await action(d.macVisionChatBridge&&d.action==='read'?'read-messages':d.action,d.payload||{});send({...marker,kind:'response',id:d.id,result});}
    catch(error){send({...marker,kind:'response',id:d.id,error:friendlyError(error instanceof Error?error.message:error)});}
  }
  window.addEventListener('message',listener);
  const onStorage=(e:StorageEvent)=>{
    if(e.key!==META_KEY)return;
    if(!e.newValue){send({macVisionBridge:1,kind:'event',event:'session-ended'});return;}
    try{send({macVisionBridge:1,kind:'event',event:'activity',at:Number(JSON.parse(e.newValue).at)||0});}catch{}
  };
  window.addEventListener('storage',onStorage);
  const channel=supabase.channel(`mac-${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'mac_documents'},payload=>{
    const key='key' in payload.new?String(payload.new['key']):'';
    if(key)readCache.delete(key);else readCache.clear();
    if(!key.startsWith('status:')&&!key.includes('audit-v1'))send({macVisionBridge:1,kind:'event',event:'data-changed',key});
  }).on('postgres_changes',{event:'*',schema:'public',table:'mac_sales'},payload=>{
    const row:any=(payload.new&&'store_id' in payload.new)?payload.new:payload.old;
    const key=row?.store_id?'store:'+row.store_id:'';
    if(key)readCache.delete(key);else readCache.clear();
    send({macVisionBridge:1,kind:'event',event:'data-changed',key});
  }).on('postgres_changes',{event:'*',schema:'public',table:'mac_messages'},payload=>{
    send({macVisionChatBridge:1,kind:'event',event:'messages-changed'});
    const m=payload.new as any;
    if(payload.eventType==='INSERT'&&m?.id)send({macVisionBridge:1,kind:'event',event:'message-new',message:{id:m.id,sender_id:m.sender_id,recipient_id:m.recipient_id}});
  }).on('postgres_changes',{event:'*',schema:'public',table:'mac_reads'},()=>send({macVisionChatBridge:1,kind:'event',event:'messages-changed'})).on('postgres_changes',{event:'*',schema:'public',table:'profiles'},()=>send({macVisionBridge:1,kind:'event',event:'preferences-changed'})).on('postgres_changes',{event:'*',schema:'public',table:'mac_accounts'},()=>send({macVisionBridge:1,kind:'event',event:'registry-changed'})).on('postgres_changes',{event:'*',schema:'public',table:'mac_wallets'},()=>send({macVisionBridge:1,kind:'event',event:'registry-changed'})).on('postgres_changes',{event:'*',schema:'public',table:'mac_stores'},()=>send({macVisionBridge:1,kind:'event',event:'registry-changed'})).on('postgres_changes',{event:'*',schema:'public',table:'mac_memberships'},()=>send({macVisionBridge:1,kind:'event',event:'registry-changed'})).on('postgres_changes',{event:'*',schema:'public',table:'mac_chat_settings'},()=>send({macVisionChatBridge:1,kind:'event',event:'messages-changed'})).on('postgres_changes',{event:'*',schema:'public',table:'mac_presence'},()=>send({macVisionChatBridge:1,kind:'event',event:'presence-changed'})).subscribe(status=>{
    const live=status==='SUBSCRIBED';
    // Any gap in Realtime may hide changes: drop the cache and let the document re-read from Cloud.
    if(!live||!realtimeLive)readCache.clear();
    if(live&&!realtimeLive)send({macVisionBridge:1,kind:'event',event:'data-changed'});
    realtimeLive=live;
  });
  return ()=>{window.removeEventListener('message',listener);window.removeEventListener('storage',onStorage);void supabase.removeChannel(channel);if(photoChannel)void supabase.removeChannel(photoChannel);};
}