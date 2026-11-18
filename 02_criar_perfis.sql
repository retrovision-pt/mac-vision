-- MAC Vision · executar no Supabase SQL Editor após criar as contas em Authentication → Users.
-- Nunca colocar passwords aqui nem enviar ficheiros com dados de utilizadores para um GitHub público.

-- 1) ADMINISTRADOR INICIAL
-- Substituir EMAIL_DO_ADMIN pela conta Supabase Auth que vai administrar o MAC Vision.
-- Se ainda não existir essa conta em Authentication → Users, criar primeiro.
-- Não executar até confirmar o email da conta com privilégios de administrador.

insert into public.mac_vision_profiles(user_id,display_name,role,app_user_id)
select id,'Administrador MAC Vision','admin',null
from auth.users where lower(email)=lower('EMAIL_DO_ADMIN')
on conflict(user_id) do update set role='admin',display_name=excluded.display_name;

-- 2) DEPOIS DO ONBOARDING, LISTAR OS IDs DAS LOJAS E DOS UTILIZADORES:
-- select shop_id,data->>'name' as nome from public.mac_vision_directory order by nome;
-- select shop->>'name' as loja,u->>'name' as pessoa,u->>'id' as app_user_id,u->>'role' as perfil
-- from public.mac_vision_docs d,
--      jsonb_array_elements(d.data) shop,
--      jsonb_array_elements(shop->'users') u
-- where d.key='rc-clean-install-20261110-registry-v2';

-- 3) CRIAR UM UTILIZADOR (EXEMPLO):
-- Substituir EMAIL_COLABORADOR, NOME, ID_DA_APP, ID_DA_LOJA.
-- O ID_DA_APP é o ID mostrado na consulta acima, não o UUID do Supabase.
/*
insert into public.mac_vision_profiles(user_id,display_name,role,app_user_id)
select id,'NOME','colaborador','ID_DA_APP'
from auth.users where lower(email)=lower('EMAIL_COLABORADOR')
on conflict(user_id) do update set display_name=excluded.display_name,role=excluded.role,app_user_id=excluded.app_user_id;

insert into public.mac_vision_shop_access(user_id,shop_id,can_write)
select id,'ID_DA_LOJA',true from auth.users where lower(email)=lower('EMAIL_COLABORADOR')
on conflict(user_id,shop_id) do update set can_write=excluded.can_write;
*/

-- ALTERAR PERFIL PARA GESTOR: usar role='gestor' e associar todas as lojas autorizadas.
-- Nunca transformar um colaborador em administrador sem autorização explícita.
