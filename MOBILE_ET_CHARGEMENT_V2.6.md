# Camionnage 2.6 — saisie mobile et chargement

## Installer
Remplacer les fichiers du projet et redéployer. Aucune nouvelle migration SQL depuis 2.4. Conserver les variables Supabase, HERE et celles des alertes. Le guide ACTIVER_ALERTES_V2.4.md reste applicable.

## Saisie sur téléphone
Date et code affaire en premier. Client/contact, trajet/objets et consignes s’affichent en résumés modifiables. Les blocs non renseignés de client et trajet restent ouverts au démarrage d’une demande vierge. Les champs restent conservés lorsqu’un bloc est replié. Le bouton d’envoi et les erreurs restent accessibles au-dessus de la navigation inférieure. Sur ordinateur, les blocs conservent leur présentation développée.

## Chargements supprimés au démarrage
- Aucun calcul de disponibilités dans le formulaire tant que la comparaison n’est pas ouverte, y compris au retour.
- Aucun chargement du calculateur routier, du module de carte et de ses tuiles tant que la section carte n’est pas ouverte. La nouvelle demande ne charge plus toute la flotte au démarrage ; elle la charge à l’ouverture de la carte.
- Le planning ne calcule plus les capacités dans la requête serveur initiale : elles sont demandées à l’ouverture du calendrier avec un indicateur de chargement et un message en cas d’erreur.
- Les données de la demande source et ses opérations sont récupérées en parallèle des référentiels.
- Suppression de la feuille de police distante : utilisation des polices natives du système.

La fermeture de la carte libère son contenu ; rouvrir la section nécessite un nouveau calcul si vous aviez demandé un itinéraire. Les coordonnées d’adresse restent conservées.

## Validation et limites
Compilation de production. Essai navigateur à 390 pixels : modification d’un résumé, repli, conservation des données lors de l’envoi, absence de débordement horizontal et bouton au-dessus de la navigation. Vérification des requêtes : pas de demande de disponibilités ni de tuiles avant ouverture ; appels déclenchés à l’ouverture. Réponses Supabase simulées dans ces essais, aucun envoi réel de demande client ou de mail.

Ces corrections réduisent le travail inutile au chargement, sans fournir de mesure de latence sur votre hébergement. La latence réseau, la localisation / charge de Supabase et les démarrages serveur Vercel peuvent encore intervenir. Les contrôles d’authentification sont conservés ; aucune donnée utilisateur n’est mise en cache partagé.
