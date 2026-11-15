import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { backend } from '../lib/backend';
import { euro } from '../lib/format';
import { useI18n, type Lang } from '../lib/i18n';
import { Loading, useLoad } from '../components/ui';

export const CREATEUR = 'HMA Productions';
export const ANNEE = 2026;
// Creator contact, never written in clear in the page (assembled only when clicked)
const contactCreateur = () => { const u = ['hma', 'lux07'].join('.'); const d = ['gmail', 'com'].join('.'); location.href = 'mai' + 'lto:' + u + '@' + d + '?subject=LuxDrive'; };

type Infos = {
  nom: string; adresse: string | null; telephone: string | null; email: string | null; numero_tva: string | null; rcs: string | null;
  forme_juridique: string | null; representant: string | null; autorisation_etablissement: string | null; numero_agrement: string | null;
  delai_annulation_h: number; max_lecons_semaine: number;
  formules: { nom: string; heures: number; prix_ttc: number; taux_tva: number }[];
  inscription: { libelle: string; montant_ht: number; taux_tva: number }[];
};
export type LegalKind = 'mentions' | 'conditions' | 'confidentialite';

const TITRES: Record<LegalKind, Record<Lang, string>> = {
  mentions: { fr: 'Mentions légales', en: 'Legal notice', pt: 'Informação legal' },
  conditions: { fr: 'Conditions générales', en: 'Terms and conditions', pt: 'Condições gerais' },
  confidentialite: { fr: 'Confidentialité (RGPD)', en: 'Privacy (GDPR)', pt: 'Privacidade (RGPD)' },
};
export const legalTitle = (k: LegalKind, l: Lang) => TITRES[k][l];

const v = (x: string | null | undefined, l: Lang) => x?.trim() || ({ fr: 'à compléter', en: 'to be completed', pt: 'a completar' } as const)[l];

/** Small footer: copyright, creator and legal links (shown on every screen) */
export function LegalFooter() {
  const { lang } = useI18n();
  return (
    <footer className="legal-footer no-print">
      <div>© {ANNEE} Auto École Lisboa · LuxDrive © {ANNEE} <button type="button" className="linklike" onClick={contactCreateur}>{CREATEUR}</button></div>
      <div className="row wrap" style={{ justifyContent: 'center', gap: 12 }}>
        {(['mentions', 'conditions', 'confidentialite'] as LegalKind[]).map(k => <Link key={k} to={`/legal/${k}`}>{legalTitle(k, lang)}</Link>)}
      </div>
    </footer>
  );
}

export function LegalPage({ kind }: { kind: LegalKind }) {
  const { lang } = useI18n();
  const { data, error } = useLoad(() => backend().rpc<Infos>('infos_publiques'), []);
  if (!data) return <Loading error={error} />;
  const Page = { mentions: Mentions, conditions: Conditions, confidentialite: Confidentialite }[kind];
  return (
    <article className="legal stack">
      <h1>{legalTitle(kind, lang)}</h1>
      <Page i={data} l={lang} />
      <p className="muted small">{({ fr: 'Dernière mise à jour : novembre 2026.', en: 'Last updated: November 2026.', pt: 'Última atualização: novembro de 2026.' })[lang]}</p>
    </article>
  );
}

const H = ({ children }: { children: ReactNode }) => <h2 style={{ fontSize: 18, marginTop: 20 }}>{children}</h2>;

function Identite({ i, l }: { i: Infos; l: Lang }) {
  const lab = {
    fr: ['Forme juridique', 'Représentant légal', 'Adresse', 'Téléphone', 'E-mail', 'RCS', 'N° TVA', 'Autorisation d’établissement', 'Agrément auto-école'],
    en: ['Legal form', 'Legal representative', 'Address', 'Phone', 'Email', 'Trade register (RCS)', 'VAT number', 'Business permit', 'Driving school licence'],
    pt: ['Forma jurídica', 'Representante legal', 'Morada', 'Telefone', 'E-mail', 'RCS', 'N.º IVA', 'Autorização de estabelecimento', 'Licença de escola de condução'],
  }[l];
  const vals = [i.forme_juridique, i.representant, i.adresse, i.telephone, i.email, i.rcs, i.numero_tva, i.autorisation_etablissement, i.numero_agrement];
  return (
    <div className="list">
      <div className="item"><strong>{i.nom}</strong></div>
      {lab.map((k, n) => (n === 8 && !vals[n]) ? null : <div className="item small" key={k}><span className="muted" style={{ width: 170 }}>{k}</span><span className="grow">{v(vals[n], l)}</span></div>)}
    </div>
  );
}

