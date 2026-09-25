// Neutralise spreadsheet formulas, then quote every value (including newlines).
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function demandesCsv(rows: any[]) {
  return '\uFEFF' + [
    ['Numéro','Client','Affaire Akanea','Date','Créneau','État','Camions','Équipiers par camion'],
    ...rows.map(d => [d.numero,d.client?.nom,d.code_affaire,d.date_souhaitee,d.creneau,d.etat,d.nb_camions,d.nb_hommes]),
  ].map(row => row.map(csvCell).join(';')).join('\r\n');
}
