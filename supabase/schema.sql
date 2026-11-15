-- =====================================================================
--  LuxDrive — base de données (Supabase / PostgreSQL)
--  Auto École Lisboa · Differdange (Luxembourg)
--  À exécuter une seule fois dans Supabase → SQL Editor → New query.
-- =====================================================================

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------

create table public.auto_ecoles (
  id                 uuid primary key default gen_random_uuid(),
  nom                text not null,
  adresse            text,
  telephone          text,
  email              text,
  numero_tva         text,
  numero_agrement    text,
  beneficiaire       text,
  iban               text,
  langue_defaut      text not null default 'fr' check (langue_defaut in ('fr','en','pt')),
  fuseau             text not null default 'Europe/Luxembourg',
  delai_annulation_h integer not null default 48 check (delai_annulation_h >= 0),
  max_lecons_semaine integer not null default 4 check (max_lecons_semaine >= 1),
  delai_reservation_h integer not null default 2 check (delai_reservation_h >= 0),
  jours_ouverture    integer[] not null default '{1,2,3,4,5,6}',          -- 1 = lundi … 7 = dimanche
  heures_lecons      integer[] not null default '{8,9,10,11,13,14,15,16,17,18}',
  created_at         timestamptz not null default now()
);

create table public.profils (
  id              uuid primary key references auth.users(id) on delete cascade,
  auto_ecole_id   uuid not null references public.auto_ecoles(id),
  role            text not null check (role in ('gerant','secretariat','moniteur','eleve','lecture')),
  prenom          text not null,
  nom             text not null,
  telephone       text,
  langue          text not null default 'fr' check (langue in ('fr','en','pt')),
  actif           boolean not null default true,
  consentement_le timestamptz,
  created_at      timestamptz not null default now()
);

create table public.eleves (
  id                   uuid primary key references public.profils(id) on delete cascade,
  auto_ecole_id        uuid not null references public.auto_ecoles(id),
  date_naissance       date,
  adresse              text,
  categorie            text not null default 'B',
  regime               text not null default 'classique' check (regime in ('classique','accompagnee')),
  certificat_numero    text,
  certificat_validite  date,
  examen_medical_le    date,
  theorie_reussie_le   date,
  date_inscription     date not null default current_date,
  moniteur_referent_id uuid references public.profils(id)
);

create table public.accompagnateurs (
  id              uuid primary key default gen_random_uuid(),
  eleve_id        uuid not null unique references public.eleves(id) on delete cascade,
  prenom          text not null,
  nom             text not null,
  telephone       text not null,
  email           text,
  piece_verifiee  boolean not null default false
);

create table public.fermetures (
  id            uuid primary key default gen_random_uuid(),
  auto_ecole_id uuid not null references public.auto_ecoles(id),
  jour          date not null,
  libelle       text not null,
  unique (auto_ecole_id, jour)
);

create table public.indisponibilites (
  id            uuid primary key default gen_random_uuid(),
  auto_ecole_id uuid not null references public.auto_ecoles(id),
  moniteur_id   uuid not null references public.profils(id) on delete cascade,
  debut         timestamptz not null,
  fin           timestamptz not null,
  motif         text,
  check (fin > debut)
);

create table public.lecons (
  id                       uuid primary key default gen_random_uuid(),
  auto_ecole_id            uuid not null references public.auto_ecoles(id),
  eleve_id                 uuid not null references public.eleves(id),
  moniteur_id              uuid not null references public.profils(id),
  debut                    timestamptz not null,
  fin                      timestamptz not null,
  statut                   text not null default 'reservee'
                           check (statut in ('reservee','effectuee','annulee','annulee_tardive','absence')),
  reservee_par             text not null default 'eleve' check (reservee_par in ('eleve','bureau')),
  avec_accompagnateur      boolean not null default false,
  apres_echec              boolean not null default false,
  commentaire              text,
  points                   text[],
  signature                jsonb,              -- tracé vectoriel compressé (léger)
  signee_le                timestamptz,
  annulee_le               timestamptz,
  justificatif_statut      text check (justificatif_statut in ('attente','accepte','refuse')),
  justificatif_chemin      text,               -- fichier privé, supprimé après décision
  justificatif_motif       text,
  justificatif_decide_par  uuid references public.profils(id),
  justificatif_decide_le   timestamptz,
  created_at               timestamptz not null default now(),
  check (fin > debut),
  -- Jamais deux leçons en même temps pour un moniteur ou pour un élève
  constraint lecons_moniteur_sans_chevauchement exclude using gist
    (moniteur_id with =, tstzrange(debut, fin) with &&) where (statut in ('reservee','effectuee','absence')),
  constraint lecons_eleve_sans_chevauchement exclude using gist
    (eleve_id with =, tstzrange(debut, fin) with &&) where (statut in ('reservee','effectuee','absence'))
);
create index lecons_debut_idx on public.lecons (auto_ecole_id, debut);

create table public.seances_theorie (
  id            uuid primary key default gen_random_uuid(),
  auto_ecole_id uuid not null references public.auto_ecoles(id),
  moniteur_id   uuid not null references public.profils(id),
  debut         timestamptz not null,
  fin           timestamptz not null,
  theme         text not null,
  langue        text not null default 'fr',
  places        integer,
  pointee       boolean not null default false,
  check (fin > debut)
);

create table public.presences_theorie (
  seance_id uuid not null references public.seances_theorie(id) on delete cascade,
  eleve_id  uuid not null references public.eleves(id) on delete cascade,
  present   boolean not null default false,
  primary key (seance_id, eleve_id)
);

