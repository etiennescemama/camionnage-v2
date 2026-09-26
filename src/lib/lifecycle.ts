export function lifecycle(d:any,operations:any[]) {
 const ops=operations.filter(o=>o.etat!=='annulee');const total=ops.length;
 const assigned=ops.filter(o=>['planifiee','en_route','sur_site','terminee'].includes(o.etat)).length;
 const done=ops.filter(o=>o.etat==='terminee').length;
 const reports=ops.filter(o=>o.etat==='terminee' && o.compte_rendu?.trim()).length;
 const returns=ops.filter(o=>o.periode==='retour');
 const stopped=['refusee','annulee'].includes(d.etat);
 const stage=d.etat==='brouillon'?0:d.etat==='envoyee'?1:d.etat==='acceptee'?2:d.etat==='planifiee'?3:d.etat==='en_cours'?3:d.etat==='terminee'?4:1;
 const next:Record<string,[string,string]>={brouillon:['Coordinateur','Compléter et transmettre la demande au planning.'],envoyee:['Responsable planning','Accepter la demande ou expliquer le refus.'],acceptee:['Responsable planning',`Affecter les moyens : ${assigned}/${total} opérations affectées. Une affectation partielle ne suffit pas.`],planifiee:['Équipe terrain','Consulter les missions puis démarrer le déplacement à la date prévue.'],en_cours:[assigned<total?'Planning et équipe terrain':'Équipe terrain',`${assigned<total?`Planning : ${total-assigned} opération(s) restent à affecter. `:''}Poursuivre les missions : ${done}/${total} réalisées. Renseigner les horaires et le compte rendu.`],terminee:['Coordinateur',reports===total && total>0?'Relire les comptes rendus et les réserves avant le traitement administratif.':`Récupérer les comptes rendus manquants (${reports}/${total} disponibles), puis vérifier les réserves.`],refusee:['Coordinateur','Lire le motif, corriger la demande puis la renvoyer si nécessaire.'],annulee:['Aucune action','La demande est annulée.']};
 return {stage,stopped,total,assigned,done,reports,returns:returns.length,returnsDone:returns.filter(o=>o.etat==='terminee').length,owner:next[d.etat]?.[0]??'Planning',action:next[d.etat]?.[1]??'Vérifier le dossier.'};
}