function Mentions({ i, l }: { i: Infos; l: Lang }) {
  const t = {
    fr: {
      editeur: 'Éditeur du site et de l’application', createur: 'Conception et développement',
      createurTxt: `L’application LuxDrive (logiciel, design et code) est créée par ${CREATEUR}. © ${ANNEE} ${CREATEUR} — tous droits réservés. Toute reproduction, copie ou réutilisation, même partielle, est interdite sans autorisation écrite.`,
      contenus: 'Contenus', contenusTxt: `Le logo, les textes et les informations de l’auto-école sont la propriété de ${i.nom}. © ${ANNEE} ${i.nom}.`,
      hebergement: 'Hébergement',
      heb: ['Application : Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, États-Unis (cloudflare.com).', 'Données : Supabase (supabase.com), serveurs situés à Francfort (Union européenne).'],
      libres: 'Logiciels libres', libresTxt: 'LuxDrive utilise des composants libres (React, Supabase, polices Inter et Playfair Display…) sous leurs licences respectives (MIT, OFL…).', liste: 'Voir la liste et les licences',
    },
    en: {
      editeur: 'Publisher of the site and app', createur: 'Design and development',
      createurTxt: `The LuxDrive app (software, design and code) is created by ${CREATEUR}. © ${ANNEE} ${CREATEUR} — all rights reserved. Any reproduction, copy or reuse, even partial, is prohibited without written permission.`,
      contenus: 'Content', contenusTxt: `The driving school’s logo, texts and information belong to ${i.nom}. © ${ANNEE} ${i.nom}.`,
      hebergement: 'Hosting',
      heb: ['App: Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, USA (cloudflare.com).', 'Data: Supabase (supabase.com), servers in Frankfurt (European Union).'],
      libres: 'Open-source software', libresTxt: 'LuxDrive uses open-source components (React, Supabase, Inter and Playfair Display fonts…) under their own licences (MIT, OFL…).', liste: 'See the list and licences',
    },
    pt: {
      editeur: 'Editor do site e da aplicação', createur: 'Conceção e desenvolvimento',
      createurTxt: `A aplicação LuxDrive (software, design e código) foi criada por ${CREATEUR}. © ${ANNEE} ${CREATEUR} — todos os direitos reservados. É proibida qualquer reprodução, cópia ou reutilização, mesmo parcial, sem autorização escrita.`,
      contenus: 'Conteúdos', contenusTxt: `O logótipo, os textos e as informações da auto-escola pertencem a ${i.nom}. © ${ANNEE} ${i.nom}.`,
      hebergement: 'Alojamento',
      heb: ['Aplicação: Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, EUA (cloudflare.com).', 'Dados: Supabase (supabase.com), servidores em Frankfurt (União Europeia).'],
      libres: 'Software livre', libresTxt: 'A LuxDrive utiliza componentes livres (React, Supabase, tipos de letra Inter e Playfair Display…) sob as respetivas licenças (MIT, OFL…).', liste: 'Ver a lista e as licenças',
    },
  }[l];
  return <>
    <H>{t.editeur}</H><Identite i={i} l={l} />
    <H>{t.createur}</H><p>{t.createurTxt}</p>
    <H>{t.contenus}</H><p>{t.contenusTxt}</p>
    <H>{t.hebergement}</H>{t.heb.map(x => <p key={x}>{x}</p>)}
    <H>{t.libres}</H><p>{t.libresTxt} <a href="./licences.txt" target="_blank" rel="noreferrer">{t.liste}</a></p>
  </>;
}

