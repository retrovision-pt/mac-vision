import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { createClient } from '@supabase/supabase-js';
import { hashPin, verifyPin, isValidPin, internalSecret, friendlyError } from './mac-pin';
import { normalizeUsername, normalizeWallet, loginAddress, authorizeAccountCreation, hasValidAreaManager, canStartWalletSetup, canStartPreviewSetup } from './mac-rules';

async function setupDigest(token:string) {
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export const macSetupAuthorization=createServerFn({method:'POST'})
 .inputValidator((input:{token:string})=>input).handler(async({data})=>{
  const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
  const {grant,allowed}=await setupPermission(admin,data.token);
  return allowed && canStartWalletSetup(grant,Date.now(),false);
 });

async function setupPermission(admin:any,token:string){
 // A stale or consumed private link kept in the browser must not hide the
 // development-only reset grant; production still needs a valid private link.
 if(token){
  const own=await grantPermission(admin,token);
  if(own.allowed&&canStartWalletSetup(own.grant,Date.now(),false))return own;
  if(!import.meta.env.DEV)return own;
 }
 return grantPermission(admin,'');
}
async function grantPermission(admin:any,token:string){
 const hash=await setupDigest(token || (import.meta.env.DEV ? pepper()+':mac-preview-reset-20261112' : ''));
 const grant=checked(await admin.from('mac_setup_grants').select('expires_at,consumed_by,preview_only').eq('token_hash',hash).maybeSingle()).data;
 if(!grant)return {hash,grant,allowed:false};
 if(!grant.preview_only)return {hash,grant,allowed:!!token};
 const wallets=checked(await admin.from('mac_wallets').select('id,owner_id')).data||[];
 const accounts=checked(await admin.from('mac_accounts').select('id,wallet_id,role')).data||[];
 const roles=checked(await admin.from('user_roles').select('user_id,role')).data||[];
 return {hash,grant,allowed:canStartPreviewSetup(import.meta.env.DEV,wallets.some((w:any)=>hasValidAreaManager(w,accounts,roles)),grant,Date.now())};
}


function checked<T extends { error: any }>(result: T): T {
  if (result.error) { console.error('MAC Cloud error', result.error.message); throw new Error(friendlyError(result.error.message)); }
  return result;
}
function pepper(){
 const value=process.env['MAC_PIN_PEPPER'];
 if(!value)throw Error('Configuração de segurança em falta.');
 return value;
}
function publicAuthClient(){
 const key=process.env['SUPABASE_PUBLISHABLE_KEY']!;
 return createClient(process.env['SUPABASE_URL']!,key,{auth:{persistSession:false,autoRefreshToken:false,storage:undefined},global:{fetch:(input,init)=>{
  const h=new Headers(init?.headers);
  if(key.startsWith('sb_')&&h.get('Authorization')===`Bearer ${key}`)h.delete('Authorization');
  h.set('apikey',key);return fetch(input,{...init,headers:h});
 }}});
}
async function storePin(admin:any,id:string,pin:string){
 checked(await admin.from('mac_pin_credentials').upsert({user_id:id,pin_hash:await hashPin(pin,pepper()),updated_at:new Date().toISOString()}));
}
// Issues a real Auth session only after the server has verified the PIN; no email is sent.
async function issueSession(admin:any,id:string){
 const link=await admin.auth.admin.generateLink({type:'magiclink',email:loginAddress(id)});
 if(link.error||!link.data?.properties?.hashed_token){console.error('MAC session link failed',link.error?.message);throw Error('Não foi possível iniciar sessão na Cloud. Tenta novamente.');}
 const verified=await publicAuthClient().auth.verifyOtp({type:'email',token_hash:link.data.properties.hashed_token});
 if(verified.error||!verified.data.session){console.error('MAC session verify failed',verified.error?.message);throw Error('Não foi possível iniciar sessão na Cloud. Tenta novamente.');}
 return {access_token:verified.data.session.access_token,refresh_token:verified.data.session.refresh_token};
}
async function createIdentity(admin:any,id:string,name:string){
 const result=await admin.auth.admin.createUser({id,email:loginAddress(id),password:internalSecret(),email_confirm:true,user_metadata:{display_name:name}});
 if(result.error){console.error('MAC identity creation failed',result.error.message);throw Error('Não foi possível criar o acesso na Cloud. Tenta novamente.');}
}
async function removeIdentity(admin:any,id:string){
 await admin.from('mac_pin_credentials').delete().eq('user_id',id);
 const cleanup=await admin.auth.admin.deleteUser(id);if(cleanup.error)console.error('New identity cleanup failed');
}
export const macDirectory = createServerFn({method:'GET'}).handler(async () => {
  const { supabaseAdmin: admin } = await import('@/integrations/supabase/client.server');
   const allWallets = checked(await admin.from('mac_wallets').select('id,name,app_name,owner_id')).data || [];
  const stores = checked(await admin.from('mac_stores').select('id,wallet_id,name')).data || [];
  const accounts = checked(await admin.from('mac_accounts').select('id,wallet_id,name,role')).data || [];
  const members = checked(await admin.from('mac_memberships').select('user_id,store_id,role')).data || [];
   const roles=checked(await admin.from('user_roles').select('user_id,role')).data||[];
   const wallets=allWallets.filter(w=>hasValidAreaManager(w,accounts,roles));
  return {wallets, accounts:accounts.map(a=>({id:a.id,name:a.name,wallet_id:a.wallet_id,role:a.role})), stores:stores.map(s=>({...s, users:members.filter(m=>m.store_id===s.id).flatMap(m=>{
    const a=accounts.find(a=>a.id===m.user_id); return a?[{id:a.id,name:a.name,role:a.role==='colaborador'?'colaborador':'gestor',employee:a.role==='colaborador'?a.name:'',isAreaMaster:a.role==='admin',adminRole:a.role==='admin'?'area':undefined}]:[];
  })}))};
});

export const macBootstrap = createServerFn({method:'POST'})
  .inputValidator((input:{name:string;wallet:string;appName:string;password:string;token:string})=>input)
 .handler(async({data})=>{
  const wallet=normalizeWallet(data.wallet),name=data.name.trim();
   if(!/^[A-Z0-9_-]{1,20}$/.test(wallet)||name.length<2||name.length>90||data.appName.trim().length<2||data.appName.trim().length>70||!isValidPin(data.password))throw Error('Preenche os campos obrigatórios; a password deve ter, no mínimo, 4 números.');
  const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
   const {hash,grant,allowed}=await setupPermission(admin,data.token||'');
   const exists=checked(await admin.from('mac_wallets').select('id').ilike('name',wallet).limit(1)).data;
   if(!allowed||!canStartWalletSetup(grant,Date.now(),!!exists?.length))throw Error('Configuração não autorizada ou carteira já existente.');
  const id=crypto.randomUUID();
  await createIdentity(admin,id,name);
   let assigned=false;
   try{
   await storePin(admin,id,data.password);
   // Auth and application data use separate transactions. Only the new, unassigned
   // identity is compensated if the atomic application transaction fails.
   const completed=await admin.rpc('mac_complete_setup',{t:hash,u:id,wallet_name:wallet,application_name:data.appName.trim(),ga_name:name,ga_username:normalizeUsername(name)});
   if(completed.error)throw Error(friendlyError(completed.error.message));
   assigned=true;
   return {id,walletId:completed.data as string,session:await issueSession(admin,id)};
  }catch(error){if(!assigned)await removeIdentity(admin,id);throw error;}
 });

export const macPinLogin = createServerFn({method:'POST'})
 .inputValidator((input:{id:string;pin:string})=>input)
 .handler(async({data})=>{
  const generic='Password incorreta.';
  if(!/^[0-9a-f-]{36}$/i.test(String(data.id))||!isValidPin(data.pin))throw Error(generic);
  const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
  const account=checked(await admin.from('mac_accounts').select('id').eq('id',data.id).maybeSingle()).data;
  if(!account)throw Error(generic);
  const locked=checked(await admin.rpc('mac_pin_attempt',{u:data.id})).data as string|null;
  if(locked){const minutes=Math.max(1,Math.ceil((Date.parse(locked)-Date.now())/60000));throw Error(`Acesso bloqueado temporariamente por excesso de tentativas. Tenta novamente dentro de ${minutes} minuto${minutes===1?'':'s'}.`);}
  const cred=checked(await admin.from('mac_pin_credentials').select('pin_hash').eq('user_id',data.id).maybeSingle()).data;
  let ok=false;
  if(cred)ok=await verifyPin(data.pin,cred.pin_hash,pepper());
  else{
   // One-time upgrade of accounts created before PIN credentials existed.
   const legacy=await publicAuthClient().auth.signInWithPassword({email:loginAddress(data.id),password:data.pin});
   ok=!legacy.error&&!!legacy.data.session;
   if(ok){await storePin(admin,data.id,data.pin);checked(await admin.auth.admin.updateUserById(data.id,{password:internalSecret()}));}
  }
  if(!ok)throw Error(generic);
  checked(await admin.rpc('mac_pin_success',{u:data.id}));
  return issueSession(admin,data.id);
 });

export const macCreateAccount = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((input:{name:string;role:string;password:string;employee?:string})=>input)
 .handler(async({data,context})=>{
  const actor=checked(await context.supabase.from('mac_accounts').select('*').eq('id',context.userId).single()).data;
  if(!actor||!authorizeAccountCreation(actor.role,data.role))throw Error('Sem permissão para criar este acesso.');
  if(data.name.trim().length<2)throw Error('Indica o nome do utilizador.');
  if(!isValidPin(data.password))throw Error('A password deve ter, no mínimo, 4 números.');
  const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
  const id=crypto.randomUUID();
  await createIdentity(admin,id,data.name.trim());
  try{
   await storePin(admin,id,data.password);
   checked(await admin.from('mac_accounts').insert({id,wallet_id:actor.wallet_id,name:data.name.trim(),username:normalizeUsername(data.name),role:data.role}));
   checked(await admin.from('user_roles').insert({user_id:id,role:data.role}));
  }catch(error){await admin.from('mac_accounts').delete().eq('id',id);await removeIdentity(admin,id);throw error;}
  return {id,name:data.name.trim(),role:data.role==='admin'?'gestor':data.role,employee:data.employee||'',isAreaMaster:data.role==='admin',adminRole:data.role==='admin'?'area':undefined};
 });

export const macSaveRegistry = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((input:{stores:any[]})=>input)
 .handler(async({data,context})=>{
  const actor=checked(await context.supabase.from('mac_accounts').select('*').eq('id',context.userId).single()).data;
  if(!actor||actor.role==='colaborador')throw Error('Sem permissão.');
  const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
  checked(await admin.rpc('mac_save_registry',{a:context.userId,items:data.stores}));
  return true;
 });

export const macUpdatePassword = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((input:{id:string;password:string;storeId:string})=>input)
 .handler(async({data,context})=>{
  const actor=checked(await context.supabase.from('mac_accounts').select('*').eq('id',context.userId).single()).data;
  const target=checked(await context.supabase.from('mac_accounts').select('*').eq('id',data.id).single()).data;
  const membership=checked(await context.supabase.from('mac_memberships').select('role').eq('store_id',data.storeId).eq('user_id',context.userId).maybeSingle()).data;
  const targetMember=checked(await context.supabase.from('mac_memberships').select('user_id').eq('store_id',data.storeId).eq('user_id',data.id).maybeSingle()).data;
  if(!actor||!target||actor.wallet_id!==target.wallet_id||!(actor.role==='admin'||(membership?.role==='gestor'&&target.role==='colaborador'&&targetMember)))throw Error('Sem permissão para alterar esta password.');
  if(!isValidPin(data.password))throw Error('A password deve ter, no mínimo, 4 números.');
  const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
  await storePin(admin,target.id,data.password);
  checked(await admin.rpc('mac_pin_success',{u:target.id}));
  checked(await admin.auth.admin.updateUserById(target.id,{password:internalSecret()}));
  return true;
 });

export const macPrivateDirectory = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const wallets=checked(await context.supabase.from('mac_wallets').select('id,name,app_name')).data||[];
 const stores=checked(await context.supabase.from('mac_stores').select('*')).data||[];
 const accounts=checked(await context.supabase.from('mac_accounts').select('id,wallet_id,name,role')).data||[];
 const members=checked(await context.supabase.from('mac_memberships').select('*')).data||[];
 return {wallets,accounts,stores:stores.map(s=>({...s.metadata as object,id:s.id,name:s.name,wallet_id:s.wallet_id,users:members.filter(m=>m.store_id===s.id).flatMap(m=>{
  const a=accounts.find(a=>a.id===m.user_id);return a?[{...m.metadata as object,id:a.id,name:a.name,role:a.role==='colaborador'?'colaborador':'gestor',isAreaMaster:a.role==='admin',adminRole:a.role==='admin'?'area':undefined}]:[];
 })}))};
});

export const macUpdateWallet = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((input:{appName:string;carteira:string})=>input).handler(async({data,context})=>{
 const actor=checked(await context.supabase.from('mac_accounts').select('*').eq('id',context.userId).single()).data;
 if(!actor||actor.role!=='admin')throw Error('Apenas o administrador pode alterar a carteira.');
 const name=normalizeWallet(data.carteira);if(!/^[A-Z0-9_-]{1,20}$/.test(name)||data.appName.trim().length<2)throw Error('Indica um nome de aplicação e de carteira válidos.');
 const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
 checked(await admin.from('mac_wallets').update({name,app_name:data.appName.trim()}).eq('id',actor.wallet_id));return true;
});