create table public.examens (
  id            uuid primary key default gen_random_uuid(),
  auto_ecole_id uuid not null references public.auto_ecoles(id),
  eleve_id      uuid not null references public.eleves(id) on delete cascade,
  type          text not null check (type in ('theorique','pratique')),
  date          timestamptz not null,
  resultat      text not null default 'a_venir' check (resultat in ('a_venir','reussi','echoue'))
);

create table public.formules (
  id            uuid primary key default gen_random_uuid(),
  auto_ecole_id uuid not null references public.auto_ecoles(id),
  code          text not null,
  nom           text not null,
  heures        integer not null check (heures > 0),
  prix_ttc      numeric(10,2) not null check (prix_ttc >= 0),
  taux_tva      numeric(5,2) not null default 17,
  active        boolean not null default true,
  ordre         integer not null default 0,
  unique (auto_ecole_id, code)
);

create table public.inscription_lignes (
  id            uuid primary key default gen_random_uuid(),
  auto_ecole_id uuid not null references public.auto_ecoles(id),
  libelle       text not null,
  montant_ht    numeric(10,2) not null,
  taux_tva      numeric(5,2) not null default 0,
  ordre         integer not null default 0
);

create table public.compteurs_factures (
  auto_ecole_id uuid not null references public.auto_ecoles(id),
  annee         integer not null,
  dernier       integer not null default 0,
  primary key (auto_ecole_id, annee)
);

create table public.factures (
  id                 uuid primary key default gen_random_uuid(),
  auto_ecole_id      uuid not null references public.auto_ecoles(id),
  numero             text not null,
  formule_code       text,
  eleve_id           uuid not null references public.eleves(id),
  objet              text not null,
  date_emission      date not null default current_date,
  echeance           date not null,
  statut             text not null default 'a_payer' check (statut in ('a_payer','payee','annulee')),
  moyen_annonce      text check (moyen_annonce in ('wero','virement','especes')),
  heures_a_crediter  integer not null default 0,
  heures_creditees   boolean not null default false,
  total_ht           numeric(10,2) not null default 0,
  total_tva          numeric(10,2) not null default 0,
  total_ttc          numeric(10,2) not null default 0,
  created_at         timestamptz not null default now(),
  unique (auto_ecole_id, numero)
);

create table public.lignes_facture (
  id          uuid primary key default gen_random_uuid(),
  facture_id  uuid not null references public.factures(id) on delete cascade,
  libelle     text not null,
  quantite    integer not null default 1,
  montant_ht  numeric(10,2) not null,
  taux_tva    numeric(5,2) not null,
  montant_tva numeric(10,2) not null,
  montant_ttc numeric(10,2) not null,
  ordre       integer not null default 0
);

create table public.paiements (
  id           uuid primary key default gen_random_uuid(),
  facture_id   uuid not null references public.factures(id),
  montant      numeric(10,2) not null,
  moyen        text not null check (moyen in ('wero','virement','especes')),
  reference    text,
  encaisse_par uuid references public.profils(id),
  created_at   timestamptz not null default now()
);

create table public.mouvements_heures (
  id            uuid primary key default gen_random_uuid(),
  auto_ecole_id uuid not null references public.auto_ecoles(id),
  eleve_id      uuid not null references public.eleves(id) on delete cascade,
  type          text not null check (type in ('achat','reservation','recredit_annulation','recredit_certificat','ajustement')),
  heures        numeric(5,1) not null,
  lecon_id      uuid references public.lecons(id),
  facture_id    uuid references public.factures(id),
  motif         text,
  cree_par      uuid references public.profils(id),
  created_at    timestamptz not null default now()
);
create index mouvements_eleve_idx on public.mouvements_heures (eleve_id);

create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references public.profils(id) on delete cascade,
  type           text not null,
  titre          text not null,
  contenu        text,
  lien           text,
  lue            boolean not null default false,
  created_at     timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (utilisateur_id, created_at desc);

create table public.journal (
  id             uuid primary key default gen_random_uuid(),
  auto_ecole_id  uuid references public.auto_ecoles(id),
  utilisateur_id uuid,
  action         text not null,
  element        text,
  details        jsonb,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Fonctions d'aide (rôle de la personne connectée)
-- ---------------------------------------------------------------------

create or replace function public.mon_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profils where id = auth.uid() and actif
$$;

create or replace function public.mon_ecole() returns uuid
language sql stable security definer set search_path = public as $$
  select auto_ecole_id from profils where id = auth.uid() and actif
$$;

create or replace function public.est_bureau() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mon_role() in ('gerant','secretariat'), false)
$$;

create or replace function public.est_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mon_role() in ('gerant','secretariat','moniteur','lecture'), false)
$$;

create or replace function public.voit_tout() returns boolean   -- bureau + lecture seule
language sql stable security definer set search_path = public as $$
  select coalesce(public.mon_role() in ('gerant','secretariat','lecture'), false)
$$;

create or replace function public.est_service() returns boolean  -- appels serveur (webhook Wero)
language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
$$;

create or replace function public.notifier(p_user uuid, p_type text, p_titre text, p_contenu text default null, p_lien text default null)
returns void language sql security definer set search_path = public as $$
  insert into notifications (utilisateur_id, type, titre, contenu, lien) values (p_user, p_type, p_titre, p_contenu, p_lien)
$$;

