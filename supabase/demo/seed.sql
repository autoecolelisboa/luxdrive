-- Données de démonstration (mode démo uniquement, jamais en production)
create table if not exists public.demo_files (chemin text primary key, data_url text not null);

insert into auth.users (id, email) values
  ('d0000000-0000-4000-8000-000000000001', 'gerant@demo.lu'),
  ('d0000000-0000-4000-8000-000000000002', 'bureau@demo.lu'),
  ('d0000000-0000-4000-8000-000000000003', 'marc@demo.lu'),
  ('d0000000-0000-4000-8000-000000000004', 'sofia@demo.lu'),
  ('d0000000-0000-4000-8000-000000000005', 'paulo@demo.lu'),
  ('d0000000-0000-4000-8000-000000000006', 'ana@demo.lu'),
  ('d0000000-0000-4000-8000-000000000007', 'lucas@demo.lu'),
  ('d0000000-0000-4000-8000-000000000008', 'ines@demo.lu');

select public.creer_gerant('gerant@demo.lu', 'Carla', 'Lisboa');

insert into public.profils (id, auto_ecole_id, role, prenom, nom, telephone, langue) values
  ('d0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'secretariat', 'Sara',  'Mendes',   '+352 58 00 00', 'fr'),
  ('d0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'moniteur',    'Marc',  'Weber',    '+352 621 100 001', 'fr'),
  ('d0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'moniteur',    'Sofia', 'Ferreira', '+352 621 100 002', 'pt'),
  ('d0000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'moniteur',    'Paulo', 'Costa',    '+352 621 100 003', 'pt'),
  ('d0000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'eleve',       'Ana',   'Silva',    '+352 691 000 006', 'fr'),
  ('d0000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', 'eleve',       'Lucas', 'Muller',   '+352 691 000 007', 'en'),
  ('d0000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', 'eleve',       'Inês',  'Rodrigues','+352 691 000 008', 'pt');

update public.auto_ecoles set
  iban = 'LU28 0019 4006 4475 0000', telephone = '+352 58 00 00', email = 'contact@demo.lu'
where id = '00000000-0000-4000-8000-000000000001';

insert into public.eleves (id, auto_ecole_id, date_naissance, regime, theorie_reussie_le, moniteur_referent_id, date_inscription, certificat_numero) values
  ('d0000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', '2007-03-14', 'classique',   current_date - 40, 'd0000000-0000-4000-8000-000000000003', current_date - 90, 'CA-2026-0412'),
  ('d0000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', '2008-01-02', 'classique',   current_date - 5,  null,                                   current_date - 30, 'CA-2026-0577'),
  ('d0000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', '2009-06-21', 'accompagnee', null,              'd0000000-0000-4000-8000-000000000004', current_date - 10, null);

insert into public.accompagnateurs (eleve_id, prenom, nom, telephone, piece_verifiee) values
  ('d0000000-0000-4000-8000-000000000008', 'Rui', 'Rodrigues', '+352 691 000 018', true);

insert into public.fermetures (auto_ecole_id, jour, libelle) values
  ('00000000-0000-4000-8000-000000000001', '2026-12-25', 'Noël'),
  ('00000000-0000-4000-8000-000000000001', '2026-12-26', 'Saint-Étienne'),
  ('00000000-0000-4000-8000-000000000001', '2027-01-01', 'Jour de l''An');

-- Leçons passées d'Ana (avec Marc), déjà validées
insert into public.lecons (auto_ecole_id, eleve_id, moniteur_id, debut, fin, statut, commentaire, points, signature, signee_le)
select '00000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000003',
       t, t + interval '1 hour', 'effectuee', c, p, '{"w":300,"h":120,"s":[[10,60,80,40,150,70,220,50,290,60]]}'::jsonb, t + interval '1 hour'
from (values
  (63, 'Prise en main du véhicule, démarrage et arrêt.', '{demarrage}'::text[]),
  (56, 'Bonne maîtrise de l''embrayage.', '{demarrage,ville}'),
  (49, 'Priorités à droite à revoir.', '{priorites,ville}'),
  (42, 'Progrès sur les priorités.', '{priorites,giratoire}'),
  (35, 'Ronds-points fluides.', '{giratoire,ville}'),
  (28, 'Première sortie sur voie rapide.', '{autoroute}'),
  (21, 'Créneau réussi 2 fois sur 3.', '{stationnement}'),
  (14, 'Marche arrière correcte.', '{stationnement,marche_arriere}'),
  (7,  'Bonne anticipation en ville.', '{ville,priorites}')
) v(j, c, p),
lateral (select ((current_date - v.j) + time '10:00') at time zone 'Europe/Luxembourg' as t) x;

insert into public.mouvements_heures (auto_ecole_id, eleve_id, type, heures, lecon_id)
select auto_ecole_id, eleve_id, 'reservation', -1, id from public.lecons where eleve_id = 'd0000000-0000-4000-8000-000000000006';

-- Une annulation tardive avec certificat en attente
with l as (
  insert into public.lecons (auto_ecole_id, eleve_id, moniteur_id, debut, fin, statut, annulee_le, justificatif_statut, justificatif_chemin)
  values ('00000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000003',
          ((current_date - 3) + time '14:00') at time zone 'Europe/Luxembourg', ((current_date - 3) + time '15:00') at time zone 'Europe/Luxembourg',
          'annulee_tardive', now() - interval '4 days', 'attente', 'd0000000-0000-4000-8000-000000000006/certificat-exemple.svg')
  returning id, auto_ecole_id, eleve_id)
insert into public.mouvements_heures (auto_ecole_id, eleve_id, type, heures, lecon_id) select auto_ecole_id, eleve_id, 'reservation', -1, id from l;

insert into storage.buckets (id, name, public) values ('certificats', 'certificats', false) on conflict do nothing;
insert into storage.objects (bucket_id, name, owner) values ('certificats', 'd0000000-0000-4000-8000-000000000006/certificat-exemple.svg', 'd0000000-0000-4000-8000-000000000006');

-- Séances de théorie : 12 passées (Ana présente), 1 aujourd'hui
insert into public.seances_theorie (auto_ecole_id, moniteur_id, debut, fin, theme, pointee)
select '00000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005',
       ((current_date - (100 - g * 3)) + time '18:00') at time zone 'Europe/Luxembourg',
       ((current_date - (100 - g * 3)) + time '19:30') at time zone 'Europe/Luxembourg',
       'Leçon de théorie ' || g, true
from generate_series(1, 12) g;
insert into public.presences_theorie (seance_id, eleve_id, present)
select id, 'd0000000-0000-4000-8000-000000000006', true from public.seances_theorie;
insert into public.presences_theorie (seance_id, eleve_id, present)
select id, 'd0000000-0000-4000-8000-000000000007', true from public.seances_theorie order by debut desc limit 8;

insert into public.seances_theorie (auto_ecole_id, moniteur_id, debut, fin, theme)
values ('00000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003',
        (current_date + time '18:00') at time zone 'Europe/Luxembourg', (current_date + time '19:30') at time zone 'Europe/Luxembourg',
        'Priorités et signalisation');
insert into public.presences_theorie (seance_id, eleve_id)
select id, e from public.seances_theorie, unnest(array['d0000000-0000-4000-8000-000000000007','d0000000-0000-4000-8000-000000000008']::uuid[]) e
where pointee = false;

-- Leçons du jour de Marc : une qui commence maintenant (à valider), une plus tard
insert into public.lecons (auto_ecole_id, eleve_id, moniteur_id, debut, fin)
values ('00000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000003',
        date_trunc('hour', now()), date_trunc('hour', now()) + interval '1 hour');
insert into public.mouvements_heures (auto_ecole_id, eleve_id, type, heures, lecon_id)
select auto_ecole_id, eleve_id, 'reservation', -1, id from public.lecons where eleve_id = 'd0000000-0000-4000-8000-000000000007';