function Conditions({ i, l }: { i: Infos; l: Lang }) {
  const h = i.delai_annulation_h;
  const insc = i.inscription.reduce((s, x) => s + Number(x.montant_ht) + Math.round(Number(x.montant_ht) * Number(x.taux_tva)) / 100, 0);
  const t = {
    fr: {
      s: ['1. Objet', '2. Compte', '3. Tarifs', '4. Paiement', '5. Réservation des leçons', '6. Annulation et absence', '7. Droit de rétractation', '8. Réclamations et litiges'],
      objet: `Les présentes conditions régissent l’inscription à ${i.nom}, l’utilisation de l’application LuxDrive et les prestations de formation à la conduite.`,
      compte: 'Le compte est personnel. Le mot de passe doit rester confidentiel ; toute action faite avec le compte est réputée faite par son titulaire.',
      tarifs: 'Prix TTC, TVA luxembourgeoise incluse :', inscription: 'Frais d’inscription', detail: 'Le détail HT / TVA figure sur chaque facture.',
      paiement: 'Paiement par Wero, virement bancaire ou en espèces à l’auto-école. Les heures sont ajoutées au solde dès réception du paiement.',
      resa: [`Une leçon ne peut être réservée qu’avec un solde d’heures suffisant, et au maximum ${i.max_lecons_semaine} leçons par semaine.`, `Toutes les leçons partent de l’auto-école (${v(i.adresse, l)}).`, 'L’élève doit avoir sur lui son certificat d’apprentissage à chaque leçon.', 'En conduite accompagnée, les règles légales s’appliquent (pas de conduite hors du Luxembourg ni entre 23 h et 6 h).'],
      annul: [`Annulation gratuite jusqu’à ${h} heures avant la leçon : l’heure est remise sur le solde.`, `À moins de ${h} heures, l’heure est due, sauf certificat médical accepté par l’auto-école.`, 'En cas d’absence sans annulation, l’heure est due.'],
      retract: 'Pour un achat effectué à distance, l’élève consommateur dispose de 14 jours pour se rétracter, en contactant l’auto-école. Les leçons déjà effectuées pendant ce délai, à sa demande, restent dues.',
      litiges: `Toute réclamation peut être adressée à ${i.nom} (${v(i.email, l)}). En cas de litige non résolu, le consommateur peut s’adresser au Médiateur de la consommation (mediateurconsommation.lu). Droit luxembourgeois applicable.`,
    },
    en: {
      s: ['1. Purpose', '2. Account', '3. Prices', '4. Payment', '5. Booking lessons', '6. Cancellation and no-show', '7. Right of withdrawal', '8. Complaints and disputes'],
      objet: `These terms govern registration with ${i.nom}, use of the LuxDrive app and driving lessons.`,
      compte: 'The account is personal. Keep your password confidential; any action taken with the account is deemed taken by its holder.',
      tarifs: 'Prices include Luxembourg VAT:', inscription: 'Registration fees', detail: 'Each invoice shows the amount excluding VAT and the VAT.',
      paiement: 'Payment by Wero, bank transfer or cash at the driving school. Hours are added to the balance once payment is received.',
      resa: [`A lesson can only be booked with enough hours in the balance, with at most ${i.max_lecons_semaine} lessons per week.`, `All lessons start at the driving school (${v(i.adresse, l)}).`, 'Students must carry their learner’s certificate at every lesson.', 'For accompanied driving, legal rules apply (no driving outside Luxembourg or between 11 pm and 6 am).'],
      annul: [`Free cancellation up to ${h} hours before the lesson: the hour goes back to the balance.`, `Less than ${h} hours before, the hour is due unless a medical certificate is accepted by the driving school.`, 'If the student does not show up without cancelling, the hour is due.'],
      retract: 'For purchases made at a distance, a consumer has 14 days to withdraw by contacting the driving school. Lessons already taken during that period at their request remain due.',
      litiges: `Complaints can be sent to ${i.nom} (${v(i.email, l)}). If a dispute is not resolved, the consumer may contact the Consumer Mediator (mediateurconsommation.lu). Luxembourg law applies.`,
    },
    pt: {
      s: ['1. Objeto', '2. Conta', '3. Preços', '4. Pagamento', '5. Reserva das aulas', '6. Cancelamento e falta', '7. Direito de livre resolução', '8. Reclamações e litígios'],
      objet: `Estas condições regem a inscrição na ${i.nom}, a utilização da aplicação LuxDrive e as aulas de condução.`,
      compte: 'A conta é pessoal. A palavra-passe deve ser mantida confidencial; qualquer ação feita com a conta considera-se feita pelo seu titular.',
      tarifs: 'Preços com IVA luxemburguês incluído:', inscription: 'Taxas de inscrição', detail: 'Cada fatura indica o valor sem IVA e o IVA.',
      paiement: 'Pagamento por Wero, transferência bancária ou numerário na auto-escola. As horas são adicionadas ao saldo após a receção do pagamento.',
      resa: [`Só é possível reservar uma aula com saldo de horas suficiente, com no máximo ${i.max_lecons_semaine} aulas por semana.`, `Todas as aulas partem da auto-escola (${v(i.adresse, l)}).`, 'O aluno deve levar o certificado de aprendizagem em todas as aulas.', 'Na condução acompanhada aplicam-se as regras legais (não conduzir fora do Luxemburgo nem entre as 23 h e as 6 h).'],
      annul: [`Cancelamento gratuito até ${h} horas antes da aula: a hora volta para o saldo.`, `Com menos de ${h} horas, a hora é devida, salvo atestado médico aceite pela auto-escola.`, 'Em caso de falta sem cancelamento, a hora é devida.'],
      retract: 'Numa compra à distância, o aluno consumidor dispõe de 14 dias para exercer o direito de livre resolução, contactando a auto-escola. As aulas já realizadas nesse período, a seu pedido, continuam devidas.',
      litiges: `As reclamações podem ser enviadas à ${i.nom} (${v(i.email, l)}). Em caso de litígio não resolvido, o consumidor pode recorrer ao Mediador do consumo (mediateurconsommation.lu). Aplica-se a lei luxemburguesa.`,
    },
  }[l];
  return <>
    <H>{t.s[0]}</H><p>{t.objet}</p>
    <H>{t.s[1]}</H><p>{t.compte}</p>
    <H>{t.s[2]}</H><p>{t.tarifs}</p>
    <div className="list">
      {i.formules.map(f => <div className="item small" key={f.nom}><span className="grow">{f.nom}</span><strong className="mono">{euro(f.prix_ttc, l)}</strong></div>)}
      <div className="item small"><span className="grow">{t.inscription}</span><strong className="mono">{euro(insc, l)}</strong></div>
    </div>
    <p className="small muted">{t.detail}</p>
    <H>{t.s[3]}</H><p>{t.paiement}</p>
    <H>{t.s[4]}</H><ul>{t.resa.map(x => <li key={x}>{x}</li>)}</ul>
    <H>{t.s[5]}</H><ul>{t.annul.map(x => <li key={x}>{x}</li>)}</ul>
    <H>{t.s[6]}</H><p>{t.retract}</p>
    <H>{t.s[7]}</H><p>{t.litiges}</p>
  </>;
}