create or replace function public.journaliser(p_action text, p_element text, p_details jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into journal (auto_ecole_id, utilisateur_id, action, element, details)
  values (public.mon_ecole(), auth.uid(), p_action, p_element, p_details)
$$;

-- ---------------------------------------------------------------------
-- 3. Vues de lecture (respectent les droits de chacun)
-- ---------------------------------------------------------------------

create view public.soldes as
  select e.id as eleve_id,
         coalesce((select sum(m.heures) from mouvements_heures m where m.eleve_id = e.id), 0) as solde_heures,
         (select count(*) from presences_theorie p where p.eleve_id = e.id and p.present)    as theorie_faites,
         (select count(*) from lecons l where l.eleve_id = e.id and l.statut = 'effectuee')  as pratique_faites
  from eleves e
  where e.id = auth.uid() or (e.auto_ecole_id = public.mon_ecole() and public.est_staff());
revoke all on public.soldes from anon;

-- Vues pour l'affichage (les droits de chacun s'appliquent)
create view public.v_lecons with (security_invoker = true) as
  select l.*, pe.prenom as eleve_prenom, pe.nom as eleve_nom, pm.prenom as moniteur_prenom, pm.nom as moniteur_nom
  from lecons l
  join profils pe on pe.id = l.eleve_id
  join profils pm on pm.id = l.moniteur_id;

create view public.v_factures with (security_invoker = true) as
  select f.*, p.prenom as eleve_prenom, p.nom as eleve_nom
  from factures f join profils p on p.id = f.eleve_id;

create view public.v_eleves with (security_invoker = true) as
  select e.*, p.prenom, p.nom, p.telephone, p.langue, p.actif,
         coalesce(s.solde_heures, 0) as solde_heures, coalesce(s.theorie_faites, 0) as theorie_faites,
         coalesce(s.pratique_faites, 0) as pratique_faites
  from eleves e join profils p on p.id = e.id
  left join soldes s on s.eleve_id = e.id;

-- ---------------------------------------------------------------------
-- 4. Règles métier
-- ---------------------------------------------------------------------

