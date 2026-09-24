-- =====================================================================
-- CAMIONNAGE v2 — schéma complet
-- À exécuter UNE FOIS dans Supabase → SQL Editor (projet usaqhxnlwpueneoykoxl)
-- Conserve : auth.users, public.utilisateurs, public.clients, public.camions, public.equipiers
-- Supprime : toutes les anciennes tables opérationnelles (dossiers, etapes, chat, notifications…)
-- =====================================================================

-- ---------- 0. Nettoyage de l'ancien modèle ----------
drop view if exists public.v_dispatch_jour;
drop table if exists public.messages cascade;
drop table if exists public.conversation_participants cascade;
drop table if exists public.conversations cascade;
drop table if exists public.notifications cascade;
drop table if exists public.etape_equipiers cascade;
drop table if exists public.pieces_jointes cascade;
drop table if exists public.oeuvres cascade;
drop table if exists public.etapes cascade;
drop table if exists public.dossiers cascade;
drop table if exists public.journal cascade;
drop table if exists public.types_prestation cascade;
drop table if exists public.sites cascade;
drop table if exists public.services cascade;

-- ---------- 1. Helpers ----------
create or replace function public.auth_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.utilisateurs where id = auth.uid();
$$;

-- ---------- 2. Utilisateurs / référentiels (tables conservées, complétées) ----------
do $$ declare r record; begin
  for r in select conname from pg_constraint where conrelid='public.utilisateurs'::regclass and contype='c' loop
    execute format('alter table public.utilisateurs drop constraint %I', r.conname); end loop;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='clients' and column_name='type') then
    execute 'alter table public.clients alter column type drop not null'; end if;
end $$;
alter table public.utilisateurs add constraint utilisateurs_role_check
  check (role in ('coordinateur','dispatcheur','chauffeur','gm','emballage','direction','admin'));

alter table public.camions
  add column if not exists volume_m3 int,
  add column if not exists hayon boolean default false,
  add column if not exists climatise boolean default false,
  add column if not exists poids_lourd boolean default false,
  add column if not exists rampe boolean default false,
  add column if not exists actif boolean default true;

alter table public.equipiers
  add column if not exists nom text,
  add column if not exists permis text,
  add column if not exists role text default 'chauffeur',
  add column if not exists telephone text,
  add column if not exists utilisateur_id uuid references public.utilisateurs(id) on delete set null,
  add column if not exists actif boolean default true;

alter table public.clients
  add column if not exists code_akanea text,
  add column if not exists email text,
  add column if not exists telephone text;

-- ---------- 3. Temps standards (capacité) ----------
create table if not exists public.temps_standards (
  type_operation text primary key,
  libelle text not null,
  duree_base_min int not null,        -- durée fixe (chargement/déchargement, route moyenne)
  min_par_m3 int not null default 0,  -- minutes supplémentaires par m³
  hommes_defaut int not null default 2,
  ordre int not null default 0
);
insert into public.temps_standards (type_operation, libelle, duree_base_min, min_par_m3, hommes_defaut, ordre) values
  ('enlevement',   'Enlèvement chez le client',        120, 6, 2, 1),
  ('livraison',    'Livraison chez le client',         120, 6, 2, 2),
  ('transfert',    'Transfert (enlèvement + livraison)', 210, 8, 2, 3),
  ('reception_gm', 'Réception au garde-meuble',         45, 3, 1, 4),
  ('sortie_gm',    'Sortie de stock',                   45, 3, 1, 5),
  ('emballage',    'Emballage à l''atelier',           180, 15, 2, 6),
  ('installation', 'Installation / accrochage',        240, 0, 2, 7)
on conflict (type_operation) do nothing;

-- ---------- 4. Indisponibilités (camions, équipiers) ----------
create table if not exists public.indisponibilites (
  id uuid primary key default gen_random_uuid(),
  camion_id uuid references public.camions(id) on delete cascade,
  equipier_id uuid references public.equipiers(id) on delete cascade,
  date_debut date not null,
  date_fin date not null,
  motif text,
  created_at timestamptz default now(),
  check (camion_id is not null or equipier_id is not null)
);

