import { describe,it,expect,vi,beforeEach } from 'vitest';
const mocks=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn(),update:vi.fn(),upsert:vi.fn(),verify:vi.fn(),legacy:vi.fn(),generate:vi.fn(),otp:vi.fn()}));
vi.mock('@tanstack/react-start',()=>({createServerFn:()=>{const builder={inputValidator:()=>builder,middleware:()=>builder,handler:(fn:unknown)=>fn};return builder;}}));
vi.mock('@/integrations/supabase/auth-middleware',()=>({requireSupabaseAuth:{}}));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{from:mocks.from,rpc:mocks.rpc,auth:{admin:{updateUserById:mocks.update,generateLink:mocks.generate}}}}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{signInWithPassword:mocks.legacy,verifyOtp:mocks.otp}})}));
vi.mock('./mac-pin',async()=>({...await vi.importActual('./mac-pin'),verifyPin:mocks.verify}));
import {macPinLogin} from './mac.functions';
const login=macPinLogin as unknown as (input:{data:{id:string;pin:string}})=>Promise<unknown>;
describe('Login never changes credentials',()=>{
 beforeEach(()=>{
  vi.clearAllMocks();vi.stubEnv('MAC_PIN_PEPPER','unit-test-only');
  mocks.rpc.mockResolvedValue({error:null,data:null});mocks.verify.mockResolvedValue(true);
  mocks.generate.mockResolvedValue({data:{properties:{hashed_token:'unit-token'}}});
  mocks.otp.mockResolvedValue({data:{session:{access_token:'unit-access',refresh_token:'unit-refresh'}}});
 });
 for(const legacy of [false,true])it(legacy?'validates a legacy password without upgrading or replacing it':'validates a four-digit PIN without writing its hash',async()=>{
  mocks.from.mockImplementation((table:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>({error:null,data:table==='mac_accounts'?{id:'c84cdb63-5fee-477d-a7c0-603499a1adfd'}:legacy?null:{pin_hash:'existing'}})})}),upsert:mocks.upsert}));
  mocks.legacy.mockResolvedValue({error:null,data:{session:{}}});
  await login({data:{id:'c84cdb63-5fee-477d-a7c0-603499a1adfd',pin:'1234'}});
  expect(mocks.update).not.toHaveBeenCalled();expect(mocks.upsert).not.toHaveBeenCalled();
  expect(mocks.rpc).toHaveBeenCalledWith('mac_pin_success',{u:'c84cdb63-5fee-477d-a7c0-603499a1adfd'});
 });
 it('rejects a collaborator outside the schedule window after the password is checked',async()=>{
  mocks.from.mockImplementation((table:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>({error:null,data:table==='mac_accounts'?{id:'c84cdb63-5fee-477d-a7c0-603499a1adfd'}:{pin_hash:'existing'}})})})}));
  mocks.rpc.mockImplementation(async(name:string)=>name==='mac_shift_status'?{error:null,data:{allowed:false,reason:'before'}}:{error:null,data:null});
  await expect(login({data:{id:'c84cdb63-5fee-477d-a7c0-603499a1adfd',pin:'1234',storeId:'loja-x'}} as any)).rejects.toThrow('MAC_SHIFT:O teu acesso estará disponível 15 minutos antes do início do turno.');
  expect(mocks.generate).not.toHaveBeenCalled();
 });
 it('reports a Cloud failure as a connection problem, not a permission problem',async()=>{
  mocks.from.mockImplementation((table:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>({error:null,data:table==='mac_accounts'?{id:'c84cdb63-5fee-477d-a7c0-603499a1adfd'}:{pin_hash:'existing'}})})})}));
  mocks.rpc.mockImplementation(async(name:string)=>name==='mac_shift_status'?{error:{message:'timeout'},data:null}:{error:null,data:null});
  await expect(login({data:{id:'c84cdb63-5fee-477d-a7c0-603499a1adfd',pin:'1234',storeId:'loja-x'}} as any)).rejects.toThrow('Não foi possível verificar o horário na Cloud. Tenta novamente.');
 });
});
