import { dateLong, time } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useMe } from '../lib/session';
import { Icon } from './ui';

export type Lecon = {
  id: string; eleve_id: string; moniteur_id: string; debut: string; fin: string;
  statut: 'reservee' | 'effectuee' | 'annulee' | 'annulee_tardive' | 'absence';
  eleve_prenom: string; eleve_nom: string; moniteur_prenom: string; moniteur_nom: string;
  commentaire: string | null; points: string[] | null; justificatif_statut: 'attente' | 'accepte' | 'refuse' | null;
  justificatif_motif: string | null; justificatif_chemin: string | null; annulee_le: string | null; reservee_par: string;
};

export const POINTS = ['demarrage', 'ville', 'priorites', 'giratoire', 'autoroute', 'stationnement', 'marche_arriere', 'cote', 'eco'];

export function StatutBadge({ l }: { l: Pick<Lecon, 'statut'> }) {
  const { t } = useI18n();
  const me = useMe();
  const cls = { reservee: 'dark', effectuee: 'ok', annulee: '', annulee_tardive: 'warn', absence: 'bad' }[l.statut];
  return <span className={'badge ' + cls}>{t('st_' + l.statut, { h: me.ecole.delai_annulation_h })}</span>;
}

export function LieuDepart() {
  const { t } = useI18n();
  const me = useMe();
  return (
    <div className="row small">
      <Icon name="pin" size={18} />
      <span><strong>{t('lieu_depart')} :</strong> {t('auto_ecole')}, {me.ecole.adresse}</span>
    </div>
  );
}

export function LeconTitre({ l }: { l: Lecon }) {
  const { lang } = useI18n();
  return <><strong>{dateLong(l.debut, lang)}</strong> · {time(l.debut, lang)}–{time(l.fin, lang)}</>;
}
