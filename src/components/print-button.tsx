'use client';
export function PrintButton() { return <button onClick={() => window.print()} className="bg-ink text-white rounded-lg px-4 py-2">Imprimer / enregistrer en PDF</button>; }