-- ---------- 5. Demandes (projets) ----------
create sequence if not exists public.demandes_seq;
create table if not exists public.demandes (
  id uuid primary key default gen_random_uuid(),
  numero text unique not null default ('C-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.demandes_seq')::text, 5, '0')),
  client_id uuid references public.clients(id),
  code_affaire text,
  contact_nom text, contact_email text, contact_telephone text,
  adresse_enlevement text, adresse_livraison text,
  objets text, nb_colis int, volume_m3 numeric(6,1),
  date_souhaitee date, creneau text check (creneau in ('matin','apres_midi','journee','rdv')), rdv_heure time,
  date_fin date,
  nb_hommes int default 2, type_camion text,
  besoin_hayon boolean default false, besoin_clim boolean default false,
  observations text,
  etat text not null default 'envoyee' check (etat in ('brouillon','envoyee','acceptee','planifiee','en_cours','terminee','refusee','annulee')),
  motif_refus text,
  coordinateur_id uuid references public.utilisateurs(id),
  dispatcheur_id uuid references public.utilisateurs(id),
  specifique boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists idx_demandes_date on public.demandes(date_souhaitee);
create index if not exists idx_demandes_coord on public.demandes(coordinateur_id);

-- ---------- 6. Opérations (ordres de transport / sous-projets) ----------
create table if not exists public.operations (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid references public.demandes(id) on delete cascade not null,
  type_operation text references public.temps_standards(type_operation) not null,
  ordre int default 1,
  libelle text,
  adresse text,
  date_prevue date,
  heure_debut time,
  duree_min int,
  camion_id uuid references public.camions(id),
  etat text not null default 'a_planifier' check (etat in ('a_planifier','planifiee','en_route','sur_site','terminee','annulee')),
  consignes text,
  -- exécution (mobile chauffeur)
  heure_arrivee timestamptz, heure_depart timestamptz,
  compte_rendu text, signature_nom text, signature_data text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists idx_ops_date on public.operations(date_prevue);
create index if not exists idx_ops_camion on public.operations(camion_id, date_prevue);

create table if not exists public.operation_equipiers (
  operation_id uuid references public.operations(id) on delete cascade,
  equipier_id uuid references public.equipiers(id) on delete cascade,
  chef boolean default false,
  primary key (operation_id, equipier_id)
);

create table if not exists public.operation_photos (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid references public.operations(id) on delete cascade,
  storage_path text not null,
  legende text,
  created_at timestamptz default now()
);

-- ---------- 7. Notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  destinataire_id uuid references public.utilisateurs(id) on delete cascade not null,
  type text not null,
  demande_id uuid references public.demandes(id) on delete cascade,
  titre text not null, message text,
  lu_le timestamptz, created_at timestamptz default now()
);
create index if not exists idx_notif on public.notifications(destinataire_id, lu_le);

-- ---------- 8. Triggers ----------
-- 8a. updated_at
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_touch_demandes on public.demandes;
create trigger trg_touch_demandes before update on public.demandes for each row execute function public.touch_updated_at();
drop trigger if exists trg_touch_ops on public.operations;
create trigger trg_touch_ops before update on public.operations for each row execute function public.touch_updated_at();

-- 8b. spécifique auto
create or replace function public.calc_specifique() returns trigger language plpgsql as $$
begin
  new.specifique := (coalesce(new.date_fin, new.date_souhaitee) > new.date_souhaitee)
    or coalesce(new.nb_hommes,2) > 2
    or coalesce(new.volume_m3,0) > 20
    or new.type_camion in ('27','35','50');
  return new;
end $$;
drop trigger if exists trg_specifique on public.demandes;
create trigger trg_specifique before insert or update of date_fin, date_souhaitee, nb_hommes, volume_m3, type_camion
  on public.demandes for each row execute function public.calc_specifique();

-- 8c. état de la demande dérivé des opérations
create or replace function public.recalc_etat_demande(p_demande uuid) returns void
language plpgsql security definer set search_path = public as $$
declare total int; planif int; term int; encours int; cur text;
begin
  select etat into cur from public.demandes where id = p_demande;
  if cur in ('refusee','annulee','envoyee','brouillon') then return; end if;
  select count(*), count(*) filter (where etat in ('planifiee','en_route','sur_site','terminee')),
         count(*) filter (where etat = 'terminee'), count(*) filter (where etat in ('en_route','sur_site'))
    into total, planif, term, encours
  from public.operations where demande_id = p_demande and etat <> 'annulee';
  if total = 0 then return; end if;
  update public.demandes set etat = case
      when term = total then 'terminee'
      when encours > 0 then 'en_cours'
      when planif = total then 'planifiee'
      else 'acceptee' end
  where id = p_demande;
