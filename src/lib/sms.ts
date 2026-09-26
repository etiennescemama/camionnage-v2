// SMS terrain : numéro, texte court et lisible, envoi Brevo (défaut) ou Twilio.

// Numéro de fiche équipier → format international. Les numéros français saisis
// « 06 12 34 56 78 » ou « 0033 6… » sont acceptés ; le reste doit commencer par +.
export function numeroInternational(brut: string | null | undefined): string | null {
  if (!brut) return null;
  let n = brut.replace(/[\s.\-()]/g, '');
  if (n.startsWith('00')) n = '+' + n.slice(2);
  if (/^0[1-9]\d{8}$/.test(n)) n = '+33' + n.slice(1);
  return /^\+[1-9]\d{7,14}$/.test(n) ? n : null;
}

// Alphabet GSM 7 bits : 160 caractères par SMS au lieu de 70 dès qu'un « ê » ou « ç » apparaît.
const GSM = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
export function versGsm(t: string) {
  return [...t.replace(/[’‘]/g, "'").replace(/«[\s\u00a0]*/g, '"').replace(/[\s\u00a0]*»/g, '"').replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/\u00a0/g, ' ')]
    .map(c => GSM.includes(c) ? c : c.normalize('NFD').replace(/[\u0300-\u036f]/g, '')).join('')
    .replace(/[^\n\r -~£¥èéùìòÇØøÅåÆæßÉÄÖÑÜ§¿äöñüà¡¤]/g, '');
}
export const segments = (t: string) => (t.length <= 160 ? 1 : Math.ceil(t.length / 153));

export interface MissionSms {
  heure: string | null; client: string; type: string; adresse: string | null; camion: string | null;
  etat: string; affecte_le: string; maj_le: string;
}
const TYPES: Record<string, string> = { enlevement: 'enlèvement', livraison: 'livraison', installation: 'installation', emballage: 'emballage', reception_gm: 'réception GM', sortie_gm: 'sortie GM', transfert: 'transfert', visite: 'visite' };
const jourCourt = (ymd: string) => new Date(ymd + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
const ligne1 = (a: string | null) => (a ?? '').split('\n')[0].trim().slice(0, 45);

// Trois SMS maximum ; au-delà, renvoi vers la feuille de route en ligne.
export function composerSms({ nature, jour, aujourdhui, prenom, missions, dernierEnvoi, lien }: {
  nature: 'veille' | 'changement'; jour: string; aujourdhui: string; prenom: string; missions: MissionSms[]; dernierEnvoi: string | null; lien: string;
}): string {
  const quand = jour === aujourdhui ? "aujourd'hui" : `le ${jourCourt(jour)}`;
  const tri = [...missions].sort((a, b) => (a.heure ?? '99').localeCompare(b.heure ?? '99'));
  const camions = [...new Set(tri.map(m => m.camion).filter(Boolean))];
  const tete = nature === 'veille'
    ? `VFA - ${prenom}, demain ${jourCourt(jour)} :`
    : tri.length ? `VFA - ${prenom}, planning modifié ${quand} :` : `VFA - ${prenom}, plus aucune mission ${quand}. Contactez le planning si besoin.`;
  if (!tri.length) return versGsm(tete);
  const marque = (m: MissionSms) => {
    if (nature === 'veille' || !dernierEnvoi) return '';
    if (m.affecte_le > dernierEnvoi) return 'NOUVEAU ';
    return m.etat === 'planifiee' && m.maj_le > dernierEnvoi ? 'MODIFIE ' : '';
  };
  const items = tri.map(m => `${marque(m)}${(m.heure ?? '--:--').slice(0, 5)} ${m.client} (${TYPES[m.type] ?? m.type})${m.adresse ? ', ' + ligne1(m.adresse) : ''}`);
  const pied = `${camions.length === 1 ? ` Camion ${camions[0]}.` : ''} Détail : ${lien}`;
  let corps = items.join(' ; ') + '.';
  const max = 459 - tete.length - pied.length - 2;
  if (corps.length > max) {
    let n = items.length;
    while (n > 1 && (items.slice(0, n).join(' ; ') + ` ; +${items.length - n} autre(s).`).length > max) n--;
    corps = (items.slice(0, n).join(' ; ') + (n < items.length ? ` ; +${items.length - n} autre(s).` : '.')).slice(0, max);
  }
  return versGsm(`${tete} ${corps}${pied}`);
}

export type ResultatSms = { status: string; provider_id: string | null; last_error: string | null };
export function smsConfig(env: Record<string, string | undefined> = process.env) {
  const provider = env.SMS_PROVIDER === 'twilio' || (!env.BREVO_API_KEY && env.TWILIO_ACCOUNT_SID) ? 'twilio' : 'brevo';
  const pret = provider === 'brevo' ? !!env.BREVO_API_KEY : !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && (env.TWILIO_FROM || env.TWILIO_MESSAGING_SERVICE_SID));
  return { provider, pret, expediteur: (env.SMS_SENDER || 'VFA').replace(/[^A-Za-z0-9]/g, '').slice(0, 11) || 'VFA' };
}

export async function envoyerSms(to: string, texte: string, env: Record<string, string | undefined> = process.env, request: typeof fetch = fetch): Promise<ResultatSms> {
  const cfg = smsConfig(env);
  try {
    if (cfg.provider === 'twilio') {
      const f = new URLSearchParams({ To: to, Body: texte });
      if (env.TWILIO_MESSAGING_SERVICE_SID) f.set('MessagingServiceSid', env.TWILIO_MESSAGING_SERVICE_SID); else f.set('From', env.TWILIO_FROM!);
      const r = await request(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST', body: f, signal: AbortSignal.timeout(8000),
        headers: { Authorization: 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const j: any = await r.json().catch(() => ({}));
      if (r.status === 201 && j.sid) return { status: 'sent', provider_id: j.sid, last_error: null };
      if (r.status === 429) return { status: 'pending', provider_id: null, last_error: 'Limite Twilio : nouvelle tentative.' };
      return { status: r.status >= 500 ? 'uncertain' : 'failed', provider_id: null, last_error: `Twilio ${r.status} : ${j.message ?? 'refus'}` };
    }
    const r = await request('https://api.brevo.com/v3/transactionalSMS/sms', {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { 'api-key': env.BREVO_API_KEY!, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ type: 'transactional', unicodeEnabled: false, sender: cfg.expediteur, recipient: to.replace('+', ''), content: texte, tag: 'camionnage' }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (r.status === 201 || (r.ok && j.messageId)) return { status: 'sent', provider_id: String(j.messageId ?? j.reference ?? ''), last_error: null };
    if (r.status === 429) return { status: 'pending', provider_id: null, last_error: 'Limite Brevo : nouvelle tentative.' };
    if (r.status === 402) return { status: 'failed', provider_id: null, last_error: 'Crédits SMS Brevo épuisés.' };
    return { status: r.status >= 500 ? 'uncertain' : 'failed', provider_id: null, last_error: `Brevo ${r.status} : ${j.message ?? 'refus'}` };
  } catch {
    return { status: 'uncertain', provider_id: null, last_error: 'Réponse réseau inconnue : vérifier le journal du fournisseur avant relance.' };
  }
}
