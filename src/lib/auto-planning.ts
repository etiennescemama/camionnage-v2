// Proposition automatique d'une journée de planning.
//
// Principe métier : une rotation (enlèvement → livraison → installation d'une même demande,
// même jour, même camion n°) est réalisée d'un bout à l'autre par le même camion et la même
// équipe. Le moteur place les rotations les plus contraintes d'abord, remplit les camions déjà
// sortis avant d'en sortir un nouveau, garde l'équipe avec son camion toute la journée, et
// réserve les permis C aux poids lourds quand un permis B suffit.
//
// Il ne réserve rien : chaque ligne est ensuite enregistrée par planifier_operation, qui
// refait tous les contrôles (conflits, permis, hayon, clim, volume, équipe) en transaction.

export type Creneau = 'matin' | 'apres_midi' | 'journee' | 'rdv' | null;
export interface Lieu { lat: number | null; lng: number | null }
export interface OpAPlacer {
  id: string; demande_id: string; numero: string; client: string; libelle: string;
  type_operation: string; ordre: number; periode: 'aller' | 'retour'; jour: number; rotation: number;
  duree_min: number; adresse: string | null; lieu: Lieu;
  creneau: Creneau; rdv_heure: string | null;
  nb_hommes: number; nb_camions: number; type_camion: string | null; besoin_hayon: boolean; besoin_clim: boolean;
}
export interface Camion { id: string; numero: string; volume_m3: number | null; hayon: boolean; climatise: boolean; poids_lourd: boolean }
export interface Equipier { id: string; nom: string; permis: string | null }
export interface Occupation { debut: number; fin: number; lieu?: Lieu } // minutes depuis minuit
export interface Contexte {
  camions: Camion[]; equipiers: Equipier[];
  occupationCamion: Record<string, Occupation[]>;
  occupationEquipier: Record<string, Occupation[]>;
  depot: Lieu;
  equipeCamion?: Record<string, string[]>; // équipe déjà à bord ce jour-là
  pasAvant?: number; // journée en cours : rien avant cette heure (minutes)
  reglages?: Partial<Reglages>;
}
export interface Reglages {
  debutJournee: number; finJournee: number; vitesseKmh: number; detour: number; margeMin: number;
  trajetInconnuMin: number; coutSortieCamion: number; tempsMaxEquipierMin: number;
}
export const REGLAGES: Reglages = {
  debutJournee: 7 * 60 + 30, finJournee: 18 * 60 + 30,
  vitesseKmh: 24, detour: 1.35, margeMin: 10, trajetInconnuMin: 30,
  coutSortieCamion: 90, tempsMaxEquipierMin: 10 * 60,
};
export interface LigneProposee {
  operation_id: string; heure_debut: string; duree_min: number; camion_id: string | null; equipiers: string[];
  adresse: string; trajet_min: number;
}
export interface Rotation { cle: string; ops: OpAPlacer[]; camion_id: string | null; equipiers: string[]; debut: number; fin: number; trajet_min: number }
export interface NonPlace { operation_ids: string[]; numero: string; client: string; libelle: string; raison: string }
export interface Proposition {
  lignes: LigneProposee[]; rotations: Rotation[]; non_places: NonPlace[];
  indicateurs: { camions_sortis: number; equipiers_mobilises: number; route_min: number; travail_min: number; attente_min: number; taux_occupation: number };
}

const CAMION_REQUIS = ['enlevement', 'livraison', 'transfert'];
const permisOk = (e: Equipier, pl: boolean) => (pl ? ['C', 'CE'] : ['B', 'C', 'CE']).includes(e.permis ?? '');
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const enMinutes = (t: string | null) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };

export function trajetMin(a: Lieu | undefined, b: Lieu | undefined, r: Reglages = REGLAGES) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return r.trajetInconnuMin;
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  const km = 2 * 6371 * Math.asin(Math.sqrt(h)) * r.detour;
  if (km < 0.3) return 0;
  return Math.ceil(km / r.vitesseKmh * 60 + r.margeMin);
}

