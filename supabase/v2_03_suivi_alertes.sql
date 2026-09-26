-- Additif : après v2_02. Aucun envoi réseau depuis cette migration.
create table if not exists public.email_alerts (
 id uuid primary key default gen_random_uuid(),
 demande_id uuid not null references public.demandes(id) on delete cascade,
 recipient_id uuid not null references public.utilisateurs(id) on delete cascade,
 event_key text not null, subject text not null, message text not null,
 status text not null default 'pending' check(status in ('pending','sending','accepted','paused','failed','uncertain','skipped')),
 attempts int not null default 0, available_at timestamptz not null default now(),
 created_at timestamptz not null default now(), processed_at timestamptz,
 provider_id text, last_error text,
 unique(recipient_id,event_key)
);
alter table public.email_alerts enable row level security;
revoke all on public.email_alerts from anon,authenticated;
grant select on public.email_alerts to authenticated;
grant all on public.email_alerts to service_role;
drop policy if exists read_email_alerts on public.email_alerts;
create policy read_email_alerts on public.email_alerts for select to authenticated using (
 exists(select 1 from public.utilisateurs where id=auth.uid() and actif and role in ('admin','dispatcheur'))
);
create index if not exists email_alerts_pending on public.email_alerts(status,available_at);

create or replace function public.queue_demande_email() returns trigger
language plpgsql security definer set search_path=public as $$
declare title text; body text; recipient uuid; ev text;
begin
 if tg_op='UPDATE' and old.etat is not distinct from new.etat then return new; end if;
 if new.etat='brouillon' then return new; end if;
 title:=case new.etat when 'envoyee' then 'Demande à valider' when 'acceptee' then 'Demande à affecter' when 'planifiee' then 'Toutes les opérations sont affectées' when 'en_cours' then 'Réalisation en cours' when 'terminee' then 'Opérations réalisées — retour à vérifier' when 'refusee' then 'Demande refusée' when 'annulee' then 'Demande annulée' end;
 if title is null then return new; end if;
 body:=case new.etat when 'envoyee' then 'Planning : examinez la demande, puis acceptez-la ou indiquez un motif de refus.' when 'acceptee' then 'Planning : affectez ou revérifiez les véhicules, horaires et équipes. Acceptation ne signifie pas affectation.' when 'planifiee' then 'Les opérations sont affectées. Consultez le planning et les consignes dans le dossier.' when 'en_cours' then 'Une équipe a démarré une opération. Suivez la réalisation dans le dossier.' when 'terminee' then 'Coordinateur : vérifiez les horaires, comptes rendus et réserves. Cette étape ne signifie pas que la demande est facturée.' when 'refusee' then 'Coordinateur : consultez le motif du refus dans le dossier.' else 'Consultez le dossier avant tout nouveau déplacement.' end;
 delete from public.email_alerts where demande_id=new.id and status='pending' and event_key like 'operation:%:'||txid_current();
 ev:='demande:'||new.id||':'||new.etat||':'||txid_current();
 for recipient in select distinct u.id from public.utilisateurs u where u.actif and (u.id=new.coordinateur_id or u.id=new.dispatcheur_id or (new.dispatcheur_id is null and u.role in ('dispatcheur','admin'))) loop
  insert into public.email_alerts(demande_id,recipient_id,event_key,subject,message) values(new.id,recipient,ev,coalesce(new.numero,'Demande')||' · '||title,body) on conflict do nothing;
 end loop;
 return new;
end $$;
revoke all on function public.queue_demande_email() from public,anon,authenticated;
drop trigger if exists trg_email_demande on public.demandes;
create trigger trg_email_demande after insert or update of etat on public.demandes for each row execute function public.queue_demande_email();

-- Alerte après une modification concrète de mission, même si l'état global ne change pas.
create or replace function public.queue_operation_email() returns trigger
language plpgsql security definer set search_path=public as $$
declare d public.demandes; recipient uuid; title text;
begin
 if old.etat is not distinct from new.etat and old.date_prevue is not distinct from new.date_prevue and old.heure_debut is not distinct from new.heure_debut and old.camion_id is not distinct from new.camion_id and old.consignes is not distinct from new.consignes and old.compte_rendu is not distinct from new.compte_rendu then return new; end if;
 if new.etat not in ('planifiee','terminee','annulee') then return new; end if;
 select * into d from public.demandes where id=new.demande_id;
 title:=case new.etat when 'terminee' then 'Retour de mission disponible ou à compléter' when 'annulee' then 'Mission annulée' else 'Affectation ou consignes mises à jour' end;
 for recipient in select distinct u.id from public.utilisateurs u where u.actif and (u.id=d.coordinateur_id or u.id=d.dispatcheur_id or (d.dispatcheur_id is null and u.role in ('dispatcheur','admin'))) loop
 if exists(select 1 from public.email_alerts where demande_id=d.id and recipient_id=recipient and event_key like 'demande:%:'||txid_current()) then continue; end if;
 insert into public.email_alerts(demande_id,recipient_id,event_key,subject,message)
 values(d.id,recipient,'operation:'||new.id||':'||txid_current(),d.numero||' · '||title,'Consultez les missions et le retour du terrain dans le dossier. Vérifiez les horaires, les moyens et les réserves avant la prochaine étape.') on conflict do nothing;
 end loop;
 return new;
end $$;
revoke all on function public.queue_operation_email() from public,anon,authenticated;
drop trigger if exists trg_email_operation on public.operations;
create trigger trg_email_operation after update on public.operations for each row execute function public.queue_operation_email();

create or replace function public.claim_email_alerts() returns setof public.email_alerts
language sql security definer set search_path=public as $$
 update public.email_alerts set status='sending',attempts=attempts+1,processed_at=now()
 where id in(select id from public.email_alerts where status='pending' and available_at<=now() and attempts<5 order by created_at for update skip locked limit 5)
 returning *;
$$;
revoke all on function public.claim_email_alerts() from public,anon,authenticated;
grant execute on function public.claim_email_alerts() to service_role;

-- Une mission réalisée avec un retour encore à faire reste en cours.
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
      when encours > 0 or term > 0 then 'en_cours'
      when planif = total then 'planifiee'
      else 'acceptee' end
  where id = p_demande;
end $$;


create or replace function public.queue_team_email() returns trigger
language plpgsql security definer set search_path=public as $$
declare op public.operations; d public.demandes; recipient uuid;
begin
 select * into op from public.operations where id=coalesce(new.operation_id,old.operation_id);
 if op.id is null or op.etat<>'planifiee' then return coalesce(new,old); end if;
 select * into d from public.demandes where id=op.demande_id;
 for recipient in select distinct u.id from public.utilisateurs u where u.actif and (u.id=d.coordinateur_id or u.id=d.dispatcheur_id or (d.dispatcheur_id is null and u.role in ('dispatcheur','admin'))) loop
 if exists(select 1 from public.email_alerts where demande_id=d.id and recipient_id=recipient and event_key like 'demande:%:'||txid_current()) then continue; end if;
 insert into public.email_alerts(demande_id,recipient_id,event_key,subject,message)
 values(d.id,recipient,'operation:'||op.id||':'||txid_current(),d.numero||' · Équipe de mission mise à jour','Consultez le dossier pour connaître la composition actuelle de l’équipe et les consignes.') on conflict do nothing;
 end loop;
 return coalesce(new,old);
end $$;
revoke all on function public.queue_team_email() from public,anon,authenticated;
drop trigger if exists trg_email_team on public.operation_equipiers;
create trigger trg_email_team after insert or delete or update on public.operation_equipiers for each row execute function public.queue_team_email();
