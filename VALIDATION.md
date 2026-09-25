> Document historique. Pour la version 2.2, lire DEMARRER_V2.2.md (migration SQL nécessaire).

# Contrôles exécutés — 25 septembre 2026

## Résultats

- `npm test` : 6 groupes de tests réussis (bornes de pagination et validation des paramètres, CSV, application des filtres côté base, filtre « Toutes »).
- `npm run build` : compilation Next.js, contrôle des types et génération des routes réussis.
- Contrôles HTTP sur serveur Next.js local et service Supabase simulé, sans données réelles :
  - refus HTTP 401 des accès anonymes aux trois nouvelles routes ;
  - lecture de la liste authentifiée par cookie puis par jeton Bearer ;
  - rejet HTTP 400 d’une limite de pagination invalide ;
  - téléchargement CSV ;
  - téléchargement du contrat OpenAPI ;
  - rendu serveur de la liste, du centre d’exports et de la fiche de mission.

## Non vérifié dans cet environnement

- Parcours de bout en bout sur une base Supabase réelle et validation des politiques RLS déployées.
- Écritures et envois métier, affectations, notifications et synchronisation externe.
- Rendu visuel et interaction dans un navigateur : Chromium absent et téléchargement de son exécutable indisponible. Les tests de rendu serveur ne remplacent pas cette recette.
- Impression A4/PDF réelle, Safari iPhone et affichage sur les appareils de l’équipe.
- Charge, volumétrie de production et mesure d’un gain de temps.

Les scripts de test unitaire sont fournis dans `tests/core.cjs`. Les services simulés et faux comptes utilisés pour la vérification HTTP ne sont pas livrés avec le projet.

## Correctif 2.1.1 — notifications

Tests ajoutés : remontage immédiat avec nettoyage encore en cours, canal unique par effet, nettoyage idempotent, rejet des réponses réseau obsolètes, erreurs de chargement et de connexion visibles. Ces tests simulent le client Supabase ; ils ne constituent pas un test de connexion Realtime à votre serveur. Compilation de production réussie.
