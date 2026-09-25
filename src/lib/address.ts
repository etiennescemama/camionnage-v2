export type Address = { rue: string; code_postal: string; ville: string; pays: string; lat?: number; lng?: number; label?: string };
export const emptyAddress = (): Address => ({rue:'',code_postal:'',ville:'',pays:'France'});
export function addressText(a: Address) { if(!a.rue && !a.ville && !a.code_postal) return ''; return [a.rue, [a.code_postal,a.ville].filter(Boolean).join(' '),a.pays].filter(Boolean).join(', '); }
export function addressFrom(d:any,side:'enlevement'|'livraison'):Address {
  return {rue:d[side+'_rue'] ?? d['adresse_'+side] ?? '',code_postal:d[side+'_code_postal'] ?? '',ville:d[side+'_ville'] ?? '',pays:d[side+'_pays'] ?? 'France',lat:d[side+'_lat'] ?? undefined,lng:d[side+'_lng'] ?? undefined};
}
export function addressColumns(a:Address,side:'enlevement'|'livraison') {
  return {['adresse_'+side]:addressText(a),[side+'_rue']:a.rue || null,[side+'_code_postal']:a.code_postal || null,[side+'_ville']:a.ville || null,[side+'_pays']:a.pays || null,[side+'_lat']:a.lat ?? null,[side+'_lng']:a.lng ?? null};
}
