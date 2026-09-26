# Camionnage 2.9 — Resend et photos de mission

## Installer
1. Supabase → SQL Editor : exécuter `supabase/v2_05_photos.sql` (après v2_04, réexécutable). Le bucket `operations-photos` et ses règles sont créés par le script : supprimer les anciennes règles « authenticated » posées à la main sur ce bucket, sinon elles restent actives en plus.
2. Vercel → variables serveur : `RESEND_API_KEY` (clé Resend), `ALERTS_FROM_EMAIL` (adresse d'un domaine vérifié dans Resend, ex. operations@vfa.fr). Les autres variables et le job Supabase Cron du guide ACTIVER_ALERTES_V2.4.md ne changent pas.
3. Redéployer, puis `npm test && npm run test:photos`.

## Mails par Resend
Les alertes partaient par MailerSend. Resend est désormais utilisé dès que `RESEND_API_KEY` est présente ; MailerSend reste possible avec `EMAIL_PROVIDER=mailersend`.
Chaque mail porte l'identifiant de l'alerte comme clé d'idempotence : en cas de coupure réseau ou d'erreur Resend, la file relance d'elle-même sans risque d'envoyer deux fois le même mail (Resend ignore le doublon pendant 24 h). Avec MailerSend, ces cas restent « incertains » et demandent une vérification manuelle.
Destinataires inchangés : coordinateur du dossier et dispatcheur responsable (à défaut, le planning). Le terrain et les clients ne reçoivent pas de mail.

## Photos
Sur le téléphone, mission en route, sur site ou terminée : **Prendre une photo** (ouvre l'appareil photo arrière) ou **Importer** (galerie, plusieurs à la fois). Chaque photo est classée : Enlèvement, Livraison, Réserve / dommage, Autre constat, avec une légende.
- Réduite à 2 048 px en JPEG avant l'envoi (4 à 12 Mo → quelques centaines de Ko), orientation conservée ; envoi une par une avec bouton Réessayer si le réseau coupe.
- **Réserve / dommage** : légende obligatoire ; mail et notification immédiats au coordinateur et au planning.
- Sur site, sans photo sur un enlèvement, une livraison ou une installation : rappel de photographier l'état des œuvres avant de clôturer (rappel, pas blocage).
- Dans le dossier, chaque mission affiche le nombre de photos et de réserves ; le coordinateur et le planning consultent et peuvent aussi en déposer (photos envoyées par le client, par exemple).

Droits vérifiés en base, fichiers et fiches : dépôt par l'équipe affectée, le coordinateur du dossier ou le planning ; le terrain ne voit que les photos de ses missions, le bureau voit tout ; l'auteur peut supprimer sa photo tant que la mission n'est pas close, ensuite seul le planning le peut (preuve conservée) ; bucket privé, liens d'affichage valables une heure, 15 Mo et formats image uniquement.

## Contrôles exécutés
- `npm test` : 22 tests réussis, dont Resend (clé d'idempotence, relances, refus, choix du fournisseur).
- `npm run test:photos` : droits de dépôt et de lecture sur la table et le stockage, chemin rangé sous la bonne mission, alerte réserve aux bons destinataires, conservation après clôture, bucket privé, migration réexécutable.
- `npm run test:securite`, typecheck et build réussis.

## Non vérifié ici
Envoi réel par Resend, dépôt réel dans Supabase Storage, prise de vue sur iPhone et Android (pas de navigateur ni de téléphone dans cet environnement). À tester sur une mission réelle avec chaque modèle de téléphone de l'équipe, notamment une photo HEIC importée depuis la galerie d'un iPhone.
