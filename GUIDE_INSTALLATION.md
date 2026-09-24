# Camionnage v2 — mise en route (30 min, sans terminal)

## 1. Supabase — nouveau schéma (5 min)
1. Supabase → projet `usaqhxnlwpueneoykoxl` → **SQL Editor → New query**.
2. Collez tout le contenu de `supabase/v2_01_schema.sql` → **Run**. Résultat attendu : *Success*.
   - Vos comptes (`utilisateurs`), clients, camions et équipiers sont conservés.
   - Les anciennes tables dossiers/étapes/chat sont supprimées (données de test).
3. **Storage → New bucket** : `operations-photos`, privé. Policies : `authenticated` en SELECT et INSERT.
4. **Database → Replication** : activez `notifications` (cloche en temps réel).

## 2. GitHub — repo neuf (5 min)
1. GitHub → **+ New repository** → nom `camionnage-v2`, privé, sans README → Create.
2. Sur la page « Quick setup » → **uploading an existing file** → glissez **tout le contenu** du dossier dézippé (pas le dossier lui-même) → Commit.
   Fichiers cachés à ne pas oublier : `.npmrc`, `.gitignore`, `.env.example` (Mac : Cmd+Maj+. pour les afficher).

## 3. Vercel — nouveau projet (10 min)
1. vercel.com → **Add New → Project** → Import `camionnage-v2`.
2. Avant **Deploy**, section *Environment Variables* :

| Nom | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://usaqhxnlwpueneoykoxl.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | votre clé `sb_publishable_…` |
| `SUPABASE_SERVICE_ROLE_KEY` | votre clé `sb_secret_…` |
| `NEXT_PUBLIC_SITE_URL` | l'URL Vercel du projet |

3. **Deploy** → build ~1 min → ouvrez l'URL, connectez-vous avec votre compte admin habituel.

## 4. Premiers réglages dans l'app (10 min)
1. **Référentiels → Camions** : saisissez la flotte réelle (14, 20, 27, 35, 50 m³, hayon, clim, PL).
2. **Référentiels → Équipiers** : les 10 chauffeurs, permis PL pour les 3 concernés.
3. **Référentiels → Temps standards et Scénarios** : ajustez les durées de base et par m³ (elles fixent la charge et les créneaux proposés).
4. **Utilisateurs** : créez les comptes ; pour un chauffeur, choisissez le rôle *Chauffeur* et liez-le à son équipier — il n'aura que la vue mobile de ses ordres.

## Parcours à tester
Coordinateur crée une demande (les créneaux libres s'affichent à droite) → Dispatcheur : *Mon programme* → À traiter → Accepter → *Planning* : glisser l'opération sur un camion à l'heure voulue, cocher l'équipe → le coordinateur reçoit la notification « planifiée » → le chauffeur, sur son téléphone : Je pars / Arrivé sur site / Terminé (heures et signataire remontent sur la demande).
Si le coordinateur modifie une demande planifiée, elle repasse « acceptée », les opérations reviennent dans « À planifier » et le dispatcheur est prévenu.
