import { supabase } from '@/integrations/supabase/client';
import { macBootstrap, macSetupAuthorization, macCreateAccount, macDirectory, macPrivateDirectory, macSaveRegistry, macUpdatePassword, macUpdateWallet, macPinLogin, macRemoveAccess } from './mac.functions';
import { mergeChanges, registryChanges } from './mac-rules';
import { friendlyError } from './mac-pin';

export function mountMacBridge(frame: HTMLIFrameElement) {
  const cache = new Map<string,{value:any;revision:number}>();
  let registryBase:any[]=[];
  let setupToken=new URLSearchParams(window.location.hash.slice(1)).get('configurar')||'';
  if(setupToken){window.sessionStorage.setItem('mac-private-setup',setupToken);window.history.replaceState(null,'',window.location.pathname+window.location.search);}
  else setupToken=window.sessionStorage.getItem('mac-private-setup')||'';
  let walletId='';
  const send=(data:any)=>frame.contentWindow?.postMessage(data,window.location.origin);
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
  async function read(key:string){
    await identity();
    const result=await supabase.from('mac_documents').select('value,revision').eq('wallet_id',walletId).eq('key',key).maybeSingle();
    if(result.error)throw Error(result.error.message);
    if(!cache.has(key))cache.set(key,{value:structuredClone(result.data?.value??null),revision:result.data?.revision??0});
    return result.data?.value??null;
  }
  async function write(key:string,value:any){
    await identity();
    if(!cache.has(key))await read(key);
    const base=cache.get(key)||{value:null,revision:0};
    let next=value,rev=base.revision;
    for(let i=0;i<5;i++){
      const storeId=key.startsWith('store:')?key.slice(6):key.startsWith('status:')?key.slice(7):key.startsWith('attachment:')?value.storeId||'':key.includes('audit-v1:')?key.split('audit-v1:')[1]||'':'';
      const result=await supabase.rpc('mac_put_document',{w:walletId,k:key,s:storeId,v:next,r:rev});
      if(!result.error){cache.set(key,{value:structuredClone(next),revision:result.data});return true;}
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
    if(name==='directory'){
      const setupAuthorized=await macSetupAuthorization({data:{token:setupToken}});
      if(setupAuthorized){await supabase.auth.signOut({scope:'local'});cache.clear();walletId='';return {wallets:[],accounts:[],stores:[],setupAuthorized:true};}
      const session=await supabase.auth.getUser();
      if(session.error)await supabase.auth.signOut({scope:'local'});
      const directory=session.data.user?await macPrivateDirectory():await macDirectory();
      registryBase=structuredClone(directory.stores);
      return {...directory,setupAuthorized:false};
    }
    if(name==='bootstrap'){
      const result=await macBootstrap({data:{...p,token:setupToken}});
      setupToken='';window.sessionStorage.removeItem('mac-private-setup');
      await startSession(result.session);
      cache.clear();walletId=result.walletId;return {id:result.id,name:p.name,role:'gestor',isAreaMaster:true,adminRole:'area',carteira:p.wallet,rcAppName:p.appName};
    }
    if(name==='login'){
      await startSession(await macPinLogin({data:{id:String(p.id||''),pin:String(p.password||'')}}));
      cache.clear();return identity();
    }
    if(name==='logout'){const u=await supabase.auth.getUser();if(u.data.user)await supabase.from('mac_presence').delete().eq('user_id',u.data.user.id);await supabase.auth.signOut();walletId='';cache.clear();return true;}
    if(name==='account')return macCreateAccount({data:p});
    if(name==='password')return macUpdatePassword({data:p});
    if(name==='remove-access')return macRemoveAccess({data:p});
    if(name==='registry-save'){
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
  const channel=supabase.channel(`mac-${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'mac_documents'},payload=>{
    const key='key' in payload.new?String(payload.new['key']):'';
    if(!key.startsWith('status:'))send({macVisionBridge:1,kind:'event',event:'data-changed'});
  }).on('postgres_changes',{event:'*',schema:'public',table:'mac_messages'},()=>send({macVisionChatBridge:1,kind:'event',event:'messages-changed'})).on('postgres_changes',{event:'*',schema:'public',table:'mac_reads'},()=>send({macVisionChatBridge:1,kind:'event',event:'messages-changed'})).on('postgres_changes',{event:'*',schema:'public',table:'profiles'},()=>send({macVisionBridge:1,kind:'event',event:'preferences-changed'})).on('postgres_changes',{event:'*',schema:'public',table:'mac_accounts'},()=>send({macVisionBridge:1,kind:'event',event:'registry-changed'})).on('postgres_changes',{event:'*',schema:'public',table:'mac_wallets'},()=>send({macVisionBridge:1,kind:'event',event:'registry-changed'})).on('postgres_changes',{event:'*',schema:'public',table:'mac_stores'},()=>send({macVisionBridge:1,kind:'event',event:'registry-changed'})).on('postgres_changes',{event:'*',schema:'public',table:'mac_memberships'},()=>send({macVisionBridge:1,kind:'event',event:'registry-changed'})).on('postgres_changes',{event:'*',schema:'public',table:'mac_chat_settings'},()=>send({macVisionChatBridge:1,kind:'event',event:'messages-changed'})).on('postgres_changes',{event:'*',schema:'public',table:'mac_presence'},()=>send({macVisionChatBridge:1,kind:'event',event:'presence-changed'})).subscribe();
  return ()=>{window.removeEventListener('message',listener);void supabase.removeChannel(channel);};
}