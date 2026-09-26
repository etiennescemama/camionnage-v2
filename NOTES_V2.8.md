# Camionnage 2.8 — sécurité en base et proposition automatique de la journée

## À faire pour installer

1. Supabase → SQL Editor : exécuter `supabase/v2_04_securite.sql` (additif, après v2_03, réexécutable).
2. Remplacer le code et redéployer. Aucune nouvelle variable obligatoire.
   Facultatif : `DEPOT_LAT` / `DEPOT_LNG` si le point de départ des camions n'est pas le garde-meuble de Gennevilliers.
3. Contrôle : `npm ci && npm test && npm run test:securite && npm run build`.

## 1. Onze failles fermées

Jusqu'en 2.7, les droits étaient vérifiés dans les pages et les routes, mais la base acceptait les mêmes écritures en direct. La clé Supabase publique est dans le navigateur de chaque utilisateur : n'importe quel compte connecté pouvait écrire en base depuis la console, sans passer par l'application.

`npm run audit:v27` rejoue les attaques sur le schéma 2.7 avec de vrais jetons utilisateur et la sécurité par ligne active. Résultat : **11 sur 11 passent**. `npm run test:securite` rejoue les mêmes attaques après `v2_04` : **11 sur 11 bloquées**, et vérifie que les parcours normaux (chauffeur, coordinateur, planning, refus puis renvoi, annulation, brouillon) fonctionnent toujours.

| Attaque possible en 2.7 | Conséquence métier |
|---|---|
| Un chauffeur passe son rôle à « admin » | Accès complet : utilisateurs, flotte, toutes les données |
| Un compte désactivé se réactive seul | Un salarié parti garde l'accès |
| Un coordinateur accepte sa propre demande | Le planning est court-circuité |
| Un coordinateur crée une demande directement « acceptée » | Idem, sans trace de validation |
| Un coordinateur crée une demande au nom d'un collègue | Dossier attribué à tort, alertes au mauvais destinataire |
| Un coordinateur pose un camion sur une mission | Double réservation, aucun contrôle de conflit, permis ou volume |
| Un chauffeur change la date ou le camion de sa mission | Planning faussé sans que le dispatch le sache |
| Un chauffeur déclare « terminée » une mission non démarrée, avec les heures de son choix | Heures chez le client fausses : c'est la base de la facturation |
| Un utilisateur envoie une fausse notification à un autre | Hameçonnage interne au nom du système |
| Un chauffeur ajoute des photos sur une mission qui n'est pas la sienne | Constat de livraison contestable |
| Un coordinateur supprime une demande déjà réalisée | Disparition de l'historique d'exécution et de la preuve de prestation |

Ce que fait `v2_04` : la base devient l'arbitre, quel que soit le chemin d'écriture.
- Rôle, statut et email d'un utilisateur : administrateur uniquement.
- Demande : créée au nom de son auteur, en brouillon ou envoyée ; le coordinateur ne peut que l'envoyer, la renvoyer après refus ou l'annuler tant qu'aucune mission n'a démarré ; suppression limitée aux brouillons, demandes à traiter ou refusées.
- Mission, côté terrain : une étape à la fois (planifiée → en route → sur site → terminée), jamais sur une mission future, heures d'arrivée et de départ posées par le serveur.
- Mission, côté bureau : consignes, libellé et lieu tant qu'elle n'a pas démarré ; camion, horaire et état restent au planning.
- Photos : l'équipe de la mission ou le planning. Notifications : le planning, ou le coordinateur vers le dispatcheur de son dossier.

## 2. Report de date : le camion ne part plus le mauvais jour

En 2.7, quand un coordinateur changeait la date d'une demande, les missions gardaient leur date d'origine. Le camion affecté partait au jour initial, et le planning n'était prévenu que si toutes les missions étaient déjà affectées.

Désormais, un changement de date, de créneau, d'équipe, de véhicule ou d'adresse :
- libère camion et équipe des missions non démarrées, qui reviennent « à affecter » ;
- décale leur date du même nombre de jours (aller et retour séparément) ;
- prévient le dispatcheur du dossier, ou tout le planning s'il n'y en a pas.
Les missions démarrées ou terminées ne bougent pas.

## 3. Proposer la journée

Planning → Affectation → **Proposer**. Pour la date affichée, l'outil calcule une affectation complète de toutes les missions à planifier : camion, équipe, heure de début de chaque étape, trajets compris. Rien n'est enregistré avant validation.

Règles appliquées :
- une rotation (enlèvement → livraison → installation d'une même demande) garde le même camion et la même équipe de bout en bout ;
- rendez-vous tenus à l'heure exacte, puis créneaux courts, gros volumes et grosses équipes en priorité ;
- un camion déjà sorti est rempli avant d'en sortir un autre, et son équipe reste avec lui toute la journée ;
- les permis C sont gardés pour les poids lourds quand un permis B suffit, et un 35 m³ n'est pas pris pour une mission de 20 m³ ;
- hayon, climatisation, volume, permis, taille d'équipe, indisponibilités et missions déjà affectées sont respectés ; 10 h de travail maximum par personne ;
- trajet estimé à vol d'oiseau corrigé (× 1,35, 24 km/h en Île-de-France, 10 min de marge) à partir des adresses confirmées ; 30 min si l'adresse n'est pas géolocalisée (signalé à l'écran).

L'écran affiche la journée par camion avec l'équipe et les horaires, cinq indicateurs (camions sortis, personnes mobilisées, temps de route, temps chez le client, taux d'occupation des équipes) et la liste des missions à affecter à la main avec la raison (« Aucun camion climatisé ≥ 27 m³ actif », « Lieu à préciser »…).
Validation : tout d'un coup, ou camion par camion. Chaque mission passe par `planifier_operation`, qui refait tous les contrôles en transaction. Si une étape est refusée (un collègue a pris le camion entre-temps), la suite de la rotation n'est pas enregistrée et le motif s'affiche.

## Contrôles exécutés

- `npm test` : 21 tests réussis, dont 8 sur le moteur (rotation indivisible, consolidation sur un camion, permis C réservé, poids lourd, rendez-vous, refus motivés, missions existantes, atelier sans camion, 40 missions sur 8 camions en moins de 200 ms sans double réservation).
- `npm run test:securite` : 11 attaques bloquées, parcours normaux et report de date vérifiés, migration réexécutable.
- `test:db` et `test:alerts` repassent avec `v2_04` appliqué.
- `npm run typecheck` et `npm run build` réussis.

## Non vérifié ici

- Base Supabase réelle : les tests tournent sur un PostgreSQL embarqué avec le même schéma et la même sécurité par ligne.
- Rendu dans un navigateur : pas de navigateur disponible dans cet environnement. Faire un essai sur le planning d'une journée chargée avant la mise en service.
- Stockage des photos : la règle du bucket `operations-photos` reste celle créée à la main (lecture et dépôt pour tout compte connecté). La restreindre dans Supabase → Storage → Policies.
- Toujours ouvert depuis 2.1 : la création d'une demande reste en deux écritures (demande puis missions) ; tous les comptes connectés lisent tous les dossiers, ce qu'il faudra revoir avant d'ouvrir l'outil aux clients.
