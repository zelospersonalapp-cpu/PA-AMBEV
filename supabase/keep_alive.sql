-- Tabela de controle para manter o projeto Supabase ativo
create table if not exists _keep_alive (
  id      serial primary key,
  ping_at timestamptz not null default now(),
  nota    text
);

insert into _keep_alive (nota) values ('setup inicial');

-- Habilitar RLS se necessário (ou permitir service_role)
alter table _keep_alive enable row level security;

-- Política para permitir que o service_role insira e exclua livremente
create policy "Service Role full access to keep alive"
  on _keep_alive
  for all
  to service_role
  using (true)
  with check (true);
