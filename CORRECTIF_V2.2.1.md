# Camionnage 2.2.1 — adresses et durée

Remplacez les fichiers du projet et redéployez sur votre hébergement. Conservez HERE_API_KEY côté serveur et vos variables Supabase. Aucune nouvelle migration SQL si v2_02_adresses_planification.sql est déjà appliquée.

## Adresse
Le champ « Rechercher une adresse » propose jusqu’à cinq adresses dès trois caractères, après une pause de 400 ms. Choisir une proposition renseigne rue, code postal, ville, pays et coordonnées via HERE Autocomplete puis Lookup. La saisie manuelle reste disponible. Les réponses obsolètes sont ignorées ; modifier une adresse confirmée invalide son ancien point.

## Camions
Le calcul ne bloque plus si les caractéristiques routières sont incomplètes. Le type PL/VL et les données disponibles sont transmis à HERE ; aucune dimension n’est déduite du volume de caisse. Une estimation avec profil incomplet est explicitement signalée : les restrictions correspondant aux caractéristiques absentes ne peuvent pas être vérifiées. Les péages sont alors masqués. Complétez les dimensions EXTERIEURES du véhicule, le PTAC et les essieux dans Référentiels → Camions pour affiner le calcul. Le PTAC renseigné sert de poids conservateur ; ce n’est pas le poids chargé mesuré.

Les durées restent des estimations de conduite, hors manutention et pauses. Aucun tarif HERE ni gratuité illimitée n’est garanti : les appels utilisent votre compte existant.

Validation : tests unitaires, compilation de production et parcours navigateur avec réponses HERE simulées. Pas de validation avec une clé HERE réelle dans cet environnement.
