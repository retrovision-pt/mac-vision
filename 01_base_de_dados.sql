-- MAC Vision · dados partilhados com Supabase Auth e permissões por loja.
-- Executar no SQL Editor do projeto dedicado, depois de confirmar que este é o projeto correto.
-- Não modifica tabelas de aplicações diferentes.
create schema if not exists mac_private;

create table if not exists public.mac_vision_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null,
 role text not null check(role in ('admin','gestor','colaborador')),
 app_user_id text,
 created_at timestamptz not null default now()
);

create table if not exists public.mac_vision_shop_access (
 user_id uuid not null references auth.users(id) on delete cascade,
 shop_id text not null,
 can_write boolean not null default true,
 primary key(user_id,shop_id)
);

create table if not exists public.mac_vision_docs (
 key text primary key,
 shop_id text generated always as (case when key like 'store:%' then substring(key from 7) else null end) stored,
 data jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 updated_by uuid default auth.uid(),
 constraint mac_vision_docs_valid_key check (key='rc-clean-install-20261110-registry-v2' or key like 'store:%')
);
create index if not exists mac_vision_docs_shop_idx on public.mac_vision_docs(shop_id);

create table if not exists public.mac_vision_directory (
 shop_id text primary key,
 data jsonb not null,
 updated_at timestamptz not null default now()
);

create or replace function mac_private.is_admin() returns boolean
language sql stable security definer set search_path=''
as $$
 select exists (select 1 from public.mac_vision_profiles p
                where p.user_id=(select auth.uid()) and p.role='admin');
$$;

create or replace function mac_private.has_shop(p_shop text, p_write boolean default false)
returns boolean language sql stable security definer set search_path=''
as $$
 select mac_private.is_admin() or exists(
  select 1 from public.mac_vision_shop_access s
  where s.user_id=(select auth.uid()) and s.shop_id=p_shop
    and (not p_write or s.can_write));
$$;

revoke all on function mac_private.is_admin() from public;
revoke all on function mac_private.has_shop(text,boolean) from public;
grant usage on schema mac_private to authenticated;
grant execute on function mac_private.is_admin() to authenticated;
grant execute on function mac_private.has_shop(text,boolean) to authenticated;

alter table public.mac_vision_profiles enable row level security;
alter table public.mac_vision_shop_access enable row level security;
alter table public.mac_vision_docs enable row level security;
alter table public.mac_vision_directory enable row level security;

-- Os membros podem consultar o próprio perfil. Apenas administradores gerem perfis.
create policy mac_profiles_read on public.mac_vision_profiles for select to authenticated
 using(user_id=(select auth.uid()) or mac_private.is_admin());
create policy mac_profiles_insert on public.mac_vision_profiles for insert to authenticated
 with check(mac_private.is_admin());
create policy mac_profiles_update on public.mac_vision_profiles for update to authenticated
 using(mac_private.is_admin()) with check(mac_private.is_admin());
create policy mac_profiles_delete on public.mac_vision_profiles for delete to authenticated
 using(mac_private.is_admin());

create policy mac_access_read on public.mac_vision_shop_access for select to authenticated
 using(user_id=(select auth.uid()) or mac_private.is_admin());
create policy mac_access_insert on public.mac_vision_shop_access for insert to authenticated
 with check(mac_private.is_admin());
create policy mac_access_update on public.mac_vision_shop_access for update to authenticated
 using(mac_private.is_admin()) with check(mac_private.is_admin());
create policy mac_access_delete on public.mac_vision_shop_access for delete to authenticated
 using(mac_private.is_admin());

-- O registo global com hashes de passwords antigas NÃO é legível por colaboradores.
create policy mac_docs_read on public.mac_vision_docs for select to authenticated using (
 (key='rc-clean-install-20261110-registry-v2' and mac_private.is_admin())
 or (shop_id is not null and mac_private.has_shop(shop_id,false))
);
create policy mac_docs_insert on public.mac_vision_docs for insert to authenticated with check (
 (key='rc-clean-install-20261110-registry-v2' and mac_private.is_admin())
 or (shop_id is not null and mac_private.has_shop(shop_id,true))
);
create policy mac_docs_update on public.mac_vision_docs for update to authenticated using (
 (key='rc-clean-install-20261110-registry-v2' and mac_private.is_admin())
 or (shop_id is not null and mac_private.has_shop(shop_id,true))
) with check (
 (key='rc-clean-install-20261110-registry-v2' and mac_private.is_admin())
 or (shop_id is not null and mac_private.has_shop(shop_id,true))
);
create policy mac_docs_delete on public.mac_vision_docs for delete to authenticated using (
 (key='rc-clean-install-20261110-registry-v2' and mac_private.is_admin())
 or (shop_id is not null and mac_private.has_shop(shop_id,true))
);
create policy mac_directory_read on public.mac_vision_directory for select to authenticated
 using(mac_private.has_shop(shop_id,false));