end $$;

create or replace function public.trg_ops_recalc() returns trigger language plpgsql security definer set search_path = public as $$
declare d uuid; old_planif boolean; new_planif boolean; coord uuid; num text;
begin
  d := coalesce(new.demande_id, old.demande_id);
  perform public.recalc_etat_demande(d);
  -- notification coordinateur quand la demande devient planifiée
  if tg_op = 'UPDATE' then
    select coordinateur_id, numero into coord, num from public.demandes where id = d;
    if coord is not null and (select etat from public.demandes where id = d) = 'planifiee'
       and (old.camion_id is distinct from new.camion_id or old.date_prevue is distinct from new.date_prevue or old.heure_debut is distinct from new.heure_debut) then
      insert into public.notifications (destinataire_id, type, demande_id, titre, message)
      values (coord, 'planifiee', d, 'Demande ' || num || ' planifiée',
              'Camion et créneau affectés le ' || to_char(new.date_prevue,'DD/MM') || ' à ' || coalesce(to_char(new.heure_debut,'HH24:MI'),'—'));
    end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trg_ops_recalc on public.operations;
create trigger trg_ops_recalc after insert or update or delete on public.operations for each row execute function public.trg_ops_recalc();

-- 8d. modification d'une demande planifiée → retour à "acceptee" + alerte dispatcheur
create or replace function public.trg_demande_modifiee() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.etat in ('planifiee') and new.etat = old.etat and (
       old.date_souhaitee is distinct from new.date_souhaitee or old.creneau is distinct from new.creneau
    or old.rdv_heure is distinct from new.rdv_heure or old.nb_hommes is distinct from new.nb_hommes
    or old.type_camion is distinct from new.type_camion or old.volume_m3 is distinct from new.volume_m3
    or old.adresse_enlevement is distinct from new.adresse_enlevement or old.adresse_livraison is distinct from new.adresse_livraison) then
    new.etat := 'acceptee';
    if old.dispatcheur_id is not null then
      insert into public.notifications (destinataire_id, type, demande_id, titre, message)
      values (old.dispatcheur_id, 'modifiee', new.id, 'Demande ' || new.numero || ' modifiée', 'Le coordinateur a modifié une demande planifiée : la planification est à refaire.');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_demande_modifiee on public.demandes;
create trigger trg_demande_modifiee before update on public.demandes for each row execute function public.trg_demande_modifiee();

-- 8e. après retour à "acceptee" : déplanifier les opérations (AFTER pour ne pas modifier la ligne en cours)
create or replace function public.trg_demande_deplanifier() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.etat = 'planifiee' and new.etat = 'acceptee' then
    delete from public.operation_equipiers where operation_id in (select id from public.operations where demande_id = new.id and etat = 'planifiee');
    update public.operations set etat = 'a_planifier', camion_id = null where demande_id = new.id and etat = 'planifiee';
  end if;
  return new;
end $$;
drop trigger if exists trg_demande_deplanifier on public.demandes;
create trigger trg_demande_deplanifier after update on public.demandes for each row execute function public.trg_demande_deplanifier();

-- ---------- 9. RLS ----------
alter table public.utilisateurs enable row level security;
alter table public.clients enable row level security;
alter table public.camions enable row level security;
alter table public.equipiers enable row level security;
alter table public.temps_standards enable row level security;
alter table public.indisponibilites enable row level security;
alter table public.demandes enable row level security;
alter table public.operations enable row level security;
alter table public.operation_equipiers enable row level security;
alter table public.operation_photos enable row level security;
alter table public.notifications enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public'
    and tablename in ('utilisateurs','clients','camions','equipiers','temps_standards','indisponibilites','demandes','operations','operation_equipiers','operation_photos','notifications')
  loop execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename); end loop; end $$;

