# Correctif 2.1.1 — notifications Realtime

Erreur observée : `cannot add postgres_changes callbacks ... after subscribe()`.

Les cloches de la barre ordinateur et de la barre mobile sont toutes deux montées, même lorsque le CSS en masque une. Elles utilisent désormais un fournisseur de notifications commun dans le layout. Ce fournisseur possède un seul abonnement actif pour l’interface. Chaque montage d’effet crée un nom de canal unique ; les callbacks sont enregistrés avant subscribe(), puis le canal est retiré au démontage. Les anciens résultats réseau sont ignorés.

Les deux cloches partagent aussi leur liste et leur état lu/non lu. Un bouton Actualiser et des messages d’erreur permettent de réessayer si la connexion temps réel est interrompue. Les insertions et mises à jour Realtime déclenchent un rafraîchissement de la liste.

## Installation

Remplacer le projet par le contenu du dossier v2 puis redéployer sur Vercel. Pas de migration SQL et pas de nouvelle variable d’environnement.

Pour ne remplacer que le correctif, les fichiers nécessaires sont :
- src/components/bell.tsx
- src/components/notifications-provider.tsx (nouveau)
- src/components/sidebar.tsx
- src/lib/notifications.ts (nouveau)
- src/app/(app)/layout.tsx

Après déploiement réussi, recharger complètement la page pour récupérer les nouveaux fichiers JavaScript. Tester Notifications, Tout marquer lu, puis une navigation entre plusieurs pages, sur ordinateur et mobile.

La capture fournie montre un canal notif:<utilisateur> sans suffixe unique, alors que le code de l’archive 2.1 possédait déjà un suffixe aléatoire. Cela suggère un ancien bundle encore servi ou une version différente déployée. Vérifier que le dernier déploiement utilise bien le code livré.

Validation : six groupes de tests réussis, dont deux dédiés au cycle de vie des notifications ; compilation Next.js réussie. Connexion Realtime et affichage dans votre environnement non testés ici.
