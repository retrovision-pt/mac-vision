import { supabase } from '@/integrations/supabase/client';
import { macBootstrap, macCreateAccount, macDirectory, macSaveRegistry } from './mac.functions';
import { loginAddress, mergeChanges } from './mac-rules';

export function mountMacBridge(frame: HTMLIFrameElement) {
  const cache = new Map<string,{value:any;revision:number}>();
  let walletId='';
  const send=(data:any)=>frame.contentWindow?.postMessage(data,window.location.origin);
  async function identity(){
    const {data,error}=await supabase.auth.getUser();
    if(error||!data.user)throw Error('Inicia sessão na Cloud.');
    const account=await supabase.from('mac_accounts').select('*').eq('id',data.user.id).single();
    if(account.error||!account.data)throw Error('Conta sem carteira.');
    walletId=account.data.wallet_id;return account.data;
  }
  async function read(key:string){
    await identity();
    const result=await supabase.from('mac_documents').select('value,revision').eq('wallet_id',walletId).eq('key',key).maybeSingle();
    if(result.error)throw Error(result.error.message);
    cache.set(key,{value:result.data?.value??null,revision:result.data?.revision??0});
    return result.data?.value??null;
  }
  async function write(key:string,value:any){
    await identity();
    const base=cache.get(key)||{value:null,revision:0};
    let next=value,rev=base.revision;
    for(let i=0;i<5;i++){
      const result=await supabase.rpc('mac_put_document',{w:walletId,k:key,s:key.startsWith('store:')?key.slice(6):key.startsWith('status:')?key.slice(7):'',v:next,r:rev});
      if(!result.error){cache.set(key,{value:structuredClone(next),revision:result.data});return true;}
      if(!result.error.message.includes('CONFLICT'))throw Error(result.error.message);
      const remote=await read(key);rev=cache.get(key)?.revision||0;next=mergeChanges(base.value,value,remote);
    }
    throw Error('Alterações simultâneas: tenta guardar novamente.');
  }
  async function action(name:string,p:any){
    if(name==='directory')return macDirectory();
    if(name==='bootstrap'){
      const result=await macBootstrap({data:p});
      const login=await supabase.auth.signInWithPassword({email:result.email,password:p.password});
      if(login.error)throw Error(login.error.message);
      walletId=result.walletId;return {id:result.id,name:p.name,role:'gestor',isAreaMaster:true,adminRole:'area',carteira:p.wallet,rcAppName:p.appName};
    }
    if(name==='login'){
      const result=await supabase.auth.signInWithPassword({email:loginAddress(p.id),password:p.password});
      if(result.error)throw Error('Password incorreta.');
      return identity();
    }
    if(name==='logout'){await supabase.auth.signOut();walletId='';cache.clear();return true;}
    if(name==='account')return macCreateAccount({data:p});
    if(name==='registry-save')return macSaveRegistry({data:{stores:p.stores}});
    if(name==='read')return read(p.key);
    if(name==='write')return write(p.key,p.value);
    if(name==='delete')throw Error('A eliminação Cloud requer autorização específica; nenhum dado foi apagado.');
    const me=await identity();
    if(name==='preferences'){
      const result=await supabase.from('profiles').select('preferences').eq('id',me.id).single();
      if(result.error)throw Error(result.error.message);return result.data.preferences;
    }
    if(name==='preference'){
      const existing=await supabase.from('profiles').select('preferences').eq('id',me.id).single();
      if(existing.error)throw Error(existing.error.message);
      const result=await supabase.from('profiles').update({preferences:{...(existing.data.preferences as object),[p.key]:p.value}}).eq('id',me.id);
      if(result.error)throw Error(result.error.message);return true;
    }
    if(name==='hello'){
      const members=await supabase.from('mac_memberships').select('*');
      const accounts=await supabase.from('mac_accounts').select('id,name');
      return {user:{id:me.id},members:(members.data||[]).map(m=>({...m,display_name:accounts.data?.find(a=>a.id===m.user_id)?.name||'',active:true})),settings:{}};
    }
    if(name==='load'){
      const messages=await supabase.from('mac_messages').select('*').eq('wallet_id',walletId).order('created_at').limit(1000);
      if(messages.error)throw Error(messages.error.message);
      const reads=await supabase.from('mac_reads').select('message_id');
      return {messages:messages.data,readIds:reads.data?.map(r=>r.message_id)||[],receipts:{},presence:{},settings:{}};
    }
    if(name==='send'){
      const result=await supabase.from('mac_messages').insert({wallet_id:walletId,store_id:p.storeId,sender_id:me.id,recipient_id:p.recipientId||null,body:String(p.body).slice(0,1000)});
      if(result.error)throw Error(result.error.message);return true;
    }
    if(name==='read-messages'){
      const result=await supabase.from('mac_reads').upsert((p.ids||[]).map((id:string)=>({message_id:id,user_id:me.id})));
      if(result.error)throw Error(result.error.message);return true;
    }
    if(name==='presence')return true;
    throw Error('Esta operação Cloud ainda não está disponível; nenhum dado foi alterado.');
  }
  async function listener(event:MessageEvent){
    if(event.origin!==window.location.origin||event.source!==frame.contentWindow)return;
    const d=event.data;if(d?.kind!=='request'||(!d.macVisionBridge&&!d.macVisionChatBridge))return;
    const marker=d.macVisionChatBridge?{macVisionChatBridge:1}:{macVisionBridge:1};
    try{const result=await action(d.macVisionChatBridge&&d.action==='read'?'read-messages':d.action,d.payload||{});send({...marker,kind:'response',id:d.id,result});}
    catch(error){send({...marker,kind:'response',id:d.id,error:error instanceof Error?error.message:'Erro Cloud'});}
  }
  window.addEventListener('message',listener);
  const channel=supabase.channel(`mac-${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'mac_documents'},()=>send({macVisionBridge:1,kind:'event',event:'data-changed'})).on('postgres_changes',{event:'*',schema:'public',table:'mac_messages'},()=>send({macVisionChatBridge:1,kind:'event',event:'messages-changed'})).subscribe();
  return ()=>{window.removeEventListener('message',listener);void supabase.removeChannel(channel);};
}