-- Créneaux libres d'un jour (pour un moniteur précis ou « peu importe »)
create or replace function public.creneaux_libres(p_jour date, p_moniteur uuid default null, p_eleve uuid default null)
returns table (debut timestamptz, moniteur_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  v_eleve uuid := coalesce(p_eleve, auth.uid());
  v_ecole uuid := public.mon_ecole();
  v_ae    auto_ecoles;
  v_ref   uuid;
  h       integer;
  v_ts    timestamptz;
  v_mon   uuid;
begin
  if v_ecole is null then raise exception 'NON_CONNECTE'; end if;
  if p_eleve is not null and not public.est_bureau() then raise exception 'INTERDIT'; end if;
  select * into v_ae from auto_ecoles where id = v_ecole;
  if not (extract(isodow from p_jour)::int = any (v_ae.jours_ouverture)) then return; end if;
  if exists (select 1 from fermetures f where f.auto_ecole_id = v_ecole and f.jour = p_jour) then return; end if;
  select moniteur_referent_id into v_ref from eleves where id = v_eleve;

  foreach h in array v_ae.heures_lecons loop
    v_ts := (p_jour + make_time(h, 0, 0)) at time zone v_ae.fuseau;
    continue when v_ts < now() + make_interval(hours => v_ae.delai_reservation_h);
    continue when exists (select 1 from lecons l where l.eleve_id = v_eleve
                          and l.statut in ('reservee','effectuee','absence')
                          and tstzrange(l.debut, l.fin) && tstzrange(v_ts, v_ts + interval '1 hour'));
    select p.id into v_mon
    from profils p
    where p.auto_ecole_id = v_ecole and p.role = 'moniteur' and p.actif
      and (p_moniteur is null or p.id = p_moniteur)
      and not exists (select 1 from lecons l where l.moniteur_id = p.id
                      and l.statut in ('reservee','effectuee','absence')
                      and tstzrange(l.debut, l.fin) && tstzrange(v_ts, v_ts + interval '1 hour'))
      and not exists (select 1 from indisponibilites i where i.moniteur_id = p.id
                      and tstzrange(i.debut, i.fin) && tstzrange(v_ts, v_ts + interval '1 hour'))
      and not exists (select 1 from seances_theorie s where s.moniteur_id = p.id
                      and tstzrange(s.debut, s.fin) && tstzrange(v_ts, v_ts + interval '1 hour'))
    order by (p.id = v_ref) desc nulls last, p.prenom
    limit 1;
    if v_mon is not null then
      debut := v_ts; moniteur_id := v_mon; return next;
    end if;
  end loop;
end $$;

-- Réservation d'une leçon par l'élève (ou planification par le bureau)
create or replace function public.reserver_lecon(p_debut timestamptz, p_moniteur uuid default null, p_eleve uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_bureau boolean := p_eleve is not null;
  v_eleve  uuid := coalesce(p_eleve, auth.uid());
  v_el     eleves;
  v_ae     auto_ecoles;
  v_solde  numeric;
  v_nb     integer;
  v_mon    uuid;
  v_id     uuid;
  v_local  timestamp;
begin
  if v_bureau and not public.est_bureau() then raise exception 'INTERDIT'; end if;
  select * into v_el from eleves where id = v_eleve;
  if not found or v_el.auto_ecole_id is distinct from public.mon_ecole() then raise exception 'ELEVE_INCONNU'; end if;
  select * into v_ae from auto_ecoles where id = v_el.auto_ecole_id;

  if v_el.theorie_reussie_le is null and not v_bureau then raise exception 'THEORIE_NON_REUSSIE'; end if;

  perform pg_advisory_xact_lock(hashtext(v_eleve::text));
  select coalesce(sum(heures), 0) into v_solde from mouvements_heures where eleve_id = v_eleve;
  if v_solde < 1 then raise exception 'SOLDE_INSUFFISANT'; end if;

  v_local := p_debut at time zone v_ae.fuseau;
  select count(*) into v_nb from lecons
   where eleve_id = v_eleve and statut in ('reservee','effectuee','absence')
     and date_trunc('week', debut at time zone v_ae.fuseau) = date_trunc('week', v_local);
  if v_nb >= v_ae.max_lecons_semaine and not v_bureau then raise exception 'MAXIMUM_SEMAINE'; end if;

  select c.moniteur_id into v_mon
    from public.creneaux_libres(v_local::date, p_moniteur, case when v_bureau then v_eleve end) c
   where c.debut = p_debut;
  if v_mon is null then raise exception 'CRENEAU_INDISPONIBLE'; end if;

  insert into lecons (auto_ecole_id, eleve_id, moniteur_id, debut, fin, reservee_par)
  values (v_el.auto_ecole_id, v_eleve, v_mon, p_debut, p_debut + interval '1 hour',
          case when v_bureau then 'bureau' else 'eleve' end)
  returning id into v_id;

  insert into mouvements_heures (auto_ecole_id, eleve_id, type, heures, lecon_id, cree_par)
  values (v_el.auto_ecole_id, v_eleve, 'reservation', -1, v_id, auth.uid());

  perform public.notifier(v_eleve, 'reservation', 'Leçon réservée',
    to_char(v_local, 'DD/MM/YYYY "à" HH24:MI'), '/lecons/' || v_id);
  perform public.notifier(v_mon, 'reservation', 'Nouvelle leçon',
    to_char(v_local, 'DD/MM/YYYY "à" HH24:MI'), '/lecons/' || v_id);
  return v_id;
end $$;

-- Annulation : gratuite jusqu'au délai (48 h), sinon heure due (sauf certificat médical)
create or replace function public.annuler_lecon(p_lecon uuid, p_recrediter boolean default false)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_l   lecons;
  v_ae  auto_ecoles;
  v_bureau boolean := public.est_bureau();
begin
  select * into v_l from lecons where id = p_lecon for update;
  if not found then raise exception 'LECON_INCONNUE'; end if;
  if not (v_l.eleve_id = auth.uid() or (v_bureau and v_l.auto_ecole_id = public.mon_ecole())) then raise exception 'INTERDIT'; end if;
  if v_l.statut <> 'reservee' then raise exception 'NON_ANNULABLE'; end if;
  if v_l.debut <= now() then raise exception 'LECON_COMMENCEE'; end if;
  select * into v_ae from auto_ecoles where id = v_l.auto_ecole_id;

  if v_l.debut - now() >= make_interval(hours => v_ae.delai_annulation_h) or (v_bureau and p_recrediter) then
    update lecons set statut = 'annulee', annulee_le = now() where id = p_lecon;
    insert into mouvements_heures (auto_ecole_id, eleve_id, type, heures, lecon_id, cree_par)
    values (v_l.auto_ecole_id, v_l.eleve_id, 'recredit_annulation', 1, p_lecon, auth.uid());
    perform public.notifier(v_l.moniteur_id, 'annulation', 'Leçon annulée', null, '/lecons/' || p_lecon);
    return 'libre';
  else
    update lecons set statut = 'annulee_tardive', annulee_le = now() where id = p_lecon;
    perform public.notifier(v_l.moniteur_id, 'annulation', 'Leçon annulée (moins de 48 h)', null, '/lecons/' || p_lecon);
    return 'tardive';
  end if;
end $$;

-- L'élève joint un certificat médical à une annulation tardive
create or replace function public.deposer_certificat(p_lecon uuid, p_chemin text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_l lecons;
begin
  select * into v_l from lecons where id = p_lecon for update;
  if not found or v_l.eleve_id <> auth.uid() then raise exception 'INTERDIT'; end if;
  if v_l.statut <> 'annulee_tardive' or v_l.justificatif_statut is not null then raise exception 'NON_AUTORISE'; end if;
  if split_part(p_chemin, '/', 1) <> auth.uid()::text then raise exception 'CHEMIN_INVALIDE'; end if;
  update lecons set justificatif_statut = 'attente', justificatif_chemin = p_chemin where id = p_lecon;
end $$;

-- Le bureau accepte ou refuse le certificat. Renvoie le chemin du fichier, que l'app supprime ensuite.
create or replace function public.decider_certificat(p_lecon uuid, p_accepte boolean, p_motif text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare v_l lecons;
begin
  if not public.est_bureau() then raise exception 'INTERDIT'; end if;
  select * into v_l from lecons where id = p_lecon for update;
  if not found or v_l.auto_ecole_id <> public.mon_ecole() then raise exception 'LECON_INCONNUE'; end if;
  if v_l.justificatif_statut is distinct from 'attente' then raise exception 'DEJA_TRAITE'; end if;
  if not p_accepte and coalesce(trim(p_motif), '') = '' then raise exception 'MOTIF_OBLIGATOIRE'; end if;

  update lecons set justificatif_statut = case when p_accepte then 'accepte' else 'refuse' end,
                    justificatif_motif = case when p_accepte then null else p_motif end,
                    justificatif_decide_par = auth.uid(), justificatif_decide_le = now(),
                    justificatif_chemin = null
   where id = p_lecon;
  if p_accepte then
    insert into mouvements_heures (auto_ecole_id, eleve_id, type, heures, lecon_id, cree_par)
    values (v_l.auto_ecole_id, v_l.eleve_id, 'recredit_certificat', 1, p_lecon, auth.uid());
    perform public.notifier(v_l.eleve_id, 'certificat', 'Certificat accepté : 1 h recréditée');
  else
    perform public.notifier(v_l.eleve_id, 'certificat', 'Certificat refusé', p_motif);
  end if;
  perform public.journaliser(case when p_accepte then 'certificat_accepte' else 'certificat_refuse' end, p_lecon::text);
  return v_l.justificatif_chemin;
end $$;

-- Le moniteur valide la leçon avec la signature de l'élève
create or replace function public.valider_lecon(p_lecon uuid, p_commentaire text, p_points text[], p_signature jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare v_l lecons;
begin
  select * into v_l from lecons where id = p_lecon for update;
  if not found then raise exception 'LECON_INCONNUE'; end if;
  if not (v_l.moniteur_id = auth.uid() or (public.est_bureau() and v_l.auto_ecole_id = public.mon_ecole())) then raise exception 'INTERDIT'; end if;
  if v_l.statut <> 'reservee' then raise exception 'DEJA_TRAITEE'; end if;
  if v_l.debut > now() + interval '15 minutes' then raise exception 'TROP_TOT'; end if;
  if p_signature is null and not public.est_bureau() then raise exception 'SIGNATURE_MANQUANTE'; end if;
  update lecons set statut = 'effectuee', commentaire = nullif(trim(p_commentaire), ''), points = p_points,
                    signature = p_signature, signee_le = now()
   where id = p_lecon;
  perform public.notifier(v_l.eleve_id, 'lecon_validee', 'Leçon validée', p_commentaire, '/parcours');
end $$;

create or replace function public.marquer_absence(p_lecon uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_l lecons;
begin
  select * into v_l from lecons where id = p_lecon for update;
  if not found then raise exception 'LECON_INCONNUE'; end if;
  if not (v_l.moniteur_id = auth.uid() or (public.est_bureau() and v_l.auto_ecole_id = public.mon_ecole())) then raise exception 'INTERDIT'; end if;
  if v_l.statut <> 'reservee' then raise exception 'DEJA_TRAITEE'; end if;
  if v_l.debut > now() + interval '15 minutes' then raise exception 'TROP_TOT'; end if;
  update lecons set statut = 'absence' where id = p_lecon;     -- l'heure reste due
  perform public.notifier(v_l.eleve_id, 'absence', 'Absence enregistrée : l''heure reste due');
end $$;

-- Pointage d'une séance de théorie
create or replace function public.pointer_seance(p_seance uuid, p_presents uuid[])
returns void
language plpgsql security definer set search_path = public as $$
declare v_s seances_theorie;
begin
  select * into v_s from seances_theorie where id = p_seance for update;
  if not found then raise exception 'SEANCE_INCONNUE'; end if;
  if not (v_s.moniteur_id = auth.uid() or (public.est_bureau() and v_s.auto_ecole_id = public.mon_ecole())) then raise exception 'INTERDIT'; end if;
  update presences_theorie set present = (eleve_id = any (p_presents)) where seance_id = p_seance;
  insert into presences_theorie (seance_id, eleve_id, present)
    select p_seance, x, true from unnest(p_presents) x
    on conflict (seance_id, eleve_id) do update set present = true;
  update seances_theorie set pointee = true where id = p_seance;
end $$;

-- Numéro de facture continu, sans trou : AAAA-0001
create or replace function public.prochain_numero(p_ecole uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare v_annee integer := extract(year from now() at time zone 'Europe/Luxembourg')::int; v_n integer;
begin
  insert into compteurs_factures (auto_ecole_id, annee, dernier) values (p_ecole, v_annee, 1)
  on conflict (auto_ecole_id, annee) do update set dernier = compteurs_factures.dernier + 1
  returning dernier into v_n;
  return v_annee || '-' || lpad(v_n::text, 4, '0');
end $$;

-- Création d'une facture : formule d'heures (code) ou 'inscription'
create or replace function public.creer_facture(p_eleve uuid, p_code text, p_moyen text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_el eleves; v_f formules; v_id uuid; v_ttc numeric; v_ht numeric;
begin
  select * into v_el from eleves where id = p_eleve;
  if not found or v_el.auto_ecole_id is distinct from public.mon_ecole() then raise exception 'ELEVE_INCONNU'; end if;
  if not (p_eleve = auth.uid() or public.est_bureau()) then raise exception 'INTERDIT'; end if;
  if p_moyen is not null and p_moyen not in ('wero','virement','especes') then raise exception 'MOYEN_INCONNU'; end if;

  if p_code = 'inscription' then
    if not public.est_bureau() then raise exception 'INTERDIT'; end if;
    insert into factures (auto_ecole_id, numero, eleve_id, objet, echeance, moyen_annonce, formule_code)
    values (v_el.auto_ecole_id, public.prochain_numero(v_el.auto_ecole_id), p_eleve, 'Frais d''inscription', current_date + 7, p_moyen, 'inscription')
    returning id into v_id;
    insert into lignes_facture (facture_id, libelle, quantite, montant_ht, taux_tva, montant_tva, montant_ttc, ordre)
    select v_id, libelle, 1, montant_ht, taux_tva, round(montant_ht * taux_tva / 100, 2),
           montant_ht + round(montant_ht * taux_tva / 100, 2), ordre
      from inscription_lignes where auto_ecole_id = v_el.auto_ecole_id;
  else
    select * into v_f from formules where auto_ecole_id = v_el.auto_ecole_id and code = p_code and active;
    if not found then raise exception 'FORMULE_INCONNUE'; end if;
    -- Une facture non réglée existe déjà pour cette formule : on la réutilise (pas de doublon)
    select id into v_id from factures
     where eleve_id = p_eleve and formule_code = p_code and statut = 'a_payer' and total_ttc = v_f.prix_ttc
     order by created_at desc limit 1;
    if v_id is not null then
      update factures set moyen_annonce = coalesce(p_moyen, moyen_annonce) where id = v_id;
      return v_id;
    end if;
    v_ttc := v_f.prix_ttc;
    v_ht  := round(v_ttc / (1 + v_f.taux_tva / 100), 2);
    insert into factures (auto_ecole_id, numero, eleve_id, objet, echeance, moyen_annonce, heures_a_crediter, formule_code)
    values (v_el.auto_ecole_id, public.prochain_numero(v_el.auto_ecole_id), p_eleve, v_f.nom, current_date + 7, p_moyen, v_f.heures, p_code)
    returning id into v_id;
    insert into lignes_facture (facture_id, libelle, quantite, montant_ht, taux_tva, montant_tva, montant_ttc)
    values (v_id, v_f.nom, 1, v_ht, v_f.taux_tva, v_ttc - v_ht, v_ttc);
  end if;

  update factures f set total_ht  = s.ht, total_tva = s.tva, total_ttc = s.ttc
    from (select sum(montant_ht) ht, sum(montant_tva) tva, sum(montant_ttc) ttc from lignes_facture where facture_id = v_id) s
   where f.id = v_id;
  if p_moyen in ('virement','especes') then
    perform public.notifier(p_eleve, 'facture', 'Facture à régler',
      case when p_moyen = 'virement' then 'En attente de votre virement' else 'À régler à l''auto-école' end, '/paiements');
  end if;
  return v_id;
end $$;

-- Encaissement : bureau (espèces, virement reçu) ou serveur (confirmation Wero)
create or replace function public.encaisser_facture(p_facture uuid, p_moyen text, p_reference text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_f factures;
begin
  select * into v_f from factures where id = p_facture for update;
  if not found then raise exception 'FACTURE_INCONNUE'; end if;
  if not (public.est_service() or (public.est_bureau() and v_f.auto_ecole_id = public.mon_ecole())) then raise exception 'INTERDIT'; end if;
  if p_moyen not in ('wero','virement','especes') then raise exception 'MOYEN_INCONNU'; end if;
  if v_f.statut = 'payee' then return; end if;
  if v_f.statut = 'annulee' then raise exception 'FACTURE_ANNULEE'; end if;

  insert into paiements (facture_id, montant, moyen, reference, encaisse_par)
  values (p_facture, v_f.total_ttc, p_moyen, p_reference, auth.uid());
  update factures set statut = 'payee' where id = p_facture;
  if v_f.heures_a_crediter > 0 and not v_f.heures_creditees then
    insert into mouvements_heures (auto_ecole_id, eleve_id, type, heures, facture_id, cree_par)
    values (v_f.auto_ecole_id, v_f.eleve_id, 'achat', v_f.heures_a_crediter, p_facture, auth.uid());
    update factures set heures_creditees = true where id = p_facture;
  end if;
  perform public.notifier(v_f.eleve_id, 'paiement', 'Paiement reçu',
    case when v_f.heures_a_crediter > 0 then v_f.heures_a_crediter || ' h ajoutées à votre solde' end, '/paiements');
end $$;

-- Ajustement manuel du solde (bureau), toujours tracé
create or replace function public.ajuster_solde(p_eleve uuid, p_heures numeric, p_motif text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_el eleves;
begin
  if not public.est_bureau() then raise exception 'INTERDIT'; end if;
  if coalesce(trim(p_motif), '') = '' then raise exception 'MOTIF_OBLIGATOIRE'; end if;
  select * into v_el from eleves where id = p_eleve;
  if not found or v_el.auto_ecole_id <> public.mon_ecole() then raise exception 'ELEVE_INCONNU'; end if;
  insert into mouvements_heures (auto_ecole_id, eleve_id, type, heures, motif, cree_par)
  values (v_el.auto_ecole_id, p_eleve, 'ajustement', p_heures, p_motif, auth.uid());
  perform public.journaliser('ajustement_solde', p_eleve::text, jsonb_build_object('heures', p_heures, 'motif', p_motif));
end $$;

-- Annulation d'une facture non réglée (le numéro est conservé, jamais réutilisé)
create or replace function public.annuler_facture(p_facture uuid, p_motif text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_f factures;
begin
  if not public.est_bureau() then raise exception 'INTERDIT'; end if;
  if coalesce(trim(p_motif), '') = '' then raise exception 'MOTIF_OBLIGATOIRE'; end if;
  select * into v_f from factures where id = p_facture for update;
  if not found or v_f.auto_ecole_id <> public.mon_ecole() then raise exception 'FACTURE_INCONNUE'; end if;
  if v_f.statut <> 'a_payer' then raise exception 'NON_ANNULABLE'; end if;
  update factures set statut = 'annulee' where id = p_facture;
  perform public.journaliser('facture_annulee', v_f.numero, jsonb_build_object('motif', p_motif));
end $$;

-- Rôle et accès d'un membre (rôle : gérant seulement ; activer / désactiver : bureau)
create or replace function public.definir_acces(p_user uuid, p_role text, p_actif boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_p profils;
begin
  if not public.est_bureau() then raise exception 'INTERDIT'; end if;
  select * into v_p from profils where id = p_user for update;
  if not found or v_p.auto_ecole_id <> public.mon_ecole() then raise exception 'UTILISATEUR_INCONNU'; end if;
  if p_user = auth.uid() then raise exception 'PAS_SUR_SOI'; end if;
  if p_role is not null and p_role <> v_p.role and public.mon_role() <> 'gerant' then raise exception 'INTERDIT'; end if;
  if v_p.role = 'gerant' and public.mon_role() <> 'gerant' then raise exception 'INTERDIT'; end if;
  update profils set role = coalesce(p_role, role), actif = coalesce(p_actif, actif) where id = p_user;
  perform public.journaliser('acces_modifie', p_user::text, jsonb_build_object('role', p_role, 'actif', p_actif));
end $$;

-- ---------------------------------------------------------------------
-- 5. Sécurité : droits par rôle (Row Level Security)
-- ---------------------------------------------------------------------

alter table public.auto_ecoles        enable row level security;
alter table public.profils            enable row level security;
alter table public.eleves             enable row level security;
alter table public.accompagnateurs    enable row level security;
alter table public.fermetures         enable row level security;
alter table public.indisponibilites   enable row level security;
alter table public.lecons             enable row level security;
alter table public.seances_theorie    enable row level security;
alter table public.presences_theorie  enable row level security;
alter table public.examens            enable row level security;
alter table public.formules           enable row level security;
alter table public.inscription_lignes enable row level security;
alter table public.compteurs_factures enable row level security;
alter table public.factures           enable row level security;
alter table public.lignes_facture     enable row level security;
alter table public.paiements          enable row level security;
alter table public.mouvements_heures  enable row level security;
alter table public.notifications      enable row level security;
alter table public.journal            enable row level security;

-- Auto-école et tarifs : lisibles par tous les membres, modifiables par le gérant
create policy ae_lire     on public.auto_ecoles for select to authenticated using (id = public.mon_ecole());
create policy ae_modifier on public.auto_ecoles for update to authenticated using (id = public.mon_ecole() and public.mon_role() = 'gerant');
create policy formules_lire  on public.formules for select to authenticated using (auto_ecole_id = public.mon_ecole());
create policy formules_gerer on public.formules for all to authenticated
  using (auto_ecole_id = public.mon_ecole() and public.mon_role() = 'gerant')
  with check (auto_ecole_id = public.mon_ecole() and public.mon_role() = 'gerant');
create policy insc_lire  on public.inscription_lignes for select to authenticated using (auto_ecole_id = public.mon_ecole());
create policy insc_gerer on public.inscription_lignes for all to authenticated
  using (auto_ecole_id = public.mon_ecole() and public.mon_role() = 'gerant')
  with check (auto_ecole_id = public.mon_ecole() and public.mon_role() = 'gerant');

-- Profils : soi-même ; l'équipe voit tout le monde ; les élèves voient les moniteurs (prénom)
create policy profils_lire on public.profils for select to authenticated using (
  id = auth.uid() or (auto_ecole_id = public.mon_ecole() and (public.est_staff() or role = 'moniteur')));
create policy profils_modifier_soi on public.profils for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profils_bureau on public.profils for update to authenticated
  using (auto_ecole_id = public.mon_ecole() and public.est_bureau())
  with check (auto_ecole_id = public.mon_ecole() and public.est_bureau());
-- Le rôle, l'auto-école et l'accès ne se changent que par definir_acces()
revoke insert, update, delete on public.profils from anon, authenticated;
grant update (prenom, nom, telephone, langue, consentement_le) on public.profils to authenticated;

-- Élèves
create policy eleves_lire on public.eleves for select to authenticated using (
  id = auth.uid() or (auto_ecole_id = public.mon_ecole() and public.est_staff()));
create policy eleves_gerer on public.eleves for all to authenticated
  using (auto_ecole_id = public.mon_ecole() and public.est_bureau())
  with check (auto_ecole_id = public.mon_ecole() and public.est_bureau());

create policy accomp_lire on public.accompagnateurs for select to authenticated using (
  eleve_id = auth.uid() or exists (select 1 from eleves e where e.id = eleve_id and e.auto_ecole_id = public.mon_ecole() and public.est_staff()));
create policy accomp_gerer on public.accompagnateurs for all to authenticated
  using (exists (select 1 from eleves e where e.id = eleve_id and e.auto_ecole_id = public.mon_ecole() and public.est_bureau()))
  with check (exists (select 1 from eleves e where e.id = eleve_id and e.auto_ecole_id = public.mon_ecole() and public.est_bureau()));

create policy fermetures_lire  on public.fermetures for select to authenticated using (auto_ecole_id = public.mon_ecole());
create policy fermetures_gerer on public.fermetures for all to authenticated
  using (auto_ecole_id = public.mon_ecole() and public.est_bureau())
  with check (auto_ecole_id = public.mon_ecole() and public.est_bureau());

create policy indispo_lire on public.indisponibilites for select to authenticated using (
  auto_ecole_id = public.mon_ecole() and public.est_staff());
create policy indispo_gerer on public.indisponibilites for all to authenticated
  using (auto_ecole_id = public.mon_ecole() and (moniteur_id = auth.uid() or public.est_bureau()))
  with check (auto_ecole_id = public.mon_ecole() and (moniteur_id = auth.uid() or public.est_bureau()));

-- Leçons : l'élève voit les siennes, le moniteur les siennes, le bureau toutes. Écriture par fonctions.
create policy lecons_lire on public.lecons for select to authenticated using (
  eleve_id = auth.uid() or moniteur_id = auth.uid() or (auto_ecole_id = public.mon_ecole() and public.voit_tout()));

create policy seances_lire on public.seances_theorie for select to authenticated using (auto_ecole_id = public.mon_ecole());
create policy seances_gerer on public.seances_theorie for all to authenticated
  using (auto_ecole_id = public.mon_ecole() and public.est_bureau())
  with check (auto_ecole_id = public.mon_ecole() and public.est_bureau());
create policy presences_lire on public.presences_theorie for select to authenticated using (
  eleve_id = auth.uid() or exists (select 1 from seances_theorie s where s.id = seance_id and s.auto_ecole_id = public.mon_ecole() and public.est_staff()));
create policy presences_inscrire on public.presences_theorie for insert to authenticated with check (
  exists (select 1 from seances_theorie s where s.id = seance_id and s.auto_ecole_id = public.mon_ecole() and public.est_bureau()));

create policy examens_lire on public.examens for select to authenticated using (
  eleve_id = auth.uid() or (auto_ecole_id = public.mon_ecole() and public.est_staff()));
create policy examens_gerer on public.examens for all to authenticated
  using (auto_ecole_id = public.mon_ecole() and public.est_bureau())
  with check (auto_ecole_id = public.mon_ecole() and public.est_bureau());

-- Argent : l'élève voit ses factures, paiements et mouvements ; le bureau voit tout. Écriture par fonctions.
create policy factures_lire on public.factures for select to authenticated using (
  eleve_id = auth.uid() or (auto_ecole_id = public.mon_ecole() and public.voit_tout()));
create policy lignes_lire on public.lignes_facture for select to authenticated using (
  exists (select 1 from factures f where f.id = facture_id and (f.eleve_id = auth.uid() or (f.auto_ecole_id = public.mon_ecole() and public.voit_tout()))));
create policy paiements_lire on public.paiements for select to authenticated using (
  exists (select 1 from factures f where f.id = facture_id and (f.eleve_id = auth.uid() or (f.auto_ecole_id = public.mon_ecole() and public.voit_tout()))));
create policy mouvements_lire on public.mouvements_heures for select to authenticated using (
  eleve_id = auth.uid() or (auto_ecole_id = public.mon_ecole() and public.voit_tout()));

create policy notif_lire on public.notifications for select to authenticated using (utilisateur_id = auth.uid());
create policy notif_lue  on public.notifications for update to authenticated using (utilisateur_id = auth.uid()) with check (utilisateur_id = auth.uid());

create policy journal_lire on public.journal for select to authenticated using (
  auto_ecole_id = public.mon_ecole() and public.mon_role() = 'gerant');

-- Fonctions : utilisables seulement par les personnes connectées
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.creneaux_libres(date, uuid, uuid), public.reserver_lecon(timestamptz, uuid, uuid),
  public.annuler_lecon(uuid, boolean), public.deposer_certificat(uuid, text), public.decider_certificat(uuid, boolean, text),
  public.valider_lecon(uuid, text, text[], jsonb), public.marquer_absence(uuid), public.pointer_seance(uuid, uuid[]),
  public.creer_facture(uuid, text, text), public.encaisser_facture(uuid, text, text), public.ajuster_solde(uuid, numeric, text),
  public.annuler_facture(uuid, text), public.definir_acces(uuid, text, boolean),
  public.mon_role(), public.mon_ecole(), public.est_bureau(), public.est_staff(), public.voit_tout(), public.est_service()
  to authenticated;
grant execute on function public.encaisser_facture(uuid, text, text), public.est_service() to service_role;

-- ---------------------------------------------------------------------
-- 6. Fichiers privés : certificats médicaux
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('certificats', 'certificats', false)
  on conflict (id) do nothing;

-- Chemin attendu : <id de l'élève>/<nom du fichier>
create policy certif_deposer on storage.objects for insert to authenticated with check (
  bucket_id = 'certificats' and (storage.foldername(name))[1] = auth.uid()::text);
create policy certif_lire on storage.objects for select to authenticated using (
  bucket_id = 'certificats' and ((storage.foldername(name))[1] = auth.uid()::text
    or (public.est_bureau() and exists (select 1 from public.eleves e
         where e.id::text = (storage.foldername(name))[1] and e.auto_ecole_id = public.mon_ecole()))));
create policy certif_supprimer on storage.objects for delete to authenticated using (
  bucket_id = 'certificats' and public.est_bureau() and exists (select 1 from public.eleves e
    where e.id::text = (storage.foldername(name))[1] and e.auto_ecole_id = public.mon_ecole()));

-- ---------------------------------------------------------------------
-- 7. Données de départ : Auto École Lisboa, tarifs du 15/11/2026
-- ---------------------------------------------------------------------
insert into public.auto_ecoles (id, nom, adresse, beneficiaire)
values ('00000000-0000-4000-8000-000000000001', 'Auto École Lisboa', '5 place des Alliés, L-4508 Differdange', 'Auto École Lisboa');

insert into public.formules (auto_ecole_id, code, nom, heures, prix_ttc, taux_tva, ordre) values
  ('00000000-0000-4000-8000-000000000001', 'unite', 'Leçon à l''unité',    1,   88.00, 17, 1),
  ('00000000-0000-4000-8000-000000000001', 'f4',    'Forfait 4 leçons',    4,  352.00, 17, 2),
  ('00000000-0000-4000-8000-000000000001', 'f8',    'Forfait 8 leçons',    8,  704.00, 17, 3),
  ('00000000-0000-4000-8000-000000000001', 'f12',   'Forfait 12 leçons',  12, 1056.00, 17, 4),
  ('00000000-0000-4000-8000-000000000001', 'f16',   'Forfait 16 leçons',  16, 1408.00, 17, 5);

insert into public.inscription_lignes (auto_ecole_id, libelle, montant_ht, taux_tva, ordre) values
  ('00000000-0000-4000-8000-000000000001', 'Taxe',                  30.00,  0, 1),
  ('00000000-0000-4000-8000-000000000001', 'Droit d''inscription', 101.94,  3, 2),
  ('00000000-0000-4000-8000-000000000001', 'Cours de théorie',     136.75, 17, 3);

-- Création du premier gérant (à appeler une seule fois depuis le SQL Editor, après avoir créé
-- votre utilisateur dans Authentication → Users) :
--   select public.creer_gerant('votre-email@exemple.lu', 'Prénom', 'Nom');
create or replace function public.creer_gerant(p_email text, p_prenom text, p_nom text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if exists (select 1 from profils where role = 'gerant') then raise exception 'UN_GERANT_EXISTE_DEJA'; end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then raise exception 'UTILISATEUR_INTROUVABLE : créez-le d''abord dans Authentication → Users'; end if;
  insert into profils (id, auto_ecole_id, role, prenom, nom)
  values (v_uid, '00000000-0000-4000-8000-000000000001', 'gerant', p_prenom, p_nom);
end $$;
revoke execute on function public.creer_gerant(text, text, text) from public, anon, authenticated;
