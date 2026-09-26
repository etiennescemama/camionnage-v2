# Camionnage 2.5 — moins de ressaisie

Remplacer le code du projet et redéployer. Aucune nouvelle migration depuis la version 2.4. Le guide ACTIVER_ALERTES_V2.4.md reste applicable pour les mails.

## Demandes récurrentes
Depuis un dossier : « Reprendre pour une nouvelle demande ». Ou depuis Nouvelle demande : choisir l’une des cinq demandes récentes proposées. Client, contacts, adresses et points confirmés, objets, quantités, besoins et consignes sont préremplis. Vérifiez-les avant envoi. Les jours / rotations sont régénérés depuis les opérations types du dossier source ; les demandes dont les opérations varient selon les jours ou les camions ne sont pas reprises automatiquement pour éviter une copie inexacte.

La nouvelle date proposée est demain et doit être vérifiée. Le code affaire, l’heure imposée et la date de retour sont effacés et restent à renseigner. Les anciennes affectations, états d’exécution, comptes rendus et identifiants ne sont jamais copiés. Le nouveau dossier n’est créé qu’après votre envoi au planning et suit le parcours de validation habituel.

## Affectation
Dans le planning ou le dossier : « Reprendre camion et équipe » reprend les moyens d’une autre opération du même dossier. Le chef d’équipe est conservé en premier, seuls les moyens présents dans les référentiels actifs sont proposés. Vérifiez le créneau de la nouvelle mission : ni l’heure, ni l’adresse, ni les consignes ne sont écrasées. Les conflits, permis et caractéristiques restent contrôlés par le serveur lors de l’enregistrement.

Après confirmation dans le planning, la prochaine mission en attente du même dossier s’ouvre automatiquement. Les moyens précédents peuvent être repris d’un clic. Chaque opération reste confirmée individuellement pour permettre de vérifier son horaire et les temps de liaison.

## Écran allégé
Les détails d’une adresse confirmée sont repliés mais restent modifiables. La carte et le calcul routier sont dans une section facultative ; ils ne retardent plus l’accès aux champs essentiels.

Validation : compilation de production, tests unitaires de copie sélective et de reprise d’équipe, essais navigateur avec services simulés. Gain de temps réel à mesurer en exploitation ; aucun résultat chronométré n’est revendiqué.
