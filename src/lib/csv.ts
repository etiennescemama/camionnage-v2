// Neutralise spreadsheet formulas, then quote every value (including newlines).
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function demandesCsv(rows: any[]) {
  return '\uFEFF' + [
    ['Numéro','Client','Affaire Akanea','Date','Créneau','État','Camions','Équipiers par camion','Rue enlèvement','CP enlèvement','Ville enlèvement','Pays enlèvement','Rue livraison','CP livraison','Ville livraison','Pays livraison'],
    ...rows.map(d => [d.numero,d.client?.nom,d.code_affaire,d.date_souhaitee,d.creneau,d.etat,d.nb_camions,d.nb_hommes,d.enlevement_rue,d.enlevement_code_postal,d.enlevement_ville,d.enlevement_pays,d.livraison_rue,d.livraison_code_postal,d.livraison_ville,d.livraison_pays]),
  ].map(row => row.map(csvCell).join(';')).join('\r\n');
}
