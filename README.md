# LuxDrive — Auto École Lisboa

Application de l'auto-école : réservation des leçons, suivi des élèves, moniteurs, factures et paiements
(Wero, virement, espèces). Langues : français, portugais, anglais.

- **Élève** : solde d'heures, réservation (48 h, 4 leçons/semaine max), annulation, certificat médical, paiements, progression.
- **Moniteur** : journée, validation des leçons avec signature, absences, pointage de la théorie.
- **Bureau** : tableau de bord, agenda, fiches élèves, factures et encaissements, certificats, réglages (tarifs, TVA, IBAN…).

## Structure

| Dossier | Contenu |
|---|---|
| `supabase/schema.sql` | Base de données complète : tables, règles métier, sécurité par rôle, tarifs Lisboa |
| `supabase/functions/inviter` | Création des comptes (élèves, équipe) côté serveur |
| `supabase/demo` | Données de démonstration (mode démo uniquement) |
| `src/` | Application (React) |
| `tests/` | Test complet de l'application dans un navigateur |

## Mise en route (une seule fois)

### 1. Base de données — Supabase
1. Projet Supabase **luxdrive**, région **Central EU (Frankfurt)**.
2. **SQL Editor → New query** : coller tout `supabase/schema.sql` → **Run**.
3. **Authentication → Users → Add user** : votre e-mail + un mot de passe (cocher *Auto Confirm User*).
4. **SQL Editor** : `select public.creer_gerant('votre-email', 'Prénom', 'Nom');` → vous êtes gérant.
5. **Authentication → Sign In / Providers** : désactiver *Allow new users to sign up* (seule l'auto-école crée les comptes).
6. **Edge Functions → Deploy a new function → Via Editor** : nom `inviter`, coller `supabase/functions/inviter/index.ts`, décocher *Verify JWT* n'est pas nécessaire (laisser coché) → **Deploy**.
7. **Project Settings → API** : noter **Project URL** et la clé **anon public** (publiques, sans risque). La clé *service_role* ne doit jamais sortir de Supabase.

### 2. Site — Cloudflare Pages (gratuit)
1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** → dépôt `luxdrive`.
2. Build command : `npm run build` · Output directory : `dist`.
3. Variables : `VITE_SUPABASE_URL` = Project URL, `VITE_SUPABASE_ANON_KEY` = clé anon public.
4. Supabase → **Authentication → URL Configuration** : *Site URL* = l'adresse Cloudflare (ex. `https://luxdrive.pages.dev`).

### 3. Premiers réglages dans l'app
Connexion en gérant → **Réglages** : IBAN, bénéficiaire, n° de TVA, horaires des leçons, jours d'ouverture, fermetures.
Puis **Équipe → Ajouter** pour les moniteurs et le secrétariat, et **Élèves → Nouvel élève**.

Chaque compte créé reçoit un **mot de passe provisoire** affiché une fois au bureau. La personne le change dans son profil.
Pour envoyer plutôt une invitation par e-mail, il faudra un service d'e-mail (Resend, gratuit) : prévu à l'étape suivante.

## Développement

```bash
npm install
npm run dev              # app reliée à Supabase (fichier .env, voir .env.example)
npx vite --mode demo     # mode démo : la vraie base tourne dans le navigateur, sans Supabase
npm run build            # version de production (dossier dist)
node tests/db.mjs        # test de la base (64 contrôles)
node tests/demo.mjs      # test complet (après: npx vite build --mode demo --outDir dist-demo && npx vite preview --outDir dist-demo --port 4173)
```

## Reste à faire
- Paiement **Wero** en ligne via Stripe (fonction `wero-checkout` + confirmation automatique).
- E-mails (Resend) et **notifications push** (rappels de leçons).
- **Sauvegarde quotidienne** automatique de la base (GitHub Actions).
- Factures PDF téléchargeables.
