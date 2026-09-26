# Camionnage 2.10 — SMS aux équipes et missions ajoutées en cours de journée

## Installer
1. Supabase → SQL Editor : exécuter `supabase/v2_06_sms.sql` (après v2_05, réexécutable).
2. Compte SMS : Brevo (par défaut) ou Twilio. Chez Brevo, créditer le compte SMS et créer une clé API.
3. Vercel → variables serveur : `SMS_ENABLED=true`, `BREVO_API_KEY`, `SMS_SENDER=VFA` (11 lettres ou chiffres maximum, affiché comme expéditeur), `SMS_VEILLE_HEURE=18:00` (facultatif). Pour Twilio : `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`.
4. Référentiels → Équipiers : renseigner le portable de chacun (« 06 12 34 56 78 » accepté). Sans numéro, pas de SMS.
5. Aucun nouveau job : le job Supabase Cron des alertes (chaque minute, voir ACTIVER_ALERTES_V2.4.md) traite aussi les SMS, même si les mails sont désactivés.

## Ce que reçoit l'équipe
- **La veille à 18 h** : sa feuille de route du lendemain, horaires triés, client, type de mission, adresse, camion, et le lien vers la feuille de route détaillée sur le téléphone.
  Exemple : « VFA - Karim, demain mer 30/09 : 08:07 Galerie Mitterrand (enlèvement), 79 rue du Fg Saint-Honoré ; 13:30 Musée Carnavalet (enlèvement), 23 rue de Sévigné. Camion 12196. Détail : https://… »
- **Dans la journée**, quand une mission lui est ajoutée ou retirée, ou change d'heure, de lieu, de camion, de consignes, ou est annulée : un SMS avec son programme à jour. Les missions nouvelles sont marquées NOUVEAU, les modifiées MODIFIE. Si plus rien ne reste : « plus aucune mission aujourd'hui ».
- Les changements de mission du lendemain partent aussi immédiatement si la feuille de la veille a déjà été envoyée ; avant 18 h, ils sont simplement inclus dans la feuille.
- Plusieurs changements en 2 minutes = un seul SMS. Aucun SMS de changement entre 21 h et 6 h 30 : ils partent à 6 h 30.
- Texte sans caractères spéciaux coûteux (« ê », « ç », guillemets) : 160 caractères par SMS au lieu de 70 ; 3 SMS maximum, le reste renvoie au lien.
- Seul le planning voit le journal des SMS (table `sms_alertes` : texte envoyé, statut, erreur).

## Ajouter une mission dans la journée
Planning → mission « à affecter » → encadré **Glisser dans une tournée en cours**. L'outil propose jusqu'à 4 possibilités, de la moins coûteuse à la plus coûteuse : heure, camion, équipe, temps de route, et s'il faut sortir un camion supplémentaire. Un clic sur **Affecter** enregistre toute la rotation (enlèvement puis livraison) sur ce camion ; l'équipe reçoit son SMS dans les 2 minutes.
- Pour aujourd'hui, rien n'est proposé avant l'heure actuelle + 30 min ; un rendez-vous déjà passé est signalé.
- La proposition prolonge en priorité un camion déjà dehors, avec son équipe, plutôt que d'en sortir un autre.
- « Proposer la journée » tient compte de la même règle quand on l'utilise pour aujourd'hui.

Côté téléphone : la feuille de route du jour se met à jour seule chaque minute et au retour dans l'application ; une mission ajoutée dans la journée porte l'étiquette « Ajoutée à 14:02 ».

## Contrôles exécutés
- `npm test` : 29 tests, dont numéros, texte GSM, contenu des SMS (veille, NOUVEAU / MODIFIE, longueur), envoi Brevo et Twilio simulé, insertion en journée.
- `npm run test:sms` (base embarquée) : prévenu à l'ajout, au retrait, à la modification ; rien pour une mission lointaine ; regroupement ; pas de faux « nouveau » quand le planning réenregistre sans changement ; sans numéro ignoré ; feuille de veille unique ; heures calmes ; file réservée au serveur.
- Sécurité, photos, planning et alertes repassent avec toutes les migrations ; typecheck et build réussis.

## Non vérifié ici
Envoi réel d'un SMS (compte Brevo ou Twilio nécessaire), réception sur les téléphones, rendu à l'écran. Faire un essai avec un seul équipier et son numéro avant d'activer pour toute l'équipe. Coût : selon le tarif SMS du fournisseur choisi pour la France.
Pour l'emploi des numéros personnels des salariés, informer les équipes (usage professionnel, planning uniquement).