-- lecture : tout utilisateur connecté
create policy r_utilisateurs on public.utilisateurs for select using (auth.uid() is not null);
create policy r_clients on public.clients for select using (auth.uid() is not null);
create policy r_camions on public.camions for select using (auth.uid() is not null);
create policy r_equipiers on public.equipiers for select using (auth.uid() is not null);
create policy r_ts on public.temps_standards for select using (auth.uid() is not null);
create policy r_indispo on public.indisponibilites for select using (auth.uid() is not null);
create policy r_demandes on public.demandes for select using (auth.uid() is not null);
create policy r_ops on public.operations for select using (auth.uid() is not null);
create policy r_opeq on public.operation_equipiers for select using (auth.uid() is not null);
create policy r_photos on public.operation_photos for select using (auth.uid() is not null);
create policy r_notif on public.notifications for select using (destinataire_id = auth.uid());

-- écriture référentiels : admin + dispatcheur
create policy w_clients on public.clients for all using (public.auth_role() in ('admin','dispatcheur','coordinateur')) with check (public.auth_role() in ('admin','dispatcheur','coordinateur'));
create policy w_camions on public.camions for all using (public.auth_role() in ('admin','dispatcheur')) with check (public.auth_role() in ('admin','dispatcheur'));
create policy w_equipiers on public.equipiers for all using (public.auth_role() in ('admin','dispatcheur')) with check (public.auth_role() in ('admin','dispatcheur'));
create policy w_ts on public.temps_standards for all using (public.auth_role() in ('admin','dispatcheur')) with check (public.auth_role() in ('admin','dispatcheur'));
create policy w_indispo on public.indisponibilites for all using (public.auth_role() in ('admin','dispatcheur')) with check (public.auth_role() in ('admin','dispatcheur'));
create policy w_utilisateurs on public.utilisateurs for update using (public.auth_role() = 'admin' or id = auth.uid());

-- demandes : coordinateur (les siennes), dispatcheur/admin (toutes)
create policy i_demandes on public.demandes for insert with check (public.auth_role() in ('coordinateur','dispatcheur','admin'));
create policy u_demandes on public.demandes for update using (coordinateur_id = auth.uid() or public.auth_role() in ('dispatcheur','admin'));
create policy d_demandes on public.demandes for delete using (coordinateur_id = auth.uid() or public.auth_role() = 'admin');

-- opérations : coordinateur crée/modifie sur ses demandes, dispatcheur/admin tout, chauffeur met à jour l'exécution de ses opérations
create policy i_ops on public.operations for insert with check (public.auth_role() in ('coordinateur','dispatcheur','admin'));
create policy u_ops on public.operations for update using (
  public.auth_role() in ('dispatcheur','admin')
  or exists (select 1 from public.demandes d where d.id = demande_id and d.coordinateur_id = auth.uid())
  or exists (select 1 from public.operation_equipiers oe join public.equipiers e on e.id = oe.equipier_id where oe.operation_id = operations.id and e.utilisateur_id = auth.uid()));
create policy d_ops on public.operations for delete using (public.auth_role() in ('dispatcheur','admin') or exists (select 1 from public.demandes d where d.id = demande_id and d.coordinateur_id = auth.uid()));
create policy w_opeq on public.operation_equipiers for all using (public.auth_role() in ('dispatcheur','admin')) with check (public.auth_role() in ('dispatcheur','admin'));
create policy w_photos on public.operation_photos for insert with check (auth.uid() is not null);
create policy u_notif on public.notifications for update using (destinataire_id = auth.uid());
create policy i_notif on public.notifications for insert with check (auth.uid() is not null);

