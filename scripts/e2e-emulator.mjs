// Ende-zu-Ende-Test im Browser gegen die LOKALEN Emulatoren (nie Live):
//   1) Emulatoren starten (firebase emulators:start --config firebase.emulators.json --project drk-facility-dashboard)
//   2) node scripts/seed-emulator.mjs --emulator && MIGRATION_TEST_PASSWORD=Test-1234 node scripts/migrate-auth.mjs konten --emulator
//   3) VITE_USE_EMULATORS=1 npx vite --port 5190 --strictPort --open false   (anderes Terminal)
//   4) node scripts/e2e-emulator.mjs
import puppeteer from 'puppeteer';
process.argv.push('--emulator');
const { getDocRaw } = await import('./lib/live.mjs');
const URL_ = process.env.E2E_URL || 'http://localhost:5190';
const PW = 'Test-1234';
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond, name, extra]); console.log(`${cond ? '✔' : '✘'} ${name}${extra ? ' – ' + extra : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const newPage = async () => {
  const p = await browser.newPage();
  await p.setViewport({ width: 1400, height: 900 });
  p.on('pageerror', e => console.log('  [pageerror]', e.message.slice(0, 160)));
  return p;
};
const clickText = async (page, sel, text) => {
  const h = await page.evaluateHandle((s, t) => [...document.querySelectorAll(s)].find(e => e.textContent.includes(t)), sel, text);
  const el = h.asElement();
  if (!el) throw new Error(`nicht gefunden: ${text}`);
  await el.click();
};
const waitText = async (page, text, ms = 15000) => { await page.waitForFunction(t => document.body.innerText.includes(t), { timeout: ms }, text); };

try {
  // ---------- 1) Melder (anonym) ----------
  const melder = await newPage();
  await melder.goto(URL_, { waitUntil: 'networkidle2' });
  await waitText(melder, 'Meldung erfassen');
  ok('Portal lädt ohne Anmeldung', true);
  await clickText(melder, 'button', 'Meldung erfassen');
  await melder.waitForSelector('select');
  const options = await melder.$$eval('select option', os => os.map(o => o.textContent));
  ok('Standorte kommen aus dem öffentlichen Dokument', options.includes('Schlosspark') && options.includes('Küche'));
  ok('Kategorien kommen aus dem öffentlichen Dokument', options.includes('Haustechnik'));
  const selects = await melder.$$('select');
  await selects[0].select('Schlosspark');
  await melder.type('input[placeholder="z.B. Zimmer 100"]', 'Raum 7');
  await melder.type('input[placeholder="Worum geht es?"]', 'Wasserhahn tropft');
  await melder.type('textarea', 'Der Wasserhahn im Bad tropft seit gestern.');
  const textInputs = await melder.$$('input[type="text"]');
  await textInputs[textInputs.length - 1].type('Erika Musterfrau');
  await melder.type('input[type="email"]', 'erika@example.org');
  await clickText(melder, 'button', 'Meldung senden');
  await sleep(4000);
  const body = await melder.evaluate(() => document.body.innerText);
  const idMatch = body.match(/\b(3\d{4})\b/);
  ok('Meldung angelegt, Ticketnummer sichtbar', !!idMatch, idMatch ? idMatch[1] : body.slice(0, 200).replace(/\n/g, ' '));
  const id = idMatch && idMatch[1];
  const raw = id ? await getDocRaw(`tickets/${id}`) : null;
  ok('Ticket ohne Zuweisung gespeichert, Übernahme ausstehend', !!raw && raw.data.portalIntakePending === true && raw.data.technician === 'N/A');

  // Status prüfen + Nachricht
  const status = await newPage();
  status.on('console', m => { if (m.type() === 'error') console.log('  [status console]', m.text().slice(0, 220)); });
  await status.goto(URL_, { waitUntil: 'networkidle2' });
  await waitText(status, 'Status prüfen');
  await clickText(status, 'button', 'Status prüfen');
  await status.waitForSelector('input[placeholder^="Beispiel"]');
  await status.type('input[placeholder^="Beispiel"]', id);
  await clickText(status, 'button', 'Status prüfen');
  await waitText(status, 'Wasserhahn tropft', 15000);
  ok('Status per Ticketnummer abrufbar (ohne Anmeldung)', true);
  const ta = await status.$('textarea');
  if (ta) {
    await ta.type('Ergänzung: auch im Keller feucht.');
    const btnTexts = await status.$$eval('button', bs => bs.map(b => b.textContent.trim()));
    const sendBtn = btnTexts.find(t => /senden|absenden|hinzufügen/i.test(t));
    await clickText(status, 'button', sendBtn);
    await sleep(2500);
    const after = await getDocRaw(`tickets/${id}`);
    ok('Melder-Nachricht angehängt', (after.data.notes || []).some(n => n.includes('Ergänzung')), `Notizen: ${(after.data.notes || []).length}`);
  } else {
    ok('Nachrichtenfeld vorhanden', false);
  }

  const ls = await melder.evaluate(() => ({ t: localStorage.getItem('facility-management-tickets'), u: localStorage.getItem('facility-management-users'), c: localStorage.getItem('currentUser') }));
  ok('Kein Zwischenspeicher mit Tickets/Benutzern im Melder-Browser', !(ls.u || '').includes('Heiko') && !(ls.t || '').includes('Heizung') && !ls.c);

  // ---------- 2) falsche Anmeldung ----------
  const staff = await newPage();
  await staff.goto(URL_, { waitUntil: 'networkidle2' });
  await waitText(staff, 'anmelden');
  await clickText(staff, 'button', 'Service-Team & Admin anmelden');
  await clickText(staff, 'button', 'Anmeldung Service-Team');
  await staff.waitForSelector('select');
  const names = await staff.$$eval('select option', os => os.map(o => o.textContent.trim()));
  ok('Anmeldeliste zeigt nur Service-Team (kein Admin)', names.includes('Heiko Saupert') && names.includes('Jessica Geibel') && !names.includes('Carlo') && !names.includes('admin'), names.join('|'));
  await (await staff.$('select')).select('Heiko Saupert');
  await staff.type('input[type="password"]', 'falsches-Passwort');
  await clickText(staff, 'button[type="submit"]', 'Anmelden');
  await waitText(staff, 'ungültig');
  ok('Falsches Passwort wird abgelehnt', true);

  // ---------- 3) Techniker richtig ----------
  await staff.click('input[type="password"]', { clickCount: 3 });
  await staff.type('input[type="password"]', PW);
  await clickText(staff, 'button[type="submit"]', 'Anmelden');
  await staff.waitForFunction(() => !document.body.innerText.includes('Anmeldung Service-Team'), { timeout: 20000 });
  await sleep(5000);
  const intake = await getDocRaw(`tickets/${id}`);
  ok('Mitarbeiter-Browser hat die Meldung übernommen (Zuweisung per Regel)', intake.data.portalIntakePending === undefined && intake.data.technician === 'Heiko Saupert' && intake.data.priority === 'Hoch', `technician=${intake.data.technician}, Prio=${intake.data.priority}, pending=${intake.data.portalIntakePending}`);
  const txt = await staff.evaluate(() => document.body.innerText);
  ok('Techniker sieht sein Dashboard mit Tickets', txt.includes('Wasserhahn tropft') || txt.includes('Heizung kalt'));
  const lsStaff = await staff.evaluate(() => ({ u: localStorage.getItem('facility-management-users') || '', c: localStorage.getItem('currentUser') }));
  ok('Kein Klartext-Passwort im Browser-Speicher', !/password/i.test(lsStaff.u) && !lsStaff.c);

  await clickText(staff, 'button, .nav-item', 'Abmelden');
  await waitText(staff, 'Meldung erfassen', 15000);
  await sleep(800);
  const lsAfter = await staff.evaluate(() => localStorage.getItem('facility-management-tickets'));
  ok('Nach Abmeldung: Zwischenspeicher geleert, Portal sichtbar', !lsAfter || lsAfter === '[]' || lsAfter === 'null', `Länge ${lsAfter ? lsAfter.length : 0}`);

  // ---------- 4) Admin (Carlo) ----------
  await clickText(staff, 'button', 'Service-Team & Admin anmelden');
  await clickText(staff, 'button', 'Admin Anmeldung');
  await staff.waitForSelector('input[type="text"]');
  await staff.type('input[type="text"]', 'carlo');
  await staff.type('input[type="password"]', PW);
  await clickText(staff, 'button[type="submit"]', 'Anmelden');
  await staff.waitForFunction(() => document.body.innerText.includes('Einstellungen'), { timeout: 20000 });
  ok('Admin (Carlo) angemeldet, Einstellungen sichtbar', true);
  await sleep(2500);
  await clickText(staff, '.nav-item, button, a', 'Einstellungen');
  await sleep(1000);
  await clickText(staff, 'button', 'Benutzer');
  await waitText(staff, 'Heiko Saupert');
  const adminText = await staff.evaluate(() => document.body.innerText);
  ok('Benutzerliste zeigt Levent (immer Admin)', adminText.includes('Levent'));
} catch (e) {
  ok('Testlauf ohne Ausnahme', false, e.message);
} finally {
  await browser.close();
}
const failed = results.filter(r => !r[0]).length;
console.log(`\n${results.length - failed}/${results.length} Prüfungen bestanden.`);
process.exit(failed ? 1 : 0);
