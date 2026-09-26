-- =====================================================================
-- CAMIONNAGE 2.8 — v2_04_securite.sql
-- Additif, à exécuter après v2_03. Réexécutable sans risque.
--
-- Pourquoi : jusqu'en 2.7, les contrôles de droits étaient faits dans les routes
-- Next.js, mais la base acceptait les mêmes écritures en direct. Or la clé publique
-- Supabase est dans le navigateur de chaque utilisateur : depuis la console, un
-- chauffeur pouvait se nommer administrateur, un coordinateur accepter sa propre
-- demande, un chauffeur déclarer une mission terminée avec les heures de son choix.
-- Ici, la base devient l'arbitre : les règles s'appliquent quel que soit le chemin.
--
-- Les écritures faites par les triggers internes (profondeur > 1), par le service
-- (pas de jeton utilisateur) ou par le planning via planifier_operation restent libres.
-- =====================================================================
begin;

-- ---------- Rôle de l'utilisateur connecté, seulement si son compte est actif ----------
create or replace function public.role_actif() returns text
language sql stable security definer set search_path = public as $$
  select role from public.utilisateurs where id = auth.uid() and actif;
$$;
create or replace function public.est_planning() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.role_actif() in ('admin','dispatcheur'), false);
$$;
-- Vrai quand l'écriture ne vient pas d'un utilisateur final (service, trigger interne)
create or replace function public.ecriture_systeme() returns boolean
language sql stable as $$ select auth.uid() is null or pg_trigger_depth() > 1 $$;

-- ---------- 1. Utilisateurs : personne ne change son propre rôle ni son statut ----------
create or replace function public.garde_utilisateurs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.ecriture_systeme() or public.role_actif() = 'admin' then return new; end if;
  if new.id is distinct from old.id or new.role is distinct from old.role
     or new.actif is distinct from old.actif or new.email is distinct from old.email then
    raise exception 'Rôle, statut et email sont gérés par un administrateur' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists aa_garde_utilisateurs on public.utilisateurs;
create trigger aa_garde_utilisateurs before update on public.utilisateurs
  for each row execute function public.garde_utilisateurs();
drop policy if exists w_utilisateurs on public.utilisateurs;
create policy w_utilisateurs on public.utilisateurs for update
  using (public.role_actif() = 'admin' or (id = auth.uid() and actif))
  with check (public.role_actif() = 'admin' or id = auth.uid());

-- ---------- 2. Demandes : le circuit de validation ne se contourne plus ----------
-- Nommé « aa_ » pour passer AVANT trg_demande_modifiee et voir l'intention brute.
create or replace function public.garde_demandes() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := public.role_actif();
begin
  if public.ecriture_systeme() or r in ('admin','dispatcheur') then return coalesce(new, old); end if;
  if r is null then raise exception 'Compte inactif' using errcode = '42501'; end if;

  if tg_op = 'INSERT' then
    if new.coordinateur_id is distinct from auth.uid() then
      raise exception 'Une demande est créée à votre nom' using errcode = '42501'; end if;
    if new.etat not in ('brouillon','envoyee') or new.dispatcheur_id is not null or new.motif_refus is not null then
      raise exception 'Une nouvelle demande part en brouillon ou au planning, pas directement acceptée' using errcode = '42501'; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.etat not in ('brouillon','envoyee','refusee') then
      raise exception 'Demande prise en charge par le planning : annulez-la plutôt que de la supprimer' using errcode = '42501'; end if;
    return old;
  end if;

  -- UPDATE par le coordinateur propriétaire (la RLS a déjà vérifié la propriété)
  if new.coordinateur_id is distinct from old.coordinateur_id or new.dispatcheur_id is distinct from old.dispatcheur_id
     or new.numero is distinct from old.numero then
    raise exception 'Affectation du dossier réservée au planning' using errcode = '42501'; end if;
  if new.motif_refus is distinct from old.motif_refus and not (old.etat = 'refusee' and new.etat = 'envoyee' and new.motif_refus is null) then
    raise exception 'Le motif de refus est saisi par le planning' using errcode = '42501'; end if;
  if new.etat is distinct from old.etat and not (
       (old.etat = 'brouillon' and new.etat = 'envoyee')
    or (old.etat = 'refusee'   and new.etat = 'envoyee')
    or (old.etat in ('brouillon','envoyee','acceptee','planifiee','refusee') and new.etat = 'annulee')) then
    raise exception 'Changement d''état réservé au planning (% → %)', old.etat, new.etat using errcode = '42501'; end if;
  if new.etat = 'annulee' and old.etat <> 'annulee' and exists (
       select 1 from public.operations where demande_id = old.id and etat in ('en_route','sur_site','terminee')) then
    raise exception 'Des missions ont démarré : voyez le planning pour arrêter la suite' using errcode = '42501'; end if;
  return new;
