-- =====================================================================
-- CAMIONNAGE 2.9 — v2_05_photos.sql
-- Additif, à exécuter après v2_04. Réexécutable. Remplace la création manuelle du bucket.
--
-- Photos de mission : prises ou importées depuis le téléphone par l'équipe, ou déposées
-- par le coordinateur / le planning depuis le dossier. Rangées par mission :
--   operations-photos/<operation_id>/<uuid>.jpg
-- Une photo classée « Réserve / dommage » déclenche un mail au coordinateur et au planning.
-- =====================================================================
begin;

alter table public.operation_photos
  add column if not exists categorie text not null default 'constat',
  add column if not exists auteur_id uuid references public.utilisateurs(id) on delete set null default auth.uid(),
  add column if not exists taille_octets int;
do $$ begin
  alter table public.operation_photos add constraint operation_photos_categorie_check
    check (categorie in ('enlevement','livraison','reserve','constat'));
exception when duplicate_object then null; end $$;
create index if not exists idx_photos_op on public.operation_photos(operation_id, created_at);

-- Peut déposer une photo sur cette mission : planning, équipe affectée, coordinateur du dossier
create or replace function public.peut_photographier(p_operation uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.est_planning()
    or exists (select 1 from public.operation_equipiers oe join public.equipiers e on e.id = oe.equipier_id
                where oe.operation_id = p_operation and e.utilisateur_id = auth.uid())
    or exists (select 1 from public.operations o join public.demandes d on d.id = o.demande_id
                where o.id = p_operation and d.coordinateur_id = auth.uid());
$$;
-- Peut voir : les mêmes, plus la direction ; le terrain ne voit que ses missions
create or replace function public.peut_voir_photos(p_operation uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.role_actif() in ('admin','dispatcheur','direction','coordinateur','gm','emballage')
    or public.peut_photographier(p_operation);
$$;

drop policy if exists r_photos on public.operation_photos;
create policy r_photos on public.operation_photos for select using (public.peut_voir_photos(operation_id));
drop policy if exists w_photos on public.operation_photos;
create policy w_photos on public.operation_photos for insert with check (
  public.peut_photographier(operation_id) and auteur_id = auth.uid()
  and storage_path like operation_id::text || '/%');
-- Suppression : le planning, ou l'auteur tant que la mission n'est pas close
drop policy if exists d_photos on public.operation_photos;
create policy d_photos on public.operation_photos for delete using (
  public.est_planning() or (auteur_id = auth.uid() and exists (
    select 1 from public.operations o where o.id = operation_id and o.etat <> 'terminee')));
drop policy if exists u_photos on public.operation_photos;
create policy u_photos on public.operation_photos for update using (public.est_planning() or auteur_id = auth.uid())
  with check (public.est_planning() or auteur_id = auth.uid());

-- ---------- Stockage : bucket privé, images de 15 Mo maximum ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('operations-photos', 'operations-photos', false, 15728640,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Le premier dossier du chemin est l'identifiant de la mission
create or replace function public.photo_operation(p_name text) returns uuid
language sql immutable as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f-]{36}$' then split_part(p_name, '/', 1)::uuid end;
$$;

drop policy if exists "camionnage photos lecture" on storage.objects;
create policy "camionnage photos lecture" on storage.objects for select to authenticated using (
  bucket_id = 'operations-photos' and public.peut_voir_photos(public.photo_operation(name)));
drop policy if exists "camionnage photos depot" on storage.objects;
create policy "camionnage photos depot" on storage.objects for insert to authenticated with check (
  bucket_id = 'operations-photos' and public.peut_photographier(public.photo_operation(name)));
drop policy if exists "camionnage photos suppression" on storage.objects;
create policy "camionnage photos suppression" on storage.objects for delete to authenticated using (
  bucket_id = 'operations-photos' and (public.est_planning() or owner = auth.uid()));

-- ---------- Réserve ou dommage photographié : alerte immédiate ----------
create or replace function public.queue_photo_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare d public.demandes; o public.operations; recipient uuid;
begin
  if new.categorie <> 'reserve' then return new; end if;
  select * into o from public.operations where id = new.operation_id;
  select * into d from public.demandes where id = o.demande_id;
  for recipient in select distinct u.id from public.utilisateurs u where u.actif and u.id is distinct from new.auteur_id
      and (u.id = d.coordinateur_id or u.id = d.dispatcheur_id or (d.dispatcheur_id is null and u.role in ('dispatcheur','admin'))) loop
    insert into public.email_alerts(demande_id, recipient_id, event_key, subject, message)
    values (d.id, recipient, 'photo:' || new.id, d.numero || ' · Réserve photographiée sur place',
      'L''équipe a photographié une réserve ou un dommage (' || coalesce(o.libelle, o.type_operation) || '). '
      || coalesce('Légende : ' || nullif(new.legende, '') || '. ', '')
      || 'Consultez les photos dans le dossier avant de répondre au client.')
    on conflict do nothing;
    insert into public.notifications(destinataire_id, type, demande_id, titre, message)
    values (recipient, 'reserve', d.id, 'Réserve sur ' || d.numero, coalesce(nullif(new.legende, ''), 'Photo de réserve ajoutée par l''équipe.'));
  end loop;
  return new;
end $$;
revoke all on function public.queue_photo_email() from public, anon, authenticated;
drop trigger if exists trg_email_photo on public.operation_photos;
create trigger trg_email_photo after insert on public.operation_photos
  for each row execute function public.queue_photo_email();

commit;