function fenetre(op: OpAPlacer, r: Reglages): { min: number; max: number; fixe: boolean } {
  const rdv = enMinutes(op.rdv_heure);
  if (op.creneau === 'rdv' && rdv != null) return { min: rdv, max: rdv, fixe: true };
  // arrivée sur place au plus tard une heure avant la fin de la demi-journée
  if (op.creneau === 'matin') return { min: r.debutJournee, max: 11 * 60 + 30, fixe: false };
  if (op.creneau === 'apres_midi') return { min: 13 * 60 + 30, max: r.finJournee - 60, fixe: false };
  return { min: r.debutJournee, max: r.finJournee - 60, fixe: false };
}

// Regroupe les opérations en rotations indivisibles, dans l'ordre du dossier
export function rotations(ops: OpAPlacer[]) {
  const map = new Map<string, OpAPlacer[]>();
  for (const op of ops) {
    const cle = `${op.demande_id}|${op.periode}|${op.jour}|${op.rotation}`;
    map.set(cle, [...(map.get(cle) ?? []), op]);
  }
  return [...map.entries()].map(([cle, l]) => ({ cle, ops: l.sort((a, b) => a.ordre - b.ordre) }));
}

const libre = (occ: Occupation[], debut: number, fin: number) => occ.every(o => o.fin <= debut || o.debut >= fin);

interface EtatCamion { camion: Camion; occ: Occupation[]; equipe: string[]; sorti: boolean }

