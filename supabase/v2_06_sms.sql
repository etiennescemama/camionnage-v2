-- =====================================================================
-- CAMIONNAGE 2.10 — v2_06_sms.sql
-- Additif, à exécuter après v2_05. Réexécutable.
--
-- SMS aux chauffeurs et équipiers (numéro de la fiche équipier) :
--  • la veille (18 h par défaut) : feuille de route du lendemain ;
--  • dans la journée : dès qu'une mission leur est ajoutée, retirée, avancée, déplacée ou annulée.
-- Plusieurs changements rapprochés sont regroupés en un seul SMS (2 min d'attente).
-- Le texte est composé au moment de l'envoi à partir du planning réel : il est toujours à jour.
-- Pas de SMS de changement entre 21 h et 6 h 30 : ils partent à 6 h 30.
-- =====================================================================
begin;

-- heure d'affectation : sert à signaler « NOUVEAU » dans le SMS
alter table public.operation_equipiers add column if not exists affecte_le timestamptz not null default now();

create table if not exists public.sms_alertes (
  id uuid primary key default gen_random_uuid(),
  equipier_id uuid not null references public.equipiers(id) on delete cascade,
  jour date not null,
  nature text not null check (nature in ('veille','changement')),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','skipped','uncertain')),
  attempts int not null default 0,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  processed_at timestamptz, provider_id text, contenu text, last_error text
);
-- une seule feuille de route par personne et par jour ; un seul changement en attente à la fois
create unique index if not exists sms_veille_unique on public.sms_alertes(equipier_id, jour) where nature = 'veille';
create unique index if not exists sms_changement_attente on public.sms_alertes(equipier_id, jour) where nature = 'changement' and status = 'pending';
create index if not exists sms_file on public.sms_alertes(status, available_at);

alter table public.sms_alertes enable row level security;
revoke all on public.sms_alertes from anon, authenticated;
grant select on public.sms_alertes to authenticated;
grant all on public.sms_alertes to service_role;
drop policy if exists r_sms on public.sms_alertes;
create policy r_sms on public.sms_alertes for select to authenticated using (public.est_planning());

create or replace function public.jour_paris(ts timestamptz default now()) returns date
language sql stable as $$ select (ts at time zone 'Europe/Paris')::date $$;

-- Prochain instant d'envoi autorisé pour un SMS de changement
create or replace function public.heure_sms(ts timestamptz) returns timestamptz
language sql stable as $$
  select case
    when (ts at time zone 'Europe/Paris')::time >= time '21:00'
      then (((ts at time zone 'Europe/Paris')::date + 1) + time '06:30') at time zone 'Europe/Paris'
    when (ts at time zone 'Europe/Paris')::time < time '06:30'
      then ((ts at time zone 'Europe/Paris')::date + time '06:30') at time zone 'Europe/Paris'
    else ts end;
$$;

-- Met en file un SMS de changement si la personne doit en être prévenue :
-- mission du jour, ou du lendemain alors que sa feuille de route est déjà partie.
create or replace function public.signaler_changement(p_equipier uuid, p_jour date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_equipier is null or p_jour is null then return; end if;
  if p_jour < public.jour_paris() then return; end if;
  if not (p_jour = public.jour_paris() or exists (
      select 1 from public.sms_alertes where equipier_id = p_equipier and jour = p_jour and nature = 'veille' and status in ('sent','sending'))) then
    return;
  end if;
  if not exists (select 1 from public.equipiers where id = p_equipier and actif and coalesce(trim(telephone), '') <> '') then return; end if;
  insert into public.sms_alertes(equipier_id, jour, nature, available_at)
  values (p_equipier, p_jour, 'changement', public.heure_sms(now() + interval '2 minutes'))
  on conflict (equipier_id, jour) where nature = 'changement' and status = 'pending'
  do update set available_at = public.heure_sms(now() + interval '2 minutes');
end $$;
revoke all on function public.signaler_changement(uuid, date) from public, anon, authenticated;

-- Affectation ou retrait d'une personne sur une mission
create or replace function public.trg_sms_equipe() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.operations;
begin
  select * into o from public.operations where id = coalesce(new.operation_id, old.operation_id);
  if o.id is null then return coalesce(new, old); end if;
  if tg_op in ('INSERT','UPDATE') and o.etat in ('planifiee','en_route','sur_site') then perform public.signaler_changement(new.equipier_id, o.date_prevue); end if;
  if tg_op in ('DELETE','UPDATE') then perform public.signaler_changement(old.equipier_id, o.date_prevue); end if;
  return coalesce(new, old);
end $$;
revoke all on function public.trg_sms_equipe() from public, anon, authenticated;
drop trigger if exists trg_sms_equipe on public.operation_equipiers;
create trigger trg_sms_equipe after insert or delete or update on public.operation_equipiers
  for each row execute function public.trg_sms_equipe();

-- Changement d'horaire, de lieu, de camion, de consignes, ou annulation d'une mission affectée
create or replace function public.trg_sms_operation() returns trigger
language plpgsql security definer set search_path = public as $$
declare e uuid;
begin
  if old.date_prevue is not distinct from new.date_prevue and old.heure_debut is not distinct from new.heure_debut
     and old.camion_id is not distinct from new.camion_id and old.adresse is not distinct from new.adresse
     and old.consignes is not distinct from new.consignes
     and not (new.etat in ('annulee','a_planifier') and old.etat in ('planifiee','en_route','sur_site')) then
    return new;
  end if;
  -- une première affectation est déjà signalée par l'arrivée de l'équipe
  if old.etat = 'a_planifier' and new.etat = 'planifiee' then return new; end if;
  for e in select equipier_id from public.operation_equipiers where operation_id = new.id loop
    perform public.signaler_changement(e, new.date_prevue);
    if old.date_prevue is distinct from new.date_prevue then perform public.signaler_changement(e, old.date_prevue); end if;
  end loop;
  return new;
end $$;
revoke all on function public.trg_sms_operation() from public, anon, authenticated;
drop trigger if exists trg_sms_operation on public.operations;
create trigger trg_sms_operation after update on public.operations
  for each row execute function public.trg_sms_operation();

-- Feuilles de route du lendemain (appelée par le job d'envoi après l'heure prévue)
create or replace function public.file_sms_veille(p_jour date) returns int
language sql security definer set search_path = public as $$
  with ins as (
    insert into public.sms_alertes(equipier_id, jour, nature)
    select distinct e.id, p_jour, 'veille'
      from public.operations o
      join public.operation_equipiers oe on oe.operation_id = o.id
      join public.equipiers e on e.id = oe.equipier_id
     where o.date_prevue = p_jour and o.etat = 'planifiee' and e.actif and coalesce(trim(e.telephone), '') <> ''
    on conflict (equipier_id, jour) where nature = 'veille' do nothing
    returning 1)
  select count(*)::int from ins;
$$;
revoke all on function public.file_sms_veille(date) from public, anon, authenticated;
grant execute on function public.file_sms_veille(date) to service_role;

create or replace function public.claim_sms() returns setof public.sms_alertes
language sql security definer set search_path = public as $$
  update public.sms_alertes set status = 'sending', attempts = attempts + 1, processed_at = now()
   where id in (select id from public.sms_alertes where status = 'pending' and available_at <= now() and attempts < 5
                order by available_at for update skip locked limit 20)
  returning *;
$$;
revoke all on function public.claim_sms() from public, anon, authenticated;
grant execute on function public.claim_sms() to service_role;

-- Réaffectation sans renvoyer toute l'équipe (évite des SMS « nouveau » à tort)
create or replace function public.planifier_operation(p_id uuid,p_date date,p_heure time,p_duree integer,p_camion uuid,p_equipiers uuid[],p_consignes text,p_adresse text,p_unassign boolean default false)
returns void language plpgsql security invoker set search_path=public as $$
declare o public.operations%rowtype; d public.demandes%rowtype; c public.camions%rowtype; start_at timestamp; end_at timestamp;
begin
 if not exists(select 1 from public.utilisateurs where id=auth.uid() and actif and role in ('admin','dispatcheur')) then raise exception 'Réservé au planning'; end if;
 perform pg_advisory_xact_lock(7252026);
 select * into o from public.operations where id=p_id for update;
 if not found then raise exception 'Opération introuvable'; end if;
 if o.etat in ('en_route','sur_site','terminee','annulee') then raise exception 'Cette opération a déjà démarré ou est clôturée'; end if;
 select * into d from public.demandes where id=o.demande_id;
 if d.etat not in ('acceptee','planifiee','en_cours') then raise exception 'Acceptez la demande avant de la planifier'; end if;
 if p_unassign then
   delete from public.operation_equipiers where operation_id=p_id;
   update public.operations set camion_id=null,etat='a_planifier',heure_debut=null where id=p_id;
   return;
 end if;
 if p_date is null or p_heure is null or p_duree is null or p_duree<1 or p_duree>1440 then raise exception 'Renseignez date, heure et durée'; end if;
 if p_adresse is null or length(trim(p_adresse))=0 then raise exception 'Renseignez le lieu de cette opération'; end if;
 if coalesce(cardinality(p_equipiers),0)<coalesce(d.nb_hommes,1) then raise exception 'Équipe incomplète'; end if;
 if (select count(distinct x) from unnest(p_equipiers) x)<>cardinality(p_equipiers) then raise exception 'Équipier sélectionné plusieurs fois'; end if;
 if (select count(*) from public.equipiers where id=any(p_equipiers) and actif)<>cardinality(p_equipiers) then raise exception 'Équipier inactif ou introuvable'; end if;
 if coalesce(d.nb_camions,1)>0 and o.type_operation in ('enlevement','livraison','transfert') and p_camion is null then raise exception 'Choisissez un camion'; end if;
 if p_camion is not null then
   select * into c from public.camions where id=p_camion and actif;
   if not found then raise exception 'Camion inactif ou introuvable'; end if;
   if d.besoin_hayon and not coalesce(c.hayon,false) then raise exception 'Hayon requis'; end if;
   if d.besoin_clim and not coalesce(c.climatise,false) then raise exception 'Climatisation requise'; end if;
   if d.type_camion ~ '^[0-9]+$' and coalesce(c.volume_m3,0)<d.type_camion::integer then raise exception 'Volume du camion insuffisant'; end if;
   if not exists(select 1 from public.equipiers where id=any(p_equipiers) and (case when c.poids_lourd then permis in ('C','CE') else permis in ('B','C','CE') end)) then raise exception 'Ajoutez un conducteur avec le permis adapté'; end if;
 end if;
 start_at=p_date+p_heure;end_at=start_at+make_interval(mins=>p_duree);
 if exists(select 1 from public.indisponibilites i where (i.camion_id=p_camion or i.equipier_id=any(p_equipiers)) and tsrange(i.date_debut::timestamp,(i.date_fin+1)::timestamp,'[)') && tsrange(start_at,end_at,'[)')) then raise exception 'Un moyen sélectionné est indisponible'; end if;
 if exists(select 1 from public.operations x where x.id<>p_id and x.etat not in ('a_planifier','annulee') and x.date_prevue is not null and (x.camion_id=p_camion or exists(select 1 from public.operation_equipiers e where e.operation_id=x.id and e.equipier_id=any(p_equipiers))) and tsrange(x.date_prevue+coalesce(x.heure_debut,'00:00'::time),x.date_prevue+coalesce(x.heure_debut,'00:00'::time)+make_interval(mins=>coalesce(x.duree_min,1440)),'[)') && tsrange(start_at,end_at,'[)')) then raise exception 'Conflit horaire : camion ou équipier déjà affecté'; end if;
 update public.operations set date_prevue=p_date,heure_debut=p_heure,duree_min=p_duree,camion_id=p_camion,consignes=p_consignes,adresse=p_adresse,etat='planifiee' where id=p_id;
 -- 2.10 : seules les personnes retirées ou ajoutées changent ; les autres gardent leur heure d'affectation
 delete from public.operation_equipiers where operation_id=p_id and not (equipier_id=any(p_equipiers));
 insert into public.operation_equipiers(operation_id,equipier_id,chef) select p_id,x.id,x.n=1 from unnest(p_equipiers) with ordinality as x(id,n)
 on conflict (operation_id,equipier_id) do update set chef=excluded.chef where public.operation_equipiers.chef is distinct from excluded.chef;
end $$;

commit;