function Confidentialite({ i, l }: { i: Infos; l: Lang }) {
  const t = {
    fr: {
      s: ['Responsable du traitement', 'Données collectées', 'Pourquoi', 'Qui y a accès', 'Durée de conservation', 'Sécurité', 'Vos droits', 'Cookies'],
      resp: `${i.nom}, ${v(i.adresse, l)} — contact : ${v(i.email, l)}.`,
      donnees: ['Identité et contact : nom, prénom, e-mail, téléphone, date de naissance, langue.', 'Formation : n° de certificat d’apprentissage, leçons, progression, examens, commentaires des moniteurs, signatures.', 'Facturation : factures et paiements (l’application ne stocke aucune donnée de carte ni code bancaire).', 'Certificats médicaux : uniquement si vous en envoyez un pour une annulation tardive ; seul le bureau le voit et le fichier est supprimé dès la décision.'],
      pourquoi: 'Organiser votre formation (planning, suivi, examens), facturer et encaisser, respecter nos obligations légales et comptables, et vous informer (rappels, notifications). Bases légales : l’exécution de votre contrat de formation, nos obligations légales et, pour le certificat médical, votre consentement donné au moment de l’envoi.',
      acces: `Le personnel de l’auto-école, selon son rôle (un moniteur ne voit que ses élèves et ses leçons ; un élève ne voit que ses propres données). Prestataires techniques : Supabase (base de données, Union européenne), Cloudflare (site), Stripe (paiements Wero, si utilisé), et ${CREATEUR} pour la maintenance de l’application. Vos données ne sont jamais vendues.`,
      duree: 'Pendant votre formation, puis le temps nécessaire à nos obligations légales (pièces comptables et factures : 10 ans). Les certificats médicaux sont effacés dès la décision.',
      secu: 'Connexion chiffrée (HTTPS), mots de passe chiffrés, accès limités selon le rôle, données hébergées dans l’Union européenne.',
      droits: `Vous pouvez demander l’accès, la rectification, l’effacement, la limitation ou la portabilité de vos données, ou vous opposer à un traitement, en écrivant à ${v(i.email, l)}. Vous pouvez aussi introduire une réclamation auprès de la CNPD (Commission nationale pour la protection des données, cnpd.lu).`,
      cookies: 'L’application n’utilise aucun cookie publicitaire ni de mesure d’audience. Elle garde seulement dans votre navigateur ce qui est nécessaire à votre connexion et à votre langue.',
    },
    en: {
      s: ['Data controller', 'Data collected', 'Why', 'Who can access it', 'Retention', 'Security', 'Your rights', 'Cookies'],
      resp: `${i.nom}, ${v(i.adresse, l)} — contact: ${v(i.email, l)}.`,
      donnees: ['Identity and contact: name, email, phone, date of birth, language.', 'Training: learner’s certificate number, lessons, progress, exams, instructor comments, signatures.', 'Billing: invoices and payments (the app stores no card data or bank codes).', 'Medical certificates: only if you send one for a late cancellation; only the office sees it and the file is deleted as soon as a decision is made.'],
      pourquoi: 'To organise your training (schedule, follow-up, exams), invoice and collect payments, meet our legal and accounting obligations, and keep you informed (reminders, notifications). Legal bases: performance of your training contract, our legal obligations and, for medical certificates, your consent given when sending it.',
      acces: `Driving school staff according to their role (an instructor only sees their students and lessons; a student only sees their own data). Technical providers: Supabase (database, European Union), Cloudflare (website), Stripe (Wero payments, if used), and ${CREATEUR} for maintaining the app. Your data is never sold.`,
      duree: 'During your training, then as long as required by our legal obligations (accounting records and invoices: 10 years). Medical certificates are deleted once a decision is made.',
      secu: 'Encrypted connection (HTTPS), encrypted passwords, role-based access, data hosted in the European Union.',
      droits: `You may request access to, correction, deletion, restriction or portability of your data, or object to processing, by writing to ${v(i.email, l)}. You may also lodge a complaint with the CNPD (Luxembourg data protection authority, cnpd.lu).`,
      cookies: 'The app uses no advertising or analytics cookies. It only keeps in your browser what is needed for your sign-in and language.',
    },
    pt: {
      s: ['Responsável pelo tratamento', 'Dados recolhidos', 'Para quê', 'Quem tem acesso', 'Prazo de conservação', 'Segurança', 'Os seus direitos', 'Cookies'],
      resp: `${i.nom}, ${v(i.adresse, l)} — contacto: ${v(i.email, l)}.`,
      donnees: ['Identidade e contacto: nome, e-mail, telefone, data de nascimento, idioma.', 'Formação: n.º do certificado de aprendizagem, aulas, progresso, exames, comentários dos instrutores, assinaturas.', 'Faturação: faturas e pagamentos (a aplicação não guarda dados de cartão nem códigos bancários).', 'Atestados médicos: só se enviar um para um cancelamento tardio; só o escritório o vê e o ficheiro é apagado logo após a decisão.'],
      pourquoi: 'Organizar a sua formação (horários, acompanhamento, exames), faturar e receber pagamentos, cumprir as nossas obrigações legais e contabilísticas e mantê-lo informado (lembretes, notificações). Fundamentos: execução do contrato de formação, obrigações legais e, para o atestado médico, o seu consentimento dado no envio.',
      acces: `O pessoal da auto-escola, conforme a função (um instrutor só vê os seus alunos e aulas; um aluno só vê os seus próprios dados). Prestadores técnicos: Supabase (base de dados, União Europeia), Cloudflare (site), Stripe (pagamentos Wero, se utilizado) e ${CREATEUR} para a manutenção da aplicação. Os seus dados nunca são vendidos.`,
      duree: 'Durante a sua formação e depois pelo tempo exigido pelas nossas obrigações legais (documentos contabilísticos e faturas: 10 anos). Os atestados médicos são apagados logo após a decisão.',
      secu: 'Ligação cifrada (HTTPS), palavras-passe cifradas, acessos limitados por função, dados alojados na União Europeia.',
      droits: `Pode pedir o acesso, a retificação, o apagamento, a limitação ou a portabilidade dos seus dados, ou opor-se a um tratamento, escrevendo para ${v(i.email, l)}. Pode também apresentar queixa à CNPD (Comissão Nacional de Proteção de Dados do Luxemburgo, cnpd.lu).`,
      cookies: 'A aplicação não utiliza cookies de publicidade nem de medição de audiência. Guarda apenas no seu navegador o necessário para a sessão e o idioma.',
    },
  }[l];
  return <>
    <H>{t.s[0]}</H><p>{t.resp}</p>
    <H>{t.s[1]}</H><ul>{t.donnees.map(x => <li key={x}>{x}</li>)}</ul>
    <H>{t.s[2]}</H><p>{t.pourquoi}</p>
    <H>{t.s[3]}</H><p>{t.acces}</p>
    <H>{t.s[4]}</H><p>{t.duree}</p>
    <H>{t.s[5]}</H><p>{t.secu}</p>
    <H>{t.s[6]}</H><p>{t.droits}</p>
    <H>{t.s[7]}</H><p>{t.cookies}</p>
  </>;
}