-- ---------- 10. Capacité : créneaux disponibles ----------
-- Retourne, pour chaque jour et demi-journée de l'intervalle, le nombre de camions libres
-- (filtrés sur volume/hayon/clim si demandés) et le nombre d'équipiers libres.
create or replace function public.creneaux_disponibles(
  p_from date, p_to date,
  p_volume_min int default 0, p_hayon boolean default false, p_clim boolean default false,
  p_duree_min int default 120
) returns table (jour date, demi text, camions_libres int, hommes_libres int, camions_ids uuid[])
language sql stable security definer set search_path = public as $$
  with jours as (select d::date as jour from generate_series(p_from, p_to, interval '1 day') d),
  demis as (select 'matin' as demi, time '07:30' as h1, time '12:30' as h2 union all select 'apres_midi', time '13:30', time '18:30'),
  grille as (select j.jour, dm.demi, dm.h1, dm.h2 from jours j cross join demis dm where extract(isodow from j.jour) < 6),
  cam as (select id, coalesce(volume_m3,0) v, hayon, climatise from public.camions where actif
          and coalesce(volume_m3,0) >= p_volume_min and (not p_hayon or hayon) and (not p_clim or climatise)),
  ops as (select o.camion_id, o.date_prevue, o.heure_debut, coalesce(o.duree_min, 120) dur, o.id
          from public.operations o where o.etat not in ('annulee') and o.camion_id is not null and o.heure_debut is not null),
  cam_occ as (
    select g.jour, g.demi, c.id
    from grille g cross join cam c
    where exists (select 1 from ops o where o.camion_id = c.id and o.date_prevue = g.jour
                  and o.heure_debut < g.h2 and (o.heure_debut + (o.dur || ' minutes')::interval) > g.h1)
       or exists (select 1 from public.indisponibilites i where i.camion_id = c.id and g.jour between i.date_debut and i.date_fin)),
  eq as (select id from public.equipiers where actif),
  eq_occ as (
    select g.jour, g.demi, e.id
    from grille g cross join eq e
    where exists (select 1 from public.operation_equipiers oe join ops o on o.id = oe.operation_id
                  where oe.equipier_id = e.id and o.date_prevue = g.jour
                  and o.heure_debut < g.h2 and (o.heure_debut + (o.dur || ' minutes')::interval) > g.h1)
       or exists (select 1 from public.indisponibilites i where i.equipier_id = e.id and g.jour between i.date_debut and i.date_fin))
  select g.jour, g.demi,
    (select count(*) from cam c where not exists (select 1 from cam_occ co where co.jour=g.jour and co.demi=g.demi and co.id=c.id))::int,
    (select count(*) from eq e where not exists (select 1 from eq_occ eo where eo.jour=g.jour and eo.demi=g.demi and eo.id=e.id))::int,
    array(select c.id from cam c where not exists (select 1 from cam_occ co where co.jour=g.jour and co.demi=g.demi and co.id=c.id))
  from grille g order by g.jour, g.demi;
$$;

-- ---------- 11. Storage (photos chauffeurs) ----------
-- Créer manuellement le bucket privé "operations-photos" (Storage → New bucket)
-- puis une policy "authenticated" en SELECT + INSERT.

