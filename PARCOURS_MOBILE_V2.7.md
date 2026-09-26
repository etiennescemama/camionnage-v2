# Camionnage 2.7 — parcours mobile guidé

Redéployer le code. Aucune nouvelle migration depuis la version 2.4. Les variables et le guide des alertes restent inchangés.

Sur téléphone et tablette étroite, la saisie se déroule en trois étapes :
1. Quand : date, créneau, code affaire et retour éventuel.
2. Quoi : client, contact, trajet, objets, consignes et moyens. Les contenus préremplis restent en résumés modifiables.
3. Vérifier : récapitulatif du client, des dates, du trajet, des objets, des moyens et des consignes. Seul le bouton final envoie au planning.

Les boutons Continuer / Retour / Envoyer restent accessibles en bas. Revenir en arrière conserve les données dans le formulaire. Les champs invalides sont signalés et leur section est ouverte pour correction. Le clavier ne permet pas de transmettre depuis une étape intermédiaire. Changer de scénario ramène à la première étape. Les données ne sont pas sauvegardées en brouillon automatiquement : un rechargement de page peut perdre les modifications non envoyées.

Sur ordinateur large, le formulaire reste développé avec son bouton d’envoi dans la colonne des dates. Carte et disponibilités restent chargées à la demande comme en 2.6.

Validation locale : navigation mobile complète, date obligatoire, email invalide dans un bloc replié, conservation après retour en arrière, absence d’écriture avant confirmation et contenu envoyé vérifié avec services simulés. Compilation de production. Le temps gagné en utilisation réelle reste à mesurer.