end $$;
drop trigger if exists aa_garde_demandes on public.demandes;
create trigger aa_garde_demandes before insert or update or delete on public.demandes
  for each row execute function public.garde_demandes();

-- ---------- 3. Opérations : chacun ne touche que ce qui relève de son métier ----------
create or replace function public.garde_operations() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text := public.role_actif();
  d public.demandes%rowtype;
  affecte boolean;
  suivant jsonb := '{"planifiee":"en_route","en_route":"sur_site","sur_site":"terminee"}';
  terrain text[] := array['etat','heure_arrivee','heure_depart','compte_rendu','signature_nom','signature_data','updated_at'];
  bureau  text[] := array['consignes','libelle','adresse','updated_at'];
begin
  if public.ecriture_systeme() or r in ('admin','dispatcheur') then return coalesce(new, old); end if;
  if r is null then raise exception 'Compte inactif' using errcode = '42501'; end if;
  select * into d from public.demandes where id = coalesce(new.demande_id, old.demande_id);

  if tg_op = 'INSERT' then
    if d.coordinateur_id is distinct from auth.uid() then
      raise exception 'Vous ne pouvez ajouter des opérations qu''à vos demandes' using errcode = '42501'; end if;
    if d.etat not in ('brouillon','envoyee','refusee','acceptee') then
      raise exception 'Demande déjà en exécution : passez par le planning' using errcode = '42501'; end if;
    if new.etat <> 'a_planifier' or new.camion_id is not null or new.heure_debut is not null
       or new.heure_arrivee is not null or new.heure_depart is not null or new.compte_rendu is not null then
      raise exception 'Une nouvelle opération arrive « à planifier », sans moyens ni exécution' using errcode = '42501'; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if d.coordinateur_id is distinct from auth.uid() or old.etat not in ('a_planifier','annulee') then
      raise exception 'Seule une opération non affectée de votre demande peut être retirée' using errcode = '42501'; end if;
    return old;
  end if;

  -- UPDATE
  select exists (select 1 from public.operation_equipiers oe join public.equipiers e on e.id = oe.equipier_id
                 where oe.operation_id = old.id and e.utilisateur_id = auth.uid()) into affecte;

  if affecte then
    -- Terrain : une étape à la fois, horodatée par le serveur, jamais sur une mission future
    if (to_jsonb(new) - terrain) is distinct from (to_jsonb(old) - terrain) then
      raise exception 'Le terrain ne modifie que l''avancement et le compte rendu' using errcode = '42501'; end if;
    if new.etat is distinct from old.etat then
      if new.etat is distinct from (suivant ->> old.etat) then
        raise exception 'Étape suivante attendue : %', coalesce(suivant ->> old.etat, 'aucune') using errcode = '42501'; end if;
      if old.date_prevue is null or old.date_prevue > (now() at time zone 'Europe/Paris')::date then
        raise exception 'Cette mission est prévue à une date future' using errcode = '42501'; end if;
      if new.etat = 'sur_site' then new.heure_arrivee := now(); end if;
      if new.etat = 'terminee' then new.heure_depart := now(); end if;
    end if;
    if new.etat = old.etat and (new.heure_arrivee is distinct from old.heure_arrivee or new.heure_depart is distinct from old.heure_depart) then
      raise exception 'Les heures d''arrivée et de départ sont relevées automatiquement' using errcode = '42501'; end if;
    return new;
  end if;

  if d.coordinateur_id = auth.uid() then
    -- Bureau : consignes et lieu tant que la mission n'a pas démarré, annulation d'une mission non démarrée
    if old.etat not in ('a_planifier','planifiee') then
      raise exception 'Mission démarrée ou close : voyez le planning' using errcode = '42501'; end if;
    if new.etat = 'annulee' and old.etat <> 'annulee' then
      if (to_jsonb(new) - (bureau || array['etat'])) is distinct from (to_jsonb(old) - (bureau || array['etat'])) then
        raise exception 'Annulation : aucune autre modification possible' using errcode = '42501'; end if;
      return new;
    end if;
    if old.etat = 'a_planifier' then bureau := bureau || array['date_prevue','duree_min']; end if;
    if (to_jsonb(new) - bureau) is distinct from (to_jsonb(old) - bureau) then
      raise exception 'Horaire, camion et état sont affectés par le planning' using errcode = '42501'; end if;
    return new;
  end if;

  raise exception 'Cette mission ne vous concerne pas' using errcode = '42501';
