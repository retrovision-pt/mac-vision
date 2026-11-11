import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { normalizeUsername, normalizeWallet, loginAddress, authorizeAccountCreation } from './mac-rules';

function checked<T extends { error: any }>(result: T): T {
  if (result.error) throw new Error(result.error.message);
  return result;
}
export const macDirectory = createServerFn({method:'GET'}).handler(async () => {
  const { supabaseAdmin: admin } = await import('@/integrations/supabase/client.server');
  const wallets = checked(await admin.from('mac_wallets').select('id,name,app_name')).data || [];
  const stores = checked(await admin.from('mac_stores').select('id,wallet_id,name')).data || [];
  const accounts = checked(await admin.from('mac_accounts').select('id,wallet_id,name,role')).data || [];
  const members = checked(await admin.from('mac_memberships').select('user_id,store_id,role')).data || [];
  return {wallets, accounts:accounts.map(a=>({id:a.id,name:a.name,wallet_id:a.wallet_id,role:a.role})), stores:stores.map(s=>({...s, users:members.filter(m=>m.store_id===s.id).flatMap(m=>{
    const a=accounts.find(a=>a.id===m.user_id); return a?[{id:a.id,name:a.name,role:a.role==='colaborador'?'colaborador':'gestor',employee:a.role==='colaborador'?a.name:'',isAreaMaster:a.role==='admin',adminRole:a.role==='admin'?'area':undefined}]:[];
  })}))};
});

export const macBootstrap = createServerFn({method:'POST'})
 .inputValidator((input:{name:string;wallet:string;appName:string;password:string})=>input)
 .handler(async({data})=>{
  const wallet=normalizeWallet(data.wallet),name=data.name.trim();
  if(!/^[A-Z0-9_-]{1,20}$/.test(wallet)||name.length<2||!/^\d{4,}$/.test(data.password))throw Error('Preenche os campos obrigatórios.');
  const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
  const id=crypto.randomUUID();
  checked(await admin.rpc('mac_reserve_bootstrap',{u:id}));
  const result=await admin.auth.admin.createUser({id,email:loginAddress(id),password:data.password,email_confirm:true,user_metadata:{display_name:name}});
  if(result.error)throw Error(result.error.message);
  const w=checked(await admin.from('mac_wallets').insert({name:wallet,app_name:data.appName.trim(),owner_id:id}).select().single()).data;
  if(!w)throw Error('Não foi possível criar carteira.');
  checked(await admin.from('mac_accounts').insert({id,wallet_id:w.id,name,username:normalizeUsername(name),role:'admin'}));
  checked(await admin.from('user_roles').insert({user_id:id,role:'admin'}));
  return {id,walletId:w.id,email:loginAddress(id)};
 });

export const macCreateAccount = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((input:{name:string;role:string;password:string;employee?:string})=>input)
 .handler(async({data,context})=>{
  const actor=checked(await context.supabase.from('mac_accounts').select('*').eq('id',context.userId).single()).data;
  if(!actor||!authorizeAccountCreation(actor.role,data.role))throw Error('Sem permissão para criar este acesso.');
  if(!/^\d{4,}$/.test(data.password)||data.name.trim().length<2)throw Error('Nome ou password inválidos.');
  const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
  const id=crypto.randomUUID();
  checked(await admin.auth.admin.createUser({id,email:loginAddress(id),password:data.password,email_confirm:true,user_metadata:{display_name:data.name.trim()}}));
  checked(await admin.from('mac_accounts').insert({id,wallet_id:actor.wallet_id,name:data.name.trim(),username:normalizeUsername(data.name),role:data.role}));
  checked(await admin.from('user_roles').insert({user_id:id,role:data.role}));
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
  if(!/^\d{4,}$/.test(data.password))throw Error('Password inválida.');
  const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
  checked(await admin.auth.admin.updateUserById(target.id,{password:data.password}));
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
 if(!actor||actor.role!=='admin')throw Error('Apenas administrador');
 const name=normalizeWallet(data.carteira);if(!/^[A-Z0-9_-]{1,20}$/.test(name)||data.appName.trim().length<2)throw Error('Nome inválido');
 const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
 checked(await admin.from('mac_wallets').update({name,app_name:data.appName.trim()}).eq('id',actor.wallet_id));return true;
});