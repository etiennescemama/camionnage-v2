# Camionnage 2.3 — identité VFA / ATI

## Mise à jour
Remplacez les fichiers du projet GitHub puis redéployez sur Vercel. Gardez vos variables Supabase et HERE_API_KEY. Aucune nouvelle migration SQL par rapport à la version 2.2.1.

## Présentation
Navigation anthracite avec identité VFA / ATI, repérage de la rubrique et notifications en en-tête. Typographie Inter (police système en secours), titres renforcés, fond blanc/gris neutre, séparateurs fins, palette de statuts mesurée. Page de connexion à deux volets. Planning avec indicateurs alignés, liste de missions et formulaire d’affectation. Demandes avec filtres sobres et lignes structurées. Vue chauffeur avec mission principale à en-tête sombre, horaire mis en avant et action de progression identifiable.

Suggestions d’adresses HERE, calcul d’itinéraire, exports, affectations et contrôles d’accès conservés.

## Vérification
Compilation de production réussie. Parcours navigateur sur ordinateur et mobile : affectation, saisie d’adresse par suggestion, carte, invalidation après modification d’adresse et progression de mission avec gestion d’erreur. Services Supabase et HERE simulés pour ces essais. Captures dans apercus, avec données de démonstration. La version n’est pas encore déployée sur votre hébergement.
