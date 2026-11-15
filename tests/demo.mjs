// End-to-end test of the demo build (real schema running in the browser).
import { chromium } from '@playwright/test';

const URL = process.env.URL || 'http://localhost:4173/?memoire';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 400, height: 860 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/fonts|favicon/.test(m.text())) errors.push('console: ' + m.text()); });

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };
const shot = (n) => page.screenshot({ path: `tests/shots/${n}.png`, fullPage: true });
const toast = async () => (await page.locator('.toast').first().textContent({ timeout: 8000 }).catch(() => '')) ?? '';
const nav = (n) => page.locator('.bottomnav').getByRole('link', { name: n, exact: true }).click();
const seeToast = (txt) => page.locator('.toast', { hasText: txt }).waitFor({ timeout: 20000 }).then(() => true, () => false);
const vis = (loc) => loc.waitFor({ timeout: 15000 }).then(() => true, () => false);
const login = async (label) => {
  if (await page.locator('.demo-bar').count()) await page.getByRole('button', { name: 'Changer de compte' }).click();
  await page.getByRole('button', { name: new RegExp(label) }).click();
  await page.locator('.bottomnav').waitFor({ timeout: 20000 });
};

await page.goto(URL);
await page.getByText('Mode démonstration').waitFor({ timeout: 60000 });
console.log('\nConnexion');
ok(await vis(page.getByRole('button', { name: /Ana Silva/ })), 'Écran de connexion démo');
await page.getByRole('button', { name: 'PT', exact: true }).click();
ok(await vis(page.getByText('Modo de demonstração')), 'Bascule en portugais');
await page.getByRole('button', { name: 'EN', exact: true }).click();
ok(await vis(page.getByText('Demo mode')), 'Bascule en anglais');
ok(await page.getByRole('button', { name: 'DE', exact: true }).count() === 0, "Pas d'allemand");
await page.getByRole('button', { name: 'FR', exact: true }).click();
await shot('01-login');

console.log('\nÉlève (Ana)');
await login('Ana Silva');
await page.getByTestId('solde').waitFor();
ok((await page.getByTestId('solde').textContent()).includes('4 h'), 'Solde 4 h');
ok(await vis(page.getByText('Lieu de départ')), "Lieu de départ : auto-école");
ok(await vis(page.getByText('5 place des Alliés, L-4508 Differdange').first()), 'Adresse affichée');
await shot('02-eleve-accueil');

await nav('Réserver');
await page.locator('.slot').first().waitFor({ timeout: 15000 });
await shot('03-reserver');
await page.locator('.slot:not([disabled])').first().click();
ok(await vis(page.getByText('1 h sera déduite')), 'Confirmation avec règle des 48 h');
await page.getByRole('button', { name: 'Confirmer' }).click();
ok(await seeToast('Leçon réservée'), 'Leçon réservée');
await page.getByText('À venir (3)').waitFor({ timeout: 10000 });
ok(true, '3 leçons à venir');

// Free cancellation of the furthest lesson
const cards = page.getByTestId('lecon');
await cards.last().getByRole('button', { name: 'Annuler la leçon' }).click();
ok(await vis(page.getByText('Annulation gratuite').first()), 'Annulation gratuite proposée (> 48 h)');
await page.locator('.sheet').getByRole('button', { name: 'Confirmer' }).click();
await page.getByText('À venir (2)').waitFor({ timeout: 10000 });
ok(true, 'Leçon annulée');
await page.getByRole('button', { name: 'Passées' }).click();
ok(await vis(page.getByText('Certificat envoyé, en cours de vérification')), 'Certificat en attente visible');
await shot('04-mes-lecons');

await nav('Paiements');
await page.getByTestId('formule-f4').click();
await page.getByRole('button', { name: /^Wero/ }).click();
ok(await seeToast('4 h ajoutées'), 'Paiement Wero (démo) : 4 h créditées');
await page.getByTestId('formule-f8').click();
await page.getByRole('button', { name: /^Virement bancaire/ }).click();
await page.getByTestId('qr').waitFor({ timeout: 8000 });
ok(await vis(page.getByText('LU28 0019 4006 4475 0000')), 'IBAN et QR code de virement');
await shot('05-virement');
await page.getByRole('button', { name: 'OK' }).click();
await nav('Accueil');
await page.getByTestId('solde').waitFor();
ok((await page.getByTestId('solde').textContent()).includes('8 h'), 'Solde 8 h (virement pas encore reçu)');

