> Correctif 2.2.1 : lire CORRECTIF_V2.2.1.md. Les profils incomplets ne bloquent plus le calcul ; ils produisent une estimation signalée sans péage.

# Camionnage 2.2 — adresses, planning et feuille de route

Cette version conserve les exports, l’API de lecture et le correctif de notifications de la 2.1.1.

## Mettre à jour votre application

1. Sauvegarder la base puis exécuter **uniquement `supabase/v2_02_adresses_planification.sql`** dans Supabase → SQL Editor. Migration additive et réexécutable, sans suppression de tables ou de données. **Ne pas rejouer `v2_01_schema.sql` sur une base existante : le script initial est destructif.**
2. Remplacer le code du dépôt GitHub par le contenu du dossier `v2`, conserver les variables existantes et redéployer sur Vercel. Installation : `npm ci`.
3. Pour activer géocodage, itinéraires et péages : ajouter **HERE_API_KEY** comme variable serveur Vercel, avec accès HERE Geocoding & Search v7 et Routing v8 / péages, puis redéployer. Ne pas la préfixer par NEXT_PUBLIC. Aucun identifiant n’est livré. L’usage dépend des droits et tarifs de votre compte HERE.
4. Dans **Référentiels → Camions**, renseigner les dimensions **hors tout en centimètres**, le **PTAC en kg** et les essieux. Vérifier PL/VL, hayon et climatisation. Ces valeurs ne sont pas déduites du volume de caisse.
5. Dans **Référentiels → Équipiers**, vérifier les permis et sélectionner le **compte de connexion** de chaque personne. Un chauffeur non rattaché ne voit aucune mission. Un compte terrain doit correspondre à un équipier actif unique.

Pour une installation neuve seulement : initialiser avec v2_01 puis appliquer v2_02. Les consignes « aucune migration nécessaire » des documents historiques 2.1 / 2.1.1 ne s’appliquent pas à cette version.

## Adresses et carte

Les adresses d’enlèvement et de livraison sont saisies avec quatre champs distincts : numéro/rue, code postal, ville, pays. Ces valeurs et les coordonnées confirmées sont enregistrées séparément ; l’adresse complète est maintenue pour les documents. Les codes postaux conservent les zéros initiaux et les formats internationaux.

Cliquer **Localiser cette adresse**, puis confirmer la proposition exacte. Aucun résultat n’est accepté silencieusement. Modifier un champ invalide les coordonnées et le calcul routier précédent.

Les anciennes adresses restent intactes. Lors de leur modification, le texte complet est proposé dans le champ rue : le découpage se fait manuellement ou en confirmant une proposition géographique. Les opérations d’enlèvement, livraison et installation non démarrées reprennent les adresses mises à jour, avec inversion au retour. Vérifier le lieu de chaque opération, notamment visites, ateliers, réserves et démontages. Les exports CSV comportent des colonnes distinctes pour les rues, CP, villes et pays.

## Distance, durée et péages par camion

Dans une nouvelle demande ou dans le dossier : confirmer les deux points, sélectionner les véhicules et lancer le calcul. Ce choix sert au calcul ; l’affectation effective se fait dans Planning.

Le serveur interroge HERE séparément pour chaque camion : mode PL ou utilitaire commercial VL, dimensions, essieux et PTAC. Le poids courant est pris égal au PTAC pour un calcul conservateur. Les configurations avec remorque, marchandises dangereuses ou paramètres environnementaux spécifiques nécessitent une adaptation avant utilisation.

La carte trace les itinéraires retournés. Un tableau affiche distance, conduite estimée, péages lorsqu’ils sont disponibles et avertissements. Aucun kilométrage ni prix de substitution n’est inventé si le service est absent ou le profil incomplet. Un péage inconnu n’est jamais converti en 0 €.

Un total multi-camions n’apparaît que si tous les calculs sont exploitables, en supposant que **chacun des véhicules sélectionnés effectue ce trajet**. Les parcours peuvent différer selon le gabarit.

Calcul **aller simple**, hors pauses, manutention, carburant et retour. Il ne modifie pas automatiquement les durées du planning. Les résultats restent dans la session de saisie et ne sont pas archivés en base. La date/heure facultative utilise le fuseau du navigateur ; sans date, la requête utilise `departureTime=any`. Vérifier les alertes, les restrictions et le dernier accès au site.