-- Eliminar hashes e dados de contacto da lista de utilizadores enviada ao navegador.
create or replace function mac_private.sanitize_shop(v jsonb)
returns jsonb language sql immutable set search_path=''
as $$
 select jsonb_set(
   v,
   '{users}',
   coalesce((
    select jsonb_agg(u - 'hash' - 'salt' - 'pbkdf2Iterations' - 'credentialVersion'
                         - 'email' - 'contacto' - 'cav' - 'sfid' - 'telefone')
    from jsonb_array_elements(case when jsonb_typeof(v->'users')='array' then v->'users' else '[]'::jsonb end) as e(u)
   ),'[]'::jsonb),
   true
 );
$$;

create or replace function mac_private.sync_directory()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if TG_OP='DELETE' then
   if old.key='rc-clean-install-20261110-registry-v2' then delete from public.mac_vision_directory; end if;
   return old;
 end if;
 if new.key <> 'rc-clean-install-20261110-registry-v2' then return new; end if;
 delete from public.mac_vision_directory;
 if TG_OP <> 'DELETE' then
  insert into public.mac_vision_directory(shop_id,data)
  select shop->>'id',mac_private.sanitize_shop(shop)
  from jsonb_array_elements(case when jsonb_typeof(new.data)='array' then new.data else '[]'::jsonb end) as entries(shop)
  where shop ? 'id' and length(shop->>'id')>0
  on conflict(shop_id) do update set data=excluded.data,updated_at=now();
 end if;
 return new;
end;
$$;

create or replace function mac_private.version_document()
returns trigger language plpgsql set search_path=''
as $$
begin
 if TG_OP='UPDATE' then
   if new.key<>old.key then raise exception 'Não é possível alterar a chave de um documento.'; end if;
   new.revision=old.revision+1;
 end if;
 new.updated_at=now();new.updated_by=auth.uid();return new;
end;
$$;

drop trigger if exists mac_vision_doc_revision on public.mac_vision_docs;
create trigger mac_vision_doc_revision before insert or update on public.mac_vision_docs
for each row execute function mac_private.version_document();
drop trigger if exists mac_vision_registry_directory on public.mac_vision_docs;
create trigger mac_vision_registry_directory after insert or update or delete on public.mac_vision_docs
for each row execute function mac_private.sync_directory();

grant select,insert,update,delete on public.mac_vision_profiles to authenticated;
grant select,insert,update,delete on public.mac_vision_shop_access to authenticated;
grant select,insert,update,delete on public.mac_vision_docs to authenticated;
grant select on public.mac_vision_directory to authenticated;
revoke all on public.mac_vision_profiles,public.mac_vision_shop_access,public.mac_vision_docs,public.mac_vision_directory from anon;

-- Anexos Excel privados, acessíveis apenas a utilizadores autorizados para a loja.
insert into storage.buckets(id,name,public,file_size_limit)
values('mac-vision-attachments','mac-vision-attachments',false,52428800)
on conflict(id) do nothing;

create policy mac_files_read on storage.objects for select to authenticated
 using(bucket_id='mac-vision-attachments' and mac_private.has_shop(split_part(name,'/',1),false));
create policy mac_files_insert on storage.objects for insert to authenticated
 with check(bucket_id='mac-vision-attachments' and mac_private.has_shop(split_part(name,'/',1),true));
create policy mac_files_update on storage.objects for update to authenticated
 using(bucket_id='mac-vision-attachments' and mac_private.has_shop(split_part(name,'/',1),true))
 with check(bucket_id='mac-vision-attachments' and mac_private.has_shop(split_part(name,'/',1),true));
create policy mac_files_delete on storage.objects for delete to authenticated
 using(bucket_id='mac-vision-attachments' and mac_private.has_shop(split_part(name,'/',1),true));

-- Importante: nenhuma tabela exposta permite acesso anónimo a dados pessoais/comerciais.