console.log('\nMoniteur (Marc)');
await login('Marc Weber');
await page.getByText('Lucas Muller').first().waitFor({ timeout: 10000 });
await shot('06-moniteur-jour');
await page.getByText('Lucas Muller').first().click();
await page.getByRole('button', { name: 'Ronds-points' }).click();
await page.getByRole('textbox').fill('Bonne leçon, insertion à revoir.');
ok(await page.getByRole('button', { name: 'Valider la leçon' }).isDisabled(), 'Validation impossible sans signature');
const box = await page.getByTestId('signature').boundingBox();
await page.mouse.move(box.x + 20, box.y + 80); await page.mouse.down();
for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 20 + i * 20, box.y + 80 + (i % 2 ? -30 : 30));
await page.mouse.up();
await shot('07-lecon-signature');
await page.getByRole('button', { name: 'Valider la leçon' }).click();
ok(await seeToast('Leçon validée'), 'Leçon validée avec signature');
await nav('Théorie');
await page.getByText('Priorités et signalisation').click();
await page.locator('.sheet .check').first().click();
await page.locator('.sheet').getByRole('button', { name: 'Enregistrer' }).click();
ok(await seeToast('Présences enregistrées'), 'Théorie pointée');

console.log('\nBureau (Sara)');
await page.setViewportSize({ width: 1200, height: 900 });
await login('Sara Mendes');
await page.getByText('Certificats à vérifier').first().waitFor();
await shot('08-bureau-accueil');
await nav('Certificats');
await page.getByRole('button', { name: 'Voir le certificat' }).click();
ok(await vis(page.locator('.sheet img[alt=certificat]')), 'Certificat consultable');
await page.locator('.sheet').getByRole('button', { name: 'Fermer' }).click();
await page.getByRole('button', { name: 'Accepter' }).click();
ok(await seeToast('Certificat accepté'), 'Certificat accepté');

await nav('Factures');
await page.getByRole('button', { name: /Ana Silva.*Forfait 8/ }).click();
await page.locator('.sheet').getByRole('button', { name: 'Virement bancaire' }).click();
await page.locator('.sheet').getByRole('button', { name: 'Encaisser' }).click();
ok(await seeToast('Encaissé'), 'Virement reçu encaissé');
await shot('09-factures');

await nav('Élèves');
await page.getByRole('link', { name: /Ana Silva/ }).click();
await page.getByTestId('fiche-solde').waitFor();
const fs = await page.getByTestId('fiche-solde').textContent();
ok(fs.includes('17 h'), `Fiche Ana : ${fs} (8 + 8 virement reçu + 1 certificat accepté)`);
await shot('10-fiche-eleve');

await nav('Agenda');
await page.getByRole('button', { name: 'Planifier une leçon' }).click();
await page.getByTestId('planifier-eleve').selectOption({ label: /Lucas/ }).catch(async () => {
  const v = await page.getByTestId('planifier-eleve').locator('option', { hasText: 'Lucas' }).getAttribute('value');
  await page.getByTestId('planifier-eleve').selectOption(v);
});
const d = new Date(); d.setDate(d.getDate() + (d.getDay() >= 5 ? 8 - d.getDay() : 1));
await page.locator('.sheet input[type=date]').fill(d.toISOString().slice(0, 10));
await page.locator('.sheet .slot').first().waitFor({ timeout: 10000 }).catch(() => {});
const nSlots = await page.locator('.sheet .slot').count();
ok(nSlots > 0, `Planification par le bureau : ${nSlots} créneaux`);
await page.keyboard.press('Escape');

await nav('Élèves');
await page.getByRole('button', { name: 'Nouvel élève' }).click();
await page.locator('.sheet input').nth(0).fill('João');
await page.locator('.sheet input').nth(1).fill('Pereira');
await page.locator('.sheet input[type=email]').fill('joao@demo.lu');
await page.locator('.sheet').getByRole('button', { name: 'Créer' }).click();
await page.getByTestId('fiche-solde').waitFor({ timeout: 10000 });
ok(await vis(page.getByRole('heading', { name: 'João Pereira' })), 'Nouvel élève créé');
await page.getByRole('button', { name: /Facture d’inscription/ }).click();
await page.locator('.sheet').getByText('295,00').last().waitFor({ timeout: 8000 });
ok(true, 'Facture d’inscription 295,00 €');
await shot('11-facture-inscription');
await page.keyboard.press('Escape');

console.log('\nGérante (Carla)');
await login('Carla Lisboa');
await nav('Réglages');
await page.getByLabel('unite').fill('90');
await page.getByRole('button', { name: 'Enregistrer' }).first().click();
ok(await seeToast('Enregistré'), 'Prix modifié par la gérante');
await shot('12-reglages');
await login('Sara Mendes');
await nav('Réglages');
ok(await vis(page.getByText('Seul le gérant peut modifier')), 'Secrétariat : réglages en lecture seule');

console.log('\nErreurs JavaScript :', errors.length ? errors : 'aucune');
ok(errors.length === 0, 'Aucune erreur dans la console');
console.log(`\n${pass} réussis, ${fail} échoués`);
await browser.close();
process.exit(fail ? 1 : 0);
