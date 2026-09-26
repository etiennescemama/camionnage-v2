export type Role = 'coordinateur' | 'dispatcheur' | 'chauffeur' | 'gm' | 'emballage' | 'direction' | 'admin';
export interface Utilisateur { id: string; prenom: string; nom: string; email: string; role: Role; actif: boolean; }
export interface Client { id: string; nom: string; code_akanea: string | null; email: string | null; telephone: string | null; }
export interface Camion { id: string; numero: string; immatriculation: string | null; volume_m3: number | null; hayon: boolean; climatise: boolean; poids_lourd: boolean; rampe: boolean; actif: boolean; }
export interface Equipier { id: string; prenom: string; nom: string | null; permis: string | null; role: string | null; telephone: string | null; utilisateur_id: string | null; actif: boolean; }
export interface Scenario { code: string; libelle: string; description: string | null; ops_aller: string; ops_retour: string | null; nb_jours: number; nb_camions: number; nb_hommes: number; type_camion: string | null; besoin_hayon: boolean; besoin_clim: boolean; creneau_fixe: boolean; profils: string | null; ordre: number; actif: boolean; }
export interface TempsStandard { type_operation: string; libelle: string; duree_base_min: number; min_par_m3: number; hommes_defaut: number; ordre: number; }
export type DemandeEtat = 'brouillon' | 'envoyee' | 'acceptee' | 'planifiee' | 'en_cours' | 'terminee' | 'refusee' | 'annulee';
export type OpEtat = 'a_planifier' | 'planifiee' | 'en_route' | 'sur_site' | 'terminee' | 'annulee';
export interface Demande {
  id: string; numero: string; client_id: string | null; code_affaire: string | null;
  contact_nom: string | null; contact_email: string | null; contact_telephone: string | null;
  adresse_enlevement: string | null; adresse_livraison: string | null;
  objets: string | null; nb_colis: number | null; volume_m3: number | null;
  date_souhaitee: string | null; creneau: 'matin' | 'apres_midi' | 'journee' | 'rdv' | null; rdv_heure: string | null; date_fin: string | null;
  nb_hommes: number; nb_camions: number; nb_jours: number; scenario_code: string | null; date_retour: string | null; creneau_retour: string | null; type_camion: string | null; besoin_hayon: boolean; besoin_clim: boolean; observations: string | null;
  etat: DemandeEtat; motif_refus: string | null; coordinateur_id: string | null; dispatcheur_id: string | null; specifique: boolean;
  created_at: string; updated_at: string;
}
export interface Operation {
  id: string; demande_id: string; type_operation: string; ordre: number; libelle: string | null; adresse: string | null;
  date_prevue: string | null; heure_debut: string | null; duree_min: number | null; camion_id: string | null; etat: OpEtat;
  periode: 'aller' | 'retour'; jour: number; rotation: number; consignes: string | null; heure_arrivee: string | null; heure_depart: string | null; compte_rendu: string | null; signature_nom: string | null;
}
export const ETAT_LABEL: Record<DemandeEtat, string> = {
  brouillon: 'Brouillon', envoyee: 'À traiter', acceptee: 'À affecter', planifiee: 'Planifiée', en_cours: 'En cours', terminee: 'Réalisée · retour à vérifier', refusee: 'Refusée', annulee: 'Annulée',
};
export const ETAT_CLASS: Record<DemandeEtat, string> = {
  brouillon: 'bg-fog text-mute', envoyee: 'bg-ochre-soft text-ochre', acceptee: 'bg-cobalt-soft text-cobalt-ink', planifiee: 'bg-moss-soft text-moss',
  en_cours: 'bg-cobalt text-white', terminee: 'bg-moss text-white', refusee: 'bg-brick-soft text-brick', annulee: 'bg-fog text-mute line-through',
};
export const OP_ETAT_LABEL: Record<OpEtat, string> = { a_planifier: 'À planifier', planifiee: 'Planifiée', en_route: 'En route', sur_site: 'Sur site', terminee: 'Terminée', annulee: 'Annulée' };
export const CRENEAU_LABEL = { matin: 'Matin', apres_midi: 'Après-midi', journee: 'Journée', rdv: 'RDV' } as const;
export const TYPES_CAMION = [
  { code: '14', libelle: '14 m³ (sans hayon)' }, { code: '20', libelle: '20 m³ hayon' }, { code: '27', libelle: '27 m³ PL clim' },
  { code: '35', libelle: '35 m³ PL clim' }, { code: '50', libelle: '50 m³ PL clim' },
];
export const ROLE_LABEL: Record<Role, string> = { coordinateur: 'Coordinateur', dispatcheur: 'Dispatcheur', chauffeur: 'Chauffeur', gm: 'Garde-meuble', emballage: 'Emballage', direction: 'Direction', admin: 'Administrateur' };