end $$;
drop trigger if exists aa_garde_operations on public.operations;
create trigger aa_garde_operations before insert or update or delete on public.operations
  for each row execute function public.garde_operations();

-- ---------- 4. Report ou modification d'une demande : les missions suivent ----------
-- Avant : seule une demande entièrement « planifiée » était remise au planning. Une demande
-- partiellement affectée gardait ses camions à l'ancienne date, et aucune opération ne
-- suivait un changement de date (le camion partait le jour initialement prévu).
create or replace function public.trg_demande_modifiee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.etat in ('terminee','annulee','refusee') then return new; end if;
  if (old.date_souhaitee is distinct from new.date_souhaitee or old.date_retour is distinct from new.date_retour
      or old.creneau is distinct from new.creneau or old.rdv_heure is distinct from new.rdv_heure
      or old.nb_hommes is distinct from new.nb_hommes or old.type_camion is distinct from new.type_camion
      or old.volume_m3 is distinct from new.volume_m3 or old.besoin_hayon is distinct from new.besoin_hayon
      or old.besoin_clim is distinct from new.besoin_clim
      or old.adresse_enlevement is distinct from new.adresse_enlevement or old.adresse_livraison is distinct from new.adresse_livraison)
     and exists (select 1 from public.operations where demande_id = new.id and etat = 'planifiee') then
    if old.etat = 'planifiee' and new.etat = old.etat then new.etat := 'acceptee'; end if;
    insert into public.notifications (destinataire_id, type, demande_id, titre, message)
    select u.id, 'modifiee', new.id, 'Demande ' || new.numero || ' modifiée',
           'Date, horaire, équipe, véhicule ou adresse ont changé : les missions non démarrées sont revenues à affecter.'
      from public.utilisateurs u
     where u.actif and (u.id = new.dispatcheur_id or (new.dispatcheur_id is null and u.role in ('dispatcheur','admin')));
  end if;
  return new;
end $$;

create or replace function public.trg_demande_deplanifier() returns trigger
language plpgsql security definer set search_path = public as $$
declare ecart_aller int; ecart_retour int; cles_modifiees boolean;
begin
  if old.etat in ('terminee','annulee','refusee') then return new; end if;
  ecart_aller  := coalesce(new.date_souhaitee - old.date_souhaitee, 0);
  ecart_retour := coalesce(new.date_retour - old.date_retour, 0);
  cles_modifiees := ecart_aller <> 0 or ecart_retour <> 0
      or old.creneau is distinct from new.creneau or old.rdv_heure is distinct from new.rdv_heure
      or old.nb_hommes is distinct from new.nb_hommes or old.type_camion is distinct from new.type_camion
      or old.volume_m3 is distinct from new.volume_m3 or old.besoin_hayon is distinct from new.besoin_hayon
      or old.besoin_clim is distinct from new.besoin_clim
      or old.adresse_enlevement is distinct from new.adresse_enlevement or old.adresse_livraison is distinct from new.adresse_livraison;
  if not cles_modifiees then return new; end if;
  -- 1. les moyens déjà affectés aux missions non démarrées sont libérés
  delete from public.operation_equipiers where operation_id in
    (select id from public.operations where demande_id = new.id and etat = 'planifiee');
  update public.operations set etat = 'a_planifier', camion_id = null, heure_debut = null
   where demande_id = new.id and etat = 'planifiee';
  -- 2. les missions non démarrées glissent avec la nouvelle date
  if ecart_aller <> 0 then
    update public.operations set date_prevue = date_prevue + ecart_aller
     where demande_id = new.id and etat = 'a_planifier' and coalesce(periode,'aller') = 'aller' and date_prevue is not null;
  end if;
  if ecart_retour <> 0 then
    update public.operations set date_prevue = date_prevue + ecart_retour
     where demande_id = new.id and etat = 'a_planifier' and periode = 'retour' and date_prevue is not null;
  end if;
  return new;
end $$;

-- ---------- 5. Photos : seulement l'équipe de la mission ou le planning ----------
drop policy if exists w_photos on public.operation_photos;
create policy w_photos on public.operation_photos for insert with check (
  public.est_planning() or exists (
    select 1 from public.operation_equipiers oe join public.equipiers e on e.id = oe.equipier_id
     where oe.operation_id = operation_photos.operation_id and e.utilisateur_id = auth.uid()));

-- ---------- 6. Notifications : plus de messages fabriqués au nom du système ----------
drop policy if exists i_notif on public.notifications;
create policy i_notif on public.notifications for insert with check (
  public.est_planning() or exists (
    select 1 from public.demandes d
     where d.id = notifications.demande_id and d.coordinateur_id = auth.uid()
       and notifications.destinataire_id = d.dispatcheur_id));

commit;
