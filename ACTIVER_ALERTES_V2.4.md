# Camionnage 2.4 — suivi et alertes internes

## Installer
1. Dans Supabase SQL Editor, exécuter UNIQUEMENT `supabase/v2_03_suivi_alertes.sql` après les migrations v2_01 et v2_02 déjà appliquées. Ne pas relancer v2_01 : elle réinitialise les tables opérationnelles.
2. Remplacer le code du projet et redéployer sur Vercel. Conserver les variables existantes, dont HERE_API_KEY.

## Lire le parcours
- Demande : le coordinateur saisit et transmet.
- Validation : le responsable planning accepte ou refuse. Acceptée = à affecter.
- Affectation : toutes les opérations doivent avoir un horaire, les moyens et l’équipe requis. Les compteurs montrent les affectations partielles.
- Réalisation : le terrain démarre puis clôture chaque mission. Le transport retour éventuel fait partie des opérations ; une demande avec un aller terminé et un retour à faire reste en cours.
- Retour terrain : le coordinateur relit horaires, comptes rendus et réserves. Un compte rendu absent est signalé. Ce contrôle est humain, sans validation administrative ni facturation automatique.

Le bouton « Terminer » global a été retiré : il pouvait marquer toutes les opérations réalisées sans passage par le terrain. Pour les anciennes missions clôturées sans compte rendu, contacter l’équipe ; cette version ne crée pas de compte rendu rétroactif.

## Destinataires et contenu des mails
Uniquement les utilisateurs internes actifs : coordinateur du dossier et dispatcheur responsable ; en l’absence de responsable nommé, les dispatcheurs et administrateurs. Aucun envoi aux clients ni à toute l’équipe terrain par défaut. Vérifier les emails dans Utilisateurs.

Événements : demande transmise, acceptation ou refus, planification complète, changement de mission ou d’équipe, début de réalisation, réalisation et annulation. Une modification anodine sans changement d’étape ne déclenche pas de mail. Un événement de demande remplace les alertes de mission du même dossier et de la même transaction. Les mails contiennent le numéro, une explication et un lien vers le dossier protégé par connexion, sans inventaire détaillé des œuvres.

## Activer MailerSend
Dans les variables serveur Vercel :
- `MAILERSEND_API_KEY` : jeton MailerSend autorisé à envoyer depuis votre domaine.
- `ALERTS_FROM_EMAIL` : adresse d’expédition de votre domaine vérifié.
- `ALERTS_CRON_SECRET` : secret aléatoire long (au moins 32 caractères), distinct des clés Supabase et HERE.
- `NEXT_PUBLIC_SITE_URL` : URL HTTPS de production du site.
- `SUPABASE_SERVICE_ROLE_KEY` : clé serveur Supabase existante.
- `EMAIL_ALERTS_ENABLED=true` : autorise l’envoi. Laisser false pour conserver les alertes en attente.

Ne jamais préfixer les clés secrètes par NEXT_PUBLIC_. Les alertes ne sont pas encore activées par la livraison de ce ZIP ; aucun mail réel n’a été envoyé pendant les tests. L’usage reste soumis à votre quota / offre MailerSend, sans souscription automatique.

## Déclenchement automatique avec Supabase Cron
Dans Supabase → Integrations → Cron, activer le module si nécessaire puis créer un job HTTP :
- Nom : `camionnage-alertes`
- Fréquence : `* * * * *` (chaque minute)
- Méthode : POST
- URL : `https://VOTRE-SITE/api/alerts/send`
- En-tête `Authorization` : `Bearer VOTRE_ALERTS_CRON_SECRET`
- En-tête `Content-Type` : `application/json`
- Corps : `{}`
- Si un délai maximum est proposé, prévoir 60 secondes.

Ce job traite cinq alertes par appel. Surveiller la file si le volume augmente. Aucun abonnement Vercel Cron n’est nécessaire à cette configuration. Si le déploiement Vercel est protégé par une authentification supplémentaire, autoriser ce job via le mécanisme de contournement sécurisé prévu par votre hébergement, sans rendre les dossiers publics.

## Contrôler
Ouvrir Exports & API → Alertes par mail. Créer une demande de test, vérifier les destinataires avant activation, puis laisser le job traiter la file.
- En attente : prochain passage du job. Un refus pour quota est différé de 15 minutes, cinq tentatives maximum.
- Accepté par MailerSend : accepté par l’API, pas une preuve de livraison ; consulter MailerSend pour les rebonds et la distribution.
- En pause : fournisseur en pause, à vérifier chez MailerSend.
- Échec : vérifier configuration et adresse du destinataire.
- Incertain, ou traitement bloqué plusieurs minutes : vérifier MailerSend avant toute relance. Pas de réexpédition aveugle après une réponse réseau ambiguë.

Après vérification seulement, un administrateur peut remettre une ligne en attente dans Supabase (`status=pending`, `attempts=0`, `available_at=maintenant`). Cela peut réexpédier un message déjà reçu : vérifier d’abord son éventuel identifiant fournisseur. Pour abandonner une ancienne alerte, passer son statut à `skipped` avant activation. La migration ne réexpédie pas les événements antérieurs à son installation.

Validation locale : tests unitaires des étapes et des réponses MailerSend ; base PostgreSQL embarquée pour file, droits, réservation exclusive et migration réexécutable ; compilation ; parcours navigateur avec services simulés.

Documentation officielle :
- https://developers.mailersend.com/api/v1/email
- https://supabase.com/docs/guides/cron/quickstart