export function proposerJournee(ops: OpAPlacer[], ctx: Contexte): Proposition {
  const r = { ...REGLAGES, ...ctx.reglages };
  const occEq: Record<string, Occupation[]> = Object.fromEntries(ctx.equipiers.map(e => [e.id, [...(ctx.occupationEquipier[e.id] ?? [])]]));
  const camions: EtatCamion[] = ctx.camions.map(c => {
    const occ = [...(ctx.occupationCamion[c.id] ?? [])].sort((a, b) => a.debut - b.debut);
    return { camion: c, occ, equipe: [...(ctx.equipeCamion?.[c.id] ?? [])], sorti: occ.length > 0 };
  });
  const travail = (id: string) => (occEq[id] ?? []).reduce((n, o) => n + o.fin - o.debut, 0);
  const lignes: LigneProposee[] = [], faites: Rotation[] = [], non_places: NonPlace[] = [];

  // Les plus contraintes d'abord : RDV, créneau court, gros camion, grosse équipe, longue durée
  const aPlacer = rotations(ops).map(rot => {
    const tete = rot.ops[0];
    const f = fenetre(tete, r);
    const duree = rot.ops.reduce((n, o) => n + o.duree_min, 0);
    const volume = /^\d+$/.test(tete.type_camion ?? '') ? Number(tete.type_camion) : 0;
    const besoinCamion = tete.nb_camions > 0 && rot.ops.some(o => CAMION_REQUIS.includes(o.type_operation));
    return { ...rot, f, duree, volume, besoinCamion, tete };
  }).sort((a, b) =>
    Number(b.f.fixe) - Number(a.f.fixe) || (a.f.max - a.f.min) - (b.f.max - b.f.min) ||
    b.volume - a.volume || b.tete.nb_hommes - a.tete.nb_hommes || b.duree - a.duree);

  for (const rot of aPlacer) {
    const { tete, f, duree, volume, besoinCamion } = rot;
    const refus = (raison: string) => non_places.push({ operation_ids: rot.ops.map(o => o.id), numero: tete.numero, client: tete.client, libelle: rot.ops.map(o => o.libelle).join(' → '), raison });
    if (ctx.pasAvant != null) {
      if (f.fixe && f.min < ctx.pasAvant) { refus(`Rendez-vous de ${hhmm(f.min)} déjà passé ou trop proche`); continue; }
      f.min = Math.max(f.min, ctx.pasAvant);
      if (f.min > f.max) { refus('Créneau demandé déjà passé : changez le créneau ou la date'); continue; }
    }
    if (rot.ops.some(o => !o.adresse?.trim())) { refus('Lieu à préciser dans le dossier avant affectation'); continue; }

    // Horaires de chaque étape à partir d'un départ donné, trajets inclus
    const deroule = (depart: number) => {
      let t = depart; const etapes: { op: OpAPlacer; debut: number; trajet: number }[] = [];
      rot.ops.forEach((op, i) => {
        const trajet = i === 0 ? 0 : trajetMin(rot.ops[i - 1].lieu, op.lieu, r);
        t += trajet; etapes.push({ op, debut: t, trajet }); t += op.duree_min;
      });
      return { etapes, fin: t };
    };

    type Choix = { cout: number; ec: EtatCamion | null; equipe: string[]; depart: number; fin: number; approche: number; retour: number };
    let meilleur: Choix | null = null;

    // Équipe disponible sur [debut, fin], avec un conducteur adapté si camion
    const composer = (base: string[], pl: boolean | null, debut: number, fin: number) => {
      const ailleurs = (id: string) => Number(!base.includes(id) && camions.some(ec => ec.equipe.includes(id)));
      const dispo = (id: string) => libre(occEq[id] ?? [], debut, fin) && travail(id) + (fin - debut) <= r.tempsMaxEquipierMin;
      const equipe = base.filter(dispo);
      if (equipe.length < base.length) return null; // l'équipe du camion reste soudée
      const candidats = ctx.equipiers.filter(e => !equipe.includes(e.id) && dispo(e.id));
      if (pl !== null && !equipe.some(id => permisOk(ctx.equipiers.find(e => e.id === id)!, pl))) {
        // conducteur : on garde les permis C pour les poids lourds quand un B suffit
        const conducteurs = candidats.filter(e => permisOk(e, pl)).sort((a, b) =>
          ailleurs(a.id) - ailleurs(b.id) || (pl ? 0 : Number(a.permis !== 'B') - Number(b.permis !== 'B')) || travail(a.id) - travail(b.id));
        if (!conducteurs.length) return null;
        equipe.unshift(conducteurs[0].id);
      }
      const reste = candidats.filter(e => !equipe.includes(e.id))
        .sort((a, b) => ailleurs(a.id) - ailleurs(b.id) || Number(a.permis === 'C' || a.permis === 'CE') - Number(b.permis === 'C' || b.permis === 'CE') || travail(a.id) - travail(b.id));
      while (equipe.length < tete.nb_hommes && reste.length) equipe.push(reste.shift()!.id);
      if (equipe.length < tete.nb_hommes) return null;
      // le conducteur en tête : il sera chef de mission
      if (pl !== null) { const i = equipe.findIndex(id => permisOk(ctx.equipiers.find(e => e.id === id)!, pl)); if (i > 0) equipe.unshift(...equipe.splice(i, 1)); }
      return equipe;
    };

    if (besoinCamion) {
      for (const ec of camions) {
        const c = ec.camion;
        if (tete.besoin_hayon && !c.hayon) continue;
        if (tete.besoin_clim && !c.climatise) continue;
        if ((c.volume_m3 ?? 0) < volume) continue;
        // départs candidats : ouverture du créneau, ou juste après chaque occupation du camion
        const bornes = [...new Set([f.min, ...ec.occ.map(o => o.fin)])].sort((a, b) => a - b);
        const derniere = rot.ops[rot.ops.length - 1];
        for (const borne of bornes) {
          const precedent = ec.occ.filter(o => o.fin <= Math.max(borne, f.min)).pop();
          const approche = trajetMin(precedent?.lieu ?? ctx.depot, tete.lieu, r);
          const auPlusTot = (precedent ? precedent.fin : r.debutJournee) + approche;
          const depart = f.fixe ? f.min : Math.max(borne, f.min, auPlusTot);
          if (depart < auPlusTot || depart > f.max) continue;
          const { fin } = deroule(depart);
          const suivant = ec.occ.find(o => o.debut >= depart);
          const retour = trajetMin(derniere.lieu, suivant?.lieu ?? ctx.depot, r);
          if (fin + retour > r.finJournee + 60) continue;
          if (!libre(ec.occ, depart - approche, fin + (suivant ? retour : 0))) continue;
          const equipe = composer(ec.equipe, !!c.poids_lourd, depart - approche, fin + retour);
          if (!equipe) continue;
          // attente du camion entre deux missions, pause déjeuner déduite
          const creux = precedent ? Math.max(0, depart - approche - precedent.fin) : 0;
          const pause = precedent && precedent.fin <= 13 * 60 + 30 && depart - approche >= 12 * 60 ? 60 : 0;
          const attente = Math.max(0, creux - pause) * 0.3;
          // coût : route + attente + sortir un camion de plus + gaspiller un gros camion
          const cout = approche + retour + attente + (ec.sorti ? 0 : r.coutSortieCamion)
            + Math.max(0, (c.volume_m3 ?? 0) - volume) * 0.5 + (c.poids_lourd && volume < 27 ? 20 : 0) + (depart - f.min) * 0.1;
          if (!meilleur || cout < meilleur.cout) meilleur = { cout, ec, equipe, depart, fin, approche, retour };
          break; // plus tôt possible sur ce camion
        }
      }
      if (!meilleur) {
        const compatibles = camions.filter(({ camion: c }) => (!tete.besoin_hayon || c.hayon) && (!tete.besoin_clim || c.climatise) && (c.volume_m3 ?? 0) >= volume);
        refus(!compatibles.length
          ? `Aucun camion ${[volume ? `≥ ${volume} m³` : '', tete.besoin_hayon ? 'à hayon' : '', tete.besoin_clim ? 'climatisé' : ''].filter(Boolean).join(', ')} actif`
          : f.fixe ? `Aucun camion compatible ni équipe libre à ${hhmm(f.min)}` : `Camions compatibles ou équipes complets sur le créneau ${hhmm(f.min)}–${hhmm(f.max)}`);
        continue;
      }
    } else {
      // Sans camion (atelier, visite) : première équipe libre
      for (let depart = f.min; depart <= f.max; depart += 15) {
        const { fin } = deroule(depart);
        const equipe = composer([], null, depart, fin);
        if (equipe) { meilleur = { cout: 0, ec: null, equipe, depart, fin, approche: 0, retour: 0 }; break; }
        if (f.fixe) break;
      }
      if (!meilleur) { refus(`Pas assez de personnes libres (${tete.nb_hommes} requises) sur le créneau`); continue; }
    }

    // Réservation dans la proposition
    const { ec, equipe, depart, fin, approche, retour } = meilleur;
    const { etapes } = deroule(depart);
    if (ec) {
      ec.occ.push({ debut: depart - approche, fin, lieu: rot.ops[rot.ops.length - 1].lieu });
      ec.occ.sort((a, b) => a.debut - b.debut); ec.sorti = true;
      for (const id of equipe) if (!ec.equipe.includes(id)) ec.equipe.push(id);
    }
    for (const id of equipe) occEq[id].push({ debut: depart - approche, fin: fin + (ec ? 0 : retour) });
    etapes.forEach(({ op, debut, trajet }, i) => lignes.push({
      operation_id: op.id, heure_debut: hhmm(debut), duree_min: op.duree_min, camion_id: ec?.camion.id ?? null,
      equipiers: equipe, adresse: op.adresse!, trajet_min: i === 0 ? approche : trajet,
    }));
    faites.push({ cle: rot.cle, ops: rot.ops, camion_id: ec?.camion.id ?? null, equipiers: equipe, debut: depart, fin, trajet_min: approche + etapes.reduce((n, e) => n + e.trajet, 0) });
  }

  // Indicateurs de la journée proposée (nouvelles missions uniquement)
  const route_min = faites.reduce((n, f) => n + f.trajet_min, 0);
  const travail_min = faites.reduce((n, f) => n + f.ops.reduce((m, o) => m + o.duree_min, 0), 0);
  const mobilises = new Set(faites.flatMap(f => f.equipiers));
  let attente_min = 0;
  for (const ec of camions) {
    const occ = ec.occ; for (let i = 1; i < occ.length; i++) attente_min += Math.max(0, occ[i].debut - occ[i - 1].fin);
  }
  const amplitude = [...mobilises].reduce((n, id) => { const o = occEq[id]; return n + (o.length ? Math.max(...o.map(x => x.fin)) - Math.min(...o.map(x => x.debut)) : 0); }, 0);
  const occupe = [...mobilises].reduce((n, id) => n + occEq[id].reduce((m, o) => m + o.fin - o.debut, 0), 0);
  return {
    lignes, rotations: faites, non_places,
    indicateurs: {
      camions_sortis: camions.filter(c => c.sorti).length, equipiers_mobilises: mobilises.size,
      route_min, travail_min, attente_min, taux_occupation: amplitude ? Math.round(occupe / amplitude * 100) : 0,
    },
  };
}