Le fond cartographique utilise Leaflet et OpenStreetMap par défaut. NEXT_PUBLIC_MAP_TILE_URL et NEXT_PUBLIC_MAP_ATTRIBUTION permettent un autre fournisseur. Respecter les conditions des tuiles et prévoir un service adapté à la volumétrie. En cas de fond de carte indisponible, l’application le signale ; le tracé et les chiffres restent consultables.

## Planifier pas à pas

1. Choisir une opération à affecter, ou une mission déjà affectée. Les demandes à accepter disposent d’un accès séparé.
2. Renseigner le lieu exact, la date, le début et la durée.
3. Choisir le camion et l’équipe ; le premier équipier sélectionné est chef d’équipe.
4. Écrire les consignes terrain, vérifier le récapitulatif et confirmer.

La confirmation enregistre opération et équipe dans une transaction. Contrôles : conflits horaires de camion/équipiers (y compris à cheval sur minuit), indisponibilités, effectif, permis, volume de camion demandé, hayon et climatisation. Les opérations d’atelier/manutention peuvent être planifiées sans camion.

Le calendrier jour/semaine/mois reste accessible en consultation. L’affectation passe par le formulaire guidé. Retirer une opération ne retire plus toutes les autres affectations de sa demande.

Les contrôles portent sur les réservations existantes. Ils ne calculent pas les liaisons géographiques entre deux missions ni les temps de conduite/repos réglementaires : prévoir ces durées au planning. La sérialisation couvre les appels à `planifier_operation`, pas des écritures SQL externes directes. Modifier les paramètres d’une demande entièrement planifiée peut toujours provoquer sa déplanification.

## Vue chauffeur

**Ma feuille de route** montre uniquement les missions de l’équipier connecté. La mission en cours ou la prochaine mission est mise en avant, avec :

- **Où aller** : lieu, camion et lien de localisation.
- **Ce que je dois faire** : action métier, œuvres et colis.
- **Consignes à suivre**, contact et équipe.
- Un bouton principal : **Démarrer le déplacement → Je suis arrivé sur place → Terminer cette mission**, avec compte rendu et nom de réceptionnaire facultatif.

Les horaires d’arrivée/départ viennent du serveur. Les transitions sont contrôlées ; une erreur de réseau ne fait pas avancer fictivement la mission. Les missions suivantes et terminées restent consultables. Les missions futures sont en lecture seule ; une mission passée encore ouverte peut être clôturée.

Le responsable planning dispose d’un aperçu par équipier en lecture seule. Le lien cartographique localise l’adresse et ne constitue pas une navigation PL certifiée. Le nom de réceptionnaire ne remplace pas une signature électronique. Pas de fonctionnement hors connexion dans cette version.

## Validation

- `npm test` : neuf groupes (filtres, CSV, notifications, adresses, profils, péages).
- `npm run test:db` : PostgreSQL embarqué isolé (PGlite), schéma initial et migration, rôle authenticated et RLS ; affectation, conflit, équipe insuffisante, permis, désaffectation isolée, mise à jour d’adresse, migration réexécutable.
- `npm run build` : compilation et contrôle TypeScript.
- Navigateur avec services simulés : planification et confirmation, adresses séparées, choix des points, carte avec géométrie simulée, invalidation du calcul, vue mobile 390 px, parcours chauffeur complet et échec d’enregistrement affiché sans progression.
- Captures dans `apercus` : **données fictives**. Elles ne prouvent aucun kilométrage ni tarif réel.

À valider sur votre environnement : droits utilisateurs, données existantes, clé et droits HERE, profils réels, tarifs retournés, fond cartographique, notifications et usage terrain. Aucun déploiement, appel HERE authentifié réel ou changement de votre base Supabase n’a été effectué ici.

## Documentation des services

- https://docs.here.com/geocoding-and-search/docs/geocode
- https://docs.here.com/routing/docs/routing-v8-vehicle-properties
- https://docs.here.com/routing/docs/routing-v8-tolls-for-route
- https://docs.here.com/routing/docs/routing-v8-light-commercial-vehicle-routing
- https://leafletjs.com/examples/quick-start/