-- =====================================================================
-- 12. SCÉNARIOS (types de projet) — canevas de demandes
-- =====================================================================
create table if not exists public.scenarios (
  code text primary key,
  libelle text not null,
  description text,
  ops_aller text not null,           -- codes d'opérations séparés par des virgules, dans l'ordre (période aller)
  ops_retour text,                    -- idem pour la période retour (aller-retour, foire) ; vide sinon
  nb_jours int not null default 1,    -- nombre de jours de la période aller (rotations quotidiennes)
  nb_camions int not null default 1,
  nb_hommes int not null default 2,
  type_camion text default '20',
  besoin_hayon boolean default true,
  besoin_clim boolean default false,
  creneau_fixe boolean default false, -- horaire imposé (RDV)
  profils text,                       -- profils humains attendus, texte libre
  ordre int default 0,
  actif boolean default true
);
insert into public.scenarios (code, libelle, description, ops_aller, ops_retour, nb_jours, nb_camions, nb_hommes, type_camion, besoin_hayon, besoin_clim, creneau_fixe, profils, ordre) values
  ('aller_simple',   'Aller simple',                    'Enlèvement puis livraison, une demi-journée',                    'enlevement,livraison', null, 1, 1, 2, '20', true,  false, false, 'chauffeur, manutentionnaire', 1),
  ('aller_retour',   'Aller-retour',                    'Prêt, restauration, salle des ventes : retour à une seconde date','enlevement,livraison', 'enlevement,livraison', 1, 1, 2, '20', true, false, false, 'chauffeur, manutentionnaire', 2),
  ('transit_depot',  'Transit via dépôt',               'Enlèvement, réception au garde-meuble, emballage, sortie, livraison','enlevement,reception_gm,emballage,sortie_gm,livraison', null, 1, 1, 2, '20', true, false, false, 'chauffeur, manutentionnaire, emballeur', 3),
  ('demenagement',   'Déménagement de réserves',        'Rotations enlèvement-livraison sur plusieurs jours et camions',   'enlevement,livraison', null, 3, 2, 4, '27', true, true, false, 'chauffeurs PL, manutentionnaires', 4),
  ('montage_expo',   'Montage d''exposition',            'Enlèvements groupés, livraison, installation',                    'enlevement,livraison,installation', null, 2, 1, 3, '27', true, true, false, 'chauffeur PL, manutentionnaires, technicien accrochage', 5),
  ('demontage_expo', 'Démontage / restitution',         'Décrochage, emballage sur site, livraisons',                      'installation,emballage,livraison', null, 2, 1, 3, '27', true, true, false, 'technicien accrochage, emballeur, chauffeur PL', 6),
  ('foire',          'Foire',                           'Livraison et installation du stand, retour après la foire',       'enlevement,livraison,installation', 'enlevement,livraison', 1, 1, 3, '20', true, false, false, 'chauffeur, manutentionnaires, technicien', 7),
  ('aeroport',       'Aéroport / fret',                 'Dépôt ou retrait chez l''agent de fret, horaire imposé',          'enlevement,livraison', null, 1, 1, 2, '20', true, false, true, 'chauffeur, manutentionnaire', 8),
  ('mise_en_place',  'Mise en place galerie',           'Livraison, installation et accrochage',                          'livraison,installation', null, 1, 1, 2, '14', false, false, false, 'chauffeur, technicien accrochage', 9),
  ('emballage_seul', 'Emballage seul (atelier)',        'Sans camion, équipe emballage',                                   'emballage', null, 1, 0, 2, null, false, false, false, 'emballeurs', 10),
  ('aller_voir',     'Aller voir (visite technique)',   'Visite sur site, véhicule léger',                                 'visite', null, 1, 0, 1, null, false, false, true, 'chef d''équipe ou coordinateur', 11),
  ('navette',        'Navette / courier accompagné',    'Enlèvement-livraison avec convoyeur',                             'enlevement,livraison', null, 1, 1, 2, '20', true, false, false, 'chauffeur, convoyeur', 12)
on conflict (code) do nothing;
insert into public.temps_standards (type_operation, libelle, duree_base_min, min_par_m3, hommes_defaut, ordre) values ('visite', 'Visite technique (aller voir)', 60, 0, 1, 8) on conflict do nothing;

alter table public.demandes
  add column if not exists scenario_code text references public.scenarios(code),
  add column if not exists nb_camions int default 1,
  add column if not exists nb_jours int default 1,
  add column if not exists date_retour date,
  add column if not exists creneau_retour text check (creneau_retour in ('matin','apres_midi','journee','rdv'));
alter table public.operations
  add column if not exists periode text default 'aller' check (periode in ('aller','retour')),
  add column if not exists jour int default 1,
  add column if not exists rotation int default 1;

alter table public.scenarios enable row level security;
drop policy if exists r_scenarios on public.scenarios; create policy r_scenarios on public.scenarios for select using (auth.uid() is not null);
drop policy if exists w_scenarios on public.scenarios; create policy w_scenarios on public.scenarios for all using (public.auth_role() in ('admin','dispatcheur')) with check (public.auth_role() in ('admin','dispatcheur'));

-- spécifique : tient compte des camions et jours
create or replace function public.calc_specifique() returns trigger language plpgsql as $$
begin
  new.specifique := coalesce(new.nb_jours,1) > 1 or coalesce(new.nb_camions,1) > 1
    or (coalesce(new.date_fin, new.date_souhaitee) > new.date_souhaitee)
    or coalesce(new.nb_hommes,2) > 2 or coalesce(new.volume_m3,0) > 20 or new.type_camion in ('27','35','50');
  return new;
end $$;
drop trigger if exists trg_specifique on public.demandes;
create trigger trg_specifique before insert or update of date_fin, date_souhaitee, nb_hommes, volume_m3, type_camion, nb_camions, nb_jours
  on public.demandes for each row execute function public.calc_specifique();