// Emplacement physique d'une opération à partir des coordonnées confirmées de la demande
export function lieuOperation(op: { type_operation: string; periode?: string | null }, d: any, depot: Lieu): Lieu {
  const depart = { lat: d?.enlevement_lat ?? null, lng: d?.enlevement_lng ?? null };
  const arrivee = { lat: d?.livraison_lat ?? null, lng: d?.livraison_lng ?? null };
  const retour = op.periode === 'retour';
  if (['enlevement', 'visite', 'transfert'].includes(op.type_operation)) return retour ? arrivee : depart;
  if (['livraison', 'installation'].includes(op.type_operation)) return retour ? depart : arrivee;
  return depot; // réception, emballage, sortie : au garde-meuble
}

// Journée en cours : meilleures façons de glisser une mission (et sa rotation) dans les
// tournées existantes, camion par camion, du moins coûteux au plus coûteux.
export interface OptionInsertion { camion_id: string | null; equipiers: string[]; debut: number; fin: number; route_min: number; camion_deja_sorti: boolean; lignes: LigneProposee[] }
export function optionsInsertion(ops: OpAPlacer[], ctx: Contexte, max = 4): { options: OptionInsertion[]; raison: string | null } {
  const besoinCamion = ops[0]?.nb_camions > 0 && ops.some(o => CAMION_REQUIS.includes(o.type_operation));
  const essais = besoinCamion ? ctx.camions.map(c => ({ ...ctx, camions: [c] })) : [ctx];
  const options: (OptionInsertion & { score: number })[] = [];let raison: string | null = null;
  for (const c of essais) {
    const p = proposerJournee(ops, c);
    if (p.non_places.length || !p.rotations.length) { raison ??= p.non_places[0]?.raison ?? null; continue; }
    const r = p.rotations[0], camion = r.camion_id, sorti = !!camion && (ctx.occupationCamion[camion] ?? []).length > 0;
    options.push({ camion_id: camion, equipiers: r.equipiers, debut: r.debut, fin: r.fin, route_min: r.trajet_min, camion_deja_sorti: sorti, lignes: p.lignes,
      score: r.trajet_min + (sorti ? 0 : REGLAGES.coutSortieCamion) + r.debut * 0.05 });
  }
  options.sort((a, b) => a.score - b.score);
  return { options: options.slice(0, max).map(({ score, ...o }) => o), raison: options.length ? null : raison ?? 'Aucun camion ni équipe disponible sur le créneau' };
}
