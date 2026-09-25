-- Mise à jour additive depuis v2 / v2.1 / v2.1.1. Ne pas rejouer v2_01_schema.sql.
begin;
alter table public.demandes
 add column if not exists enlevement_rue text, add column if not exists enlevement_code_postal text,
 add column if not exists enlevement_ville text, add column if not exists enlevement_pays text,
 add column if not exists enlevement_lat double precision, add column if not exists enlevement_lng double precision,
 add column if not exists livraison_rue text, add column if not exists livraison_code_postal text,
 add column if not exists livraison_ville text, add column if not exists livraison_pays text,
 add column if not exists livraison_lat double precision, add column if not exists livraison_lng double precision;
alter table public.camions
 add column if not exists hauteur_cm integer check (hauteur_cm > 0),
 add column if not exists largeur_cm integer check (largeur_cm > 0),
 add column if not exists longueur_cm integer check (longueur_cm > 0),
 add column if not exists ptac_kg integer check (ptac_kg > 0),
 add column if not exists essieux integer check (essieux between 2 and 10);
-- Les anciennes adresses ne sont pas découpées automatiquement : aucune ville inventée.
create or replace function public.sync_operation_addresses() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 if new.adresse_enlevement is distinct from old.adresse_enlevement or new.adresse_livraison is distinct from old.adresse_livraison then
   update public.operations set adresse=case
     when type_operation='enlevement' then case when periode='retour' then new.adresse_livraison else new.adresse_enlevement end
     else case when periode='retour' then new.adresse_enlevement else new.adresse_livraison end end
   where demande_id=new.id and type_operation in ('enlevement','livraison','installation') and etat in ('a_planifier','planifiee');
 end if;
 return new;
end $$;
drop trigger if exists sync_operation_addresses on public.demandes;
create trigger sync_operation_addresses after update of adresse_enlevement,adresse_livraison on public.demandes for each row execute function public.sync_operation_addresses();

-- Un recalcul d'état après retrait d'une seule opération ne doit pas vider toute la demande.
create or replace function public.trg_demande_deplanifier() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.etat='planifiee' and new.etat='acceptee' and (
 old.date_souhaitee is distinct from new.date_souhaitee or old.creneau is distinct from new.creneau
 or old.rdv_heure is distinct from new.rdv_heure or old.nb_hommes is distinct from new.nb_hommes
 or old.type_camion is distinct from new.type_camion or old.volume_m3 is distinct from new.volume_m3
 or old.adresse_enlevement is distinct from new.adresse_enlevement or old.adresse_livraison is distinct from new.adresse_livraison) then
 delete from public.operation_equipiers where operation_id in (select id from public.operations where demande_id=new.id and etat='planifiee');
 update public.operations set etat='a_planifier',camion_id=null where demande_id=new.id and etat='planifiee';
 end if;
 return new;
end $$;

-- Une affectation est enregistrée en une transaction. Sérialise les réservations via cette fonction.
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
 delete from public.operation_equipiers where operation_id=p_id;
 insert into public.operation_equipiers(operation_id,equipier_id,chef) select p_id,x.id,x.n=1 from unnest(p_equipiers) with ordinality as x(id,n);
end $$;
revoke all on function public.planifier_operation(uuid,date,time,integer,uuid,uuid[],text,text,boolean) from public;
grant execute on function public.planifier_operation(uuid,date,time,integer,uuid,uuid[],text,text,boolean) to authenticated;
commit;
