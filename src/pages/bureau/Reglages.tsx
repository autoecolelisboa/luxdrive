import { useState } from 'react';
import { backend } from '../../lib/backend';
import { dateShort, euro, ibanValide } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useMe } from '../../lib/session';
import { Field, Loading, Sheet, useAction, useLoad } from '../../components/ui';
import { InviteForm } from './Eleves';

export function Reglages() {
  const { t, lang } = useI18n();
  const me = useMe();
  const b = backend();
  const { run, busy } = useAction();
  const gerant = me.profil.role === 'gerant';
  const bureau = gerant || me.profil.role === 'secretariat';
  const [invite, setInvite] = useState(false);
  const [ferme, setFerme] = useState({ jour: '', libelle: '' });

  const { data, error, reload } = useLoad(async () => {
    const [formules, insc, fermetures, equipe] = await Promise.all([
      b.select('formules', { order: [['ordre', 'asc']] }),
      b.select('inscription_lignes', { order: [['ordre', 'asc']] }),
      b.select('fermetures', { order: [['jour', 'asc']] }),
      b.select('profils', { in: { role: ['gerant', 'secretariat', 'moniteur', 'lecture'] }, order: [['role', 'asc'], ['prenom', 'asc']] }),
    ]);
    return { formules, insc, fermetures, equipe };
  }, []);
  const [ae, setAe] = useState(() => ({ ...me.ecole, heures: me.ecole.heures_lecons.join(', ') }));
  const [prix, setPrix] = useState<Record<string, string>>({});
  const [lignes, setLignes] = useState<Record<string, { ht: string; taux: string }>>({});

  if (!data) return <Loading error={error} />;
  const jours = t('jours_courts').split(',');

  const save = () => run(async () => {
    if (ae.iban?.trim() && !ibanValide(ae.iban)) throw new Error('IBAN_INVALIDE');
    const heures = ae.heures.split(/[,;\s]+/).map(Number).filter(h => Number.isInteger(h) && h >= 0 && h <= 23).sort((a, c) => a - c);
    await b.update('auto_ecoles', {
      adresse: ae.adresse, telephone: ae.telephone, email: ae.email, beneficiaire: ae.beneficiaire, iban: ae.iban?.toUpperCase() ?? null,
      numero_tva: ae.numero_tva, numero_agrement: ae.numero_agrement, delai_annulation_h: Number(ae.delai_annulation_h),
      forme_juridique: ae.forme_juridique || null, representant: ae.representant || null, rcs: ae.rcs || null,
      autorisation_etablissement: ae.autorisation_etablissement || null,
      max_lecons_semaine: Number(ae.max_lecons_semaine), jours_ouverture: ae.jours_ouverture, heures_lecons: heures,
    }, { id: me.ecole.id });
    for (const [id, v] of Object.entries(prix)) await b.update('formules', { prix_ttc: Number(v.replace(',', '.')) }, { id });
    for (const [id, v] of Object.entries(lignes)) await b.update('inscription_lignes', { montant_ht: Number(v.ht.replace(',', '.')), taux_tva: Number(v.taux.replace(',', '.')) }, { id });
    setPrix({}); setLignes({});
    await me.reload(); reload();
  }, t('enregistre'));

  const inscTotal = data.insc.reduce((s: number, l: any) => {
    const v = lignes[l.id]; const ht = Number((v?.ht ?? String(l.montant_ht)).replace(',', '.')); const tx = Number((v?.taux ?? String(l.taux_tva)).replace(',', '.'));
    return s + ht + Math.round(ht * tx) / 100;
  }, 0);

  return (
    <div className="stack">
      <h1>{t('nav_reglages')}</h1>
      {!gerant && <div className="alert">{t('gerant_seul')}</div>}
      <fieldset disabled={!gerant} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
        <div className="section-title">{t('tarifs')}</div>
        <div className="list">
          {data.formules.map((f: any) => (
            <div className="item" key={f.id}>
              <div className="grow">{f.heures === 1 ? t('lecon_unite') : t('forfait_n', { n: f.heures })}<div className="muted small">{t('tva')} {Number(f.taux_tva)} %</div></div>
              <input className="input mono" style={{ width: 110, textAlign: 'right' }} inputMode="decimal" aria-label={f.code} value={prix[f.id] ?? String(f.prix_ttc)} onChange={e => setPrix(p => ({ ...p, [f.id]: e.target.value }))} /> €
            </div>
          ))}
        </div>

        <div className="section-title">{t('frais_inscription')}</div>
        <div className="list">
          {data.insc.map((l: any) => (
            <div className="item" key={l.id}>
              <div className="grow">{l.libelle}</div>
              <input className="input mono" style={{ width: 100, textAlign: 'right' }} inputMode="decimal" value={lignes[l.id]?.ht ?? String(l.montant_ht)} onChange={e => setLignes(x => ({ ...x, [l.id]: { ht: e.target.value, taux: x[l.id]?.taux ?? String(l.taux_tva) } }))} /> €
              <input className="input mono" style={{ width: 64, textAlign: 'right' }} inputMode="decimal" value={lignes[l.id]?.taux ?? String(l.taux_tva)} onChange={e => setLignes(x => ({ ...x, [l.id]: { ht: x[l.id]?.ht ?? String(l.montant_ht), taux: e.target.value } }))} /> %
            </div>
          ))}
          <div className="item"><div className="grow"><strong>{t('total')} {t('ttc')}</strong></div><strong className="mono">{euro(inscTotal, lang)}</strong></div>
        </div>

        <div className="section-title">{t('regles')}</div>
        <div className="card stack">
          <div className="grid2">
            <Field label={t('delai_annulation')}><input className="input" type="number" min={0} value={ae.delai_annulation_h} onChange={e => setAe({ ...ae, delai_annulation_h: Number(e.target.value) })} /></Field>
            <Field label={t('max_semaine')}><input className="input" type="number" min={1} value={ae.max_lecons_semaine} onChange={e => setAe({ ...ae, max_lecons_semaine: Number(e.target.value) })} /></Field>
          </div>
          <Field label={t('heures_lecons')}><input className="input" value={ae.heures} onChange={e => setAe({ ...ae, heures: e.target.value })} /></Field>
          <Field group label={t('jours_ouverture')}>
            <div className="chips">
              {jours.map((j, i) => {
                const d = i + 1; const on = ae.jours_ouverture.includes(d);
                return <button type="button" key={d} className={'chip' + (on ? ' on' : '')} onClick={() => setAe({ ...ae, jours_ouverture: on ? ae.jours_ouverture.filter(x => x !== d) : [...ae.jours_ouverture, d].sort() })}>{j}</button>;
              })}
            </div>
          </Field>
        </div>

        <div className="section-title">{t('coordonnees')}</div>
        <div className="card stack">
          <Field label={t('adresse')}><input className="input" value={ae.adresse ?? ''} onChange={e => setAe({ ...ae, adresse: e.target.value })} /></Field>
          <div className="grid2">
            <Field label={t('telephone')}><input className="input" value={ae.telephone ?? ''} onChange={e => setAe({ ...ae, telephone: e.target.value })} /></Field>
            <Field label={t('email')}><input className="input" type="email" value={ae.email ?? ''} onChange={e => setAe({ ...ae, email: e.target.value })} /></Field>
            <Field label={t('beneficiaire')}><input className="input" value={ae.beneficiaire ?? ''} onChange={e => setAe({ ...ae, beneficiaire: e.target.value })} /></Field>
            <Field label={t('iban')}><input className="input mono" value={ae.iban ?? ''} onChange={e => setAe({ ...ae, iban: e.target.value })} placeholder="LU.." />{ae.iban?.trim() && !ibanValide(ae.iban) && <span className="small" style={{ color: 'var(--danger)' }}>{t('err_IBAN_INVALIDE')}</span>}</Field>
            <Field label={t('numero_tva')}><input className="input" value={ae.numero_tva ?? ''} onChange={e => setAe({ ...ae, numero_tva: e.target.value })} placeholder="LU12345678" /></Field>
            <Field label={t('numero_agrement')}><input className="input" value={ae.numero_agrement ?? ''} onChange={e => setAe({ ...ae, numero_agrement: e.target.value })} /></Field>
          </div>
        </div>
        <div className="section-title">{t('mentions_legales')}</div>
        <div className="card stack">
          {(!ae.rcs || !ae.autorisation_etablissement || !ae.forme_juridique || !ae.representant || !ae.email) && <div className="alert warn small">{t('mentions_a_completer')}</div>}
          <div className="grid2">
            <Field label={t('forme_juridique')}><input className="input" value={ae.forme_juridique ?? ''} onChange={e => setAe({ ...ae, forme_juridique: e.target.value })} placeholder="s.à r.l., entreprise individuelle…" /></Field>
            <Field label={t('representant')}><input className="input" value={ae.representant ?? ''} onChange={e => setAe({ ...ae, representant: e.target.value })} /></Field>
            <Field label={t('rcs')}><input className="input" value={ae.rcs ?? ''} onChange={e => setAe({ ...ae, rcs: e.target.value })} placeholder="B123456 / A123456" /></Field>
            <Field label={t('autorisation_etablissement')}><input className="input" value={ae.autorisation_etablissement ?? ''} onChange={e => setAe({ ...ae, autorisation_etablissement: e.target.value })} /></Field>
          </div>
          <p className="small muted">{t('mentions_info')}</p>
        </div>
        {gerant && <button className="btn block" disabled={busy} onClick={save}>{t('enregistrer')}</button>}
      </fieldset>

      <div className="section-title">{t('fermetures')}</div>
      <div className="list">
        {data.fermetures.map((f: any) => (
          <div className="item" key={f.id}>
            <div className="grow">{dateShort(f.jour, lang)} · {f.libelle}</div>
            {bureau && <button className="btn ghost sm" onClick={() => run(async () => { await b.remove('fermetures', { id: f.id }); reload(); })}>✕</button>}
          </div>
        ))}
        {bureau && (
          <div className="item">
            <input className="input" type="date" style={{ maxWidth: 170 }} value={ferme.jour} onChange={e => setFerme({ ...ferme, jour: e.target.value })} />
            <input className="input grow" placeholder={t('motif')} value={ferme.libelle} onChange={e => setFerme({ ...ferme, libelle: e.target.value })} />
            <button className="btn sm" disabled={!ferme.jour || !ferme.libelle} onClick={() => run(async () => { await b.insert('fermetures', [{ auto_ecole_id: me.ecole.id, ...ferme }]); setFerme({ jour: '', libelle: '' }); reload(); })}>{t('ajouter')}</button>
          </div>
        )}
      </div>

      <div className="row between"><div className="section-title">{t('equipe')}</div>{gerant && <button className="btn sm secondary" onClick={() => setInvite(true)}>{t('ajouter')}</button>}</div>
      <div className="list">
        {data.equipe.map((p: any) => (
          <div className="item" key={p.id}>
            <div className="grow"><strong>{p.prenom} {p.nom}</strong><div className="muted small">{t('role_' + p.role)}</div></div>
            {!p.actif && <span className="badge bad">inactif</span>}
            {bureau && p.id !== me.profil.id && p.role !== 'gerant' && (
              <button className="btn ghost sm" onClick={() => run(async () => { await b.rpc('definir_acces', { p_user: p.id, p_role: null, p_actif: !p.actif }); reload(); }, t('enregistre'))}>{p.actif ? t('desactiver') : t('activer')}</button>
            )}
          </div>
        ))}
      </div>
      <Sheet open={invite} onClose={() => setInvite(false)} title={t('equipe')}>
        {invite && <InviteForm role="moniteur" allowRole onDone={() => { setInvite(false); reload(); }} />}
      </Sheet>
    </div>
  );
}
