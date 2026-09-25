> Document historique. Pour la version 2.2, lire DEMARRER_V2.2.md (migration SQL nécessaire).

# Camionnage 2.1 — recherche, saisie et ouverture

Version construite à partir de l’archive camionnage-v2.zip fournie. Le dossier racine reste `v2` pour faciliter le remplacement du projet existant.

## Ce qui change

- **Demandes** : recherche numéro / code affaire / description des objets, filtre client, dates, coordinateur, états (dont « À planifier », brouillons et toutes), 50 lignes par page par défaut. La recherche s’exécute côté base, pas uniquement sur les résultats déjà affichés. Chaque ligne ouvre la demande ; présentation adaptée aux petits écrans.
- **Création** : recherche du client dans la liste, reprise de son email et téléphone, adresses et objets avant les réglages techniques. Moyens et opérations modifiables dans un panneau repliable. Comparaison des créneaux à la demande. Validation du client, de la date de retour et des opérations des scénarios. Durées arrondies à la minute supérieure pour le champ entier en base.
- **Réactivité** : requêtes de disponibilité espacées de 300 ms, annulation des requêtes devenues inutiles, erreurs visibles ; chargement parallèle des référentiels. Lecture du profil utilisateur mutualisée pendant un rendu serveur. État de chargement et écran de reprise en cas d’erreur.
- **Documents** : fiche de mission depuis le détail d’une demande, avec adresses, objets, consignes, opérations, affectations et comptes rendus. Impression A4 / enregistrement PDF par la boîte d’impression du navigateur. Les heures d’exécution sont affichées en heure de Paris.
- **Exports** : CSV UTF-8 compatible Excel et JSON pour **la page de résultats courante**, avec les filtres conservés. Le CSV neutralise les valeurs susceptibles d’être interprétées comme des formules.
- **API** : routes versionnées de lecture ; authentification utilisateur par cookie Supabase ou jeton Bearer ; contrôle du compte actif et du rôle ; accès Supabase via la clé publique et les politiques RLS existantes. Aucune clé de service utilisée pour ces routes.
- **Navigation** : entrée « Exports & API », documentation intégrée et téléchargement du contrat OpenAPI.

## Installer sur le projet existant

1. Conserver vos variables Vercel / Supabase et votre fichier `.env.local` local.
2. Remplacer le code de votre dépôt par le contenu du dossier `v2` de cette archive. Ne pas déposer le ZIP directement comme une application Vercel.
3. Exécuter `npm ci`, `npm test`, `npm run typecheck`, puis `npm run build`.
4. Déployer par votre circuit GitHub / Vercel habituel.

**Aucune nouvelle migration SQL n’est requise pour cette version.** La base doit déjà correspondre au schéma v2 livré dans l’archive d’origine, notamment les scénarios et les champs aller/retour. Ne pas rejouer le script initial sur une base active pour cette mise à jour.

## API de lecture

- `GET /api/v1/demandes` : collection paginée.
- `GET /api/v1/demandes/{id}` : demande complète et opérations, avec camions et équipiers.
- `GET /api/v1/openapi` : contrat OpenAPI 3.0.3.

Filtres : `f`, `q`, `client` (UUID), `mine` (`0`/`1`), `from`, `to` (dates inclusives), `page`, `limit` (1 à 100), `format` (`json`/`csv`). Valeurs de `f` : `actives`, `a_traiter`, `a_planifier`, `planifiees`, `terminees`, `brouillons`, `refusees`, `toutes`.

Exemple :

```sh
curl "$CAMIONNAGE_URL/api/v1/demandes?f=actives&page=1&limit=50" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

Pour toutes les données, incrémenter `page` tant que `pagination.has_more` est vrai. La pagination est triée par date souhaitée puis identifiant ; des modifications simultanées peuvent déplacer les résultats entre les pages. Le CSV exporte la page demandée et indique le total filtré dans l’en-tête `X-Total-Count`.

Les rôles admis sont : coordinateur, dispatcheur, direction, admin, gm, emballage. Un chauffeur n’a pas accès à ces exports. Une requête non authentifiée ou non autorisée reçoit un JSON HTTP 401 ; un filtre invalide reçoit 400 ; un détail absent reçoit 404. Le contrat OpenAPI couvre les nouvelles routes de lecture ; les anciennes routes internes de mutation ne deviennent pas une API publique de création.

Un outil externe doit obtenir un jeton utilisateur Supabase et gérer son renouvellement. Pas de clé API permanente, de CORS inter-origines, de webhook ni de synchronisation Akanea dans cette version. Les appels serveur à serveur sont possibles ; une application Web sur un autre domaine nécessite une configuration complémentaire.

## Validation et limites

- Compilation Next.js de production et vérification TypeScript.
- Tests automatisés des filtres, bornes de pagination, dates, échappement CSV et neutralisation des formules.
- Voir `VALIDATION.md` pour les contrôles effectivement exécutés.
- Aucune connexion à la base Supabase de production, aucun envoi ni changement d’affectation réel, aucun déploiement effectué.
- Pas de gain de temps chiffré revendiqué : le ressenti et la charge réelle doivent être vérifiés sur les données de l’équipe.
- Le planning, les règles de capacité, les scénarios, le processus de devis et la synchronisation comptable n’ont pas été refondus. Une fiche de mission n’est ni un devis, ni une facture, ni une lettre de voiture réglementaire.
- Le mécanisme existant de création reste composé d’écritures successives (client, demande, opérations). L’atomicité transactionnelle et l’idempotence des créations restent à traiter ; après une coupure pendant l’envoi, vérifier la liste avant de soumettre de nouveau.

## Recette avant mise en service

Avec un compte coordinateur puis dispatcheur : filtrer une affaire connue, créer une demande test, vérifier les coordonnées reprises, modifier les moyens, tester aller/retour, accepter et planifier, puis consulter la vue chauffeur. Imprimer une mission représentative en A4 depuis le navigateur utilisé par l’équipe. Vérifier que le CSV correspond à la page affichée et que le jeton de l’intégration dispose seulement des accès souhaités.
