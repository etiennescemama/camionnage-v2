import { z } from 'zod';
export const FILTERS = [
  { key: 'actives', label: 'En cours de traitement', etats: ['envoyee','acceptee','planifiee','en_cours'] },
  { key: 'a_traiter', label: 'À traiter', etats: ['envoyee'] },
  { key: 'a_planifier', label: 'À planifier', etats: ['acceptee'] },
  { key: 'planifiees', label: 'Planifiées', etats: ['planifiee','en_cours'] },
  { key: 'terminees', label: 'Terminées', etats: ['terminee'] },
  { key: 'brouillons', label: 'Brouillons', etats: ['brouillon'] },
  { key: 'refusees', label: 'Refusées / annulées', etats: ['refusee','annulee'] },
  { key: 'toutes', label: 'Toutes', etats: [] },
];
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s);
export const querySchema = z.object({
  f: z.enum(['actives','a_traiter','a_planifier','planifiees','terminees','brouillons','refusees','toutes']).default('actives'),
  q: z.string().max(100).default(''), client: z.string().uuid().optional(), mine: z.enum(['0','1']).default('0'),
  from: date.optional(), to: date.optional(), page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50), format: z.enum(['json','csv']).default('json'),
}).refine(v => !v.from || !v.to || v.from <= v.to, { message: 'La date de fin doit suivre la date de début.' });
export type DemandeQuery = z.infer<typeof querySchema>;
export const LIST_SELECT = 'id,numero,code_affaire,client_id,date_souhaitee,creneau,rdv_heure,nb_camions,nb_hommes,nb_jours,type_camion,etat,coordinateur_id,client:clients(nom),coordinateur:utilisateurs!coordinateur_id(prenom,nom),operations(id,etat)';
export async function listDemandes(db: any, userId: string, p: DemandeQuery) {
  let query = db.from('demandes').select(LIST_SELECT, { count: 'exact' });
  const states = FILTERS.find(f => f.key === p.f)!.etats;
  if (states.length) query = query.in('etat', states);
  if (p.mine === '1') query = query.eq('coordinateur_id', userId);
  if (p.client) query = query.eq('client_id', p.client);
  if (p.from) query = query.gte('date_souhaitee', p.from);
  if (p.to) query = query.lte('date_souhaitee', p.to);
  // Restrict PostgREST syntax; no raw filter expression supplied by the caller.
  const term = p.q.replace(/[^\p{L}\p{N} .-]/gu, ' ').trim();
  if (term) query = query.or(`numero.ilike.%${term}%,code_affaire.ilike.%${term}%,objets.ilike.%${term}%`);
  return query.order('date_souhaitee', { ascending: true, nullsFirst: false }).order('id').range((p.page - 1) * p.limit, p.page * p.limit - 1);
}
