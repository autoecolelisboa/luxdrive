import { LOCALE, type Lang } from './i18n';

export const TZ = 'Europe/Luxembourg';

export const euro = (n: number, lang: Lang = 'fr') =>
  new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const dateLong = (iso: string, lang: Lang) =>
  cap(new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(new Date(iso)));

export const dateShort = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat(LOCALE[lang], { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ }).format(new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso));

export const time = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat(LOCALE[lang], { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));

export const dayParts = (ymd: string, lang: Lang) => {
  const d = new Date(ymd + 'T12:00:00Z');
  return {
    wd: new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'short', timeZone: TZ }).format(d),
    day: new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', timeZone: TZ }).format(d),
    month: new Intl.DateTimeFormat(LOCALE[lang], { month: 'short', timeZone: TZ }).format(d),
    isoDow: ((d.getUTCDay() + 6) % 7) + 1,
  };
};

/** Luxembourg calendar date (YYYY-MM-DD) of an instant, shifted by n days */
export const luxDate = (date: Date = new Date(), addDays = 0) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  if (!addDays) return p;
  const d = new Date(p + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + addDays);
  return d.toISOString().slice(0, 10);
};

/** Start of a Luxembourg day as an ISO instant */
export const luxDayStart = (ymd: string) => {
  const guess = new Date(ymd + 'T00:00:00Z');
  const offsetMin = (d: Date) => {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' }).format(d);
    const m = s.match(/GMT([+-]\d+)(?::(\d+))?/);
    return m ? Number(m[1]) * 60 + Math.sign(Number(m[1])) * Number(m[2] ?? 0) : 0;
  };
  return new Date(guess.getTime() - offsetMin(guess) * 60000).toISOString();
};

export const hoursUntil = (iso: string) => (new Date(iso).getTime() - Date.now()) / 3600000;

/** EPC QR (SEPA credit transfer) payload. ASCII only so every banking app reads it. */
export const epcPayload = (o: { benef: string; iban: string; montant: number; communication: string }) => {
  const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '');
  return ['BCD', '002', '1', 'SCT', '', ascii(o.benef).slice(0, 70), o.iban.replace(/\s+/g, '').toUpperCase(),
    'EUR' + Number(o.montant).toFixed(2), '', '', ascii(o.communication).slice(0, 140)].join('\n');
};

/** IBAN check: country length + mod-97 checksum */
const IBAN_LEN: Record<string, number> = { LU: 20, FR: 27, BE: 16, DE: 22, PT: 25, NL: 18, ES: 24, IT: 27, CH: 21 };
export const ibanValide = (raw: string) => {
  const s = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(s)) return false;
  const len = IBAN_LEN[s.slice(0, 2)];
  if (len && s.length !== len) return false;
  const r = s.slice(4) + s.slice(0, 4);
  let mod = 0;
  for (const c of r) { const v = parseInt(c, 36).toString(); for (const d of v) mod = (mod * 10 + Number(d)) % 97; }
  return mod === 1;
};
