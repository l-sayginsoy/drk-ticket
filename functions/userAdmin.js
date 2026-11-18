const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp, getApps, getApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

// Benannte Datenbank der App (siehe firebase.json / firebase-applet-config.json)
const DB_ID = 'ai-studio-e01f0d33-f3e7-4c71-8027-b8f472b6f9ef';
const ROLES = ['admin', 'techniker', 'hauswirtschaft'];
const ALWAYS_ADMIN = ['carlo', 'levent'];   // immer Administratoren (Regel von Levent)

// MUSS identisch sein mit utils/loginName.ts und scripts/lib/live.mjs
const loginEmailFor = (name) => `${String(name).trim().toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '')}@haustechnik.local`;

const app = () => (getApps().length ? getApp() : initializeApp());

/**
 * Benutzerverwaltung für Admins (Passwörter kann ein Browser nicht für andere setzen).
 * Aufruf: httpsCallable(functions, 'adminManageUser')({ action, userId, ... })
 *   create       { userId, name, role, password }   Konto + Rollenprofil users/{uid} anlegen
 *   setPassword  { userId, password }               neues Passwort (mind. 6 Zeichen)
 *   update       { userId, name?, role?, active? }  Name (→ Anmeldeadresse), Rolle, gesperrt/aktiv
 *   delete       { userId }                         Konto und Profil löschen
 * Nur Admins (Profil users/{uid}.role == 'admin', aktiv). Carlo und Levent bleiben immer aktive Admins und sind nicht löschbar.
 * Passwörter werden nie geloggt und nie gespeichert (nur von Firebase Auth gehasht).
 */
exports.adminManageUser = onCall({ region: 'europe-west3', cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Bitte anmelden.');
  const db = getFirestore(app(), DB_ID);
  const auth = getAuth(app());

  const me = await db.doc(`users/${request.auth.uid}`).get();
  if (!me.exists || me.data().role !== 'admin' || me.data().active === false) {
    throw new HttpsError('permission-denied', 'Nur Administratoren dürfen Benutzer verwalten.');
  }

  const d = request.data || {};
  const action = String(d.action || '');
  const userId = String(d.userId || '').trim();
  if (!userId) throw new HttpsError('invalid-argument', 'userId fehlt.');
  const checkPw = (pw) => {
    if (typeof pw !== 'string' || pw.length < 6) throw new HttpsError('invalid-argument', 'Das Passwort muss mindestens 6 Zeichen lang sein.');
    if (pw !== pw.trim()) throw new HttpsError('invalid-argument', 'Das Passwort darf nicht mit einem Leerzeichen beginnen oder enden.');
  };
  const findProfile = async () => {
    const q = await db.collection('users').where('userId', '==', userId).limit(1).get();
    return q.empty ? null : q.docs[0];
  };
  const isProtected = (name) => ALWAYS_ADMIN.includes(String(name || '').trim().toLowerCase());

  if (action === 'create') {
    const name = String(d.name || '').trim();
    const role = String(d.role || '');
    if (!name) throw new HttpsError('invalid-argument', 'Name fehlt.');
    if (!ROLES.includes(role)) throw new HttpsError('invalid-argument', 'Unbekannte Rolle.');
    checkPw(d.password);
    if (await findProfile()) throw new HttpsError('already-exists', 'Für diese Person gibt es schon ein Konto.');
    const email = loginEmailFor(name);
    let user;
    try {
      user = await auth.createUser({ email, password: d.password, displayName: name });
    } catch (e) {
      if (e.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'Dieser Anmeldename ist schon vergeben.');
      console.error('createUser fehlgeschlagen:', e.code);
      throw new HttpsError('internal', 'Konto konnte nicht angelegt werden.');
    }
    await db.doc(`users/${user.uid}`).set({
      role: isProtected(name) ? 'admin' : role, name, userId, active: true, loginEmail: email,
      createdAt: new Date().toISOString(), createdBy: request.auth.uid,
    });
    return { ok: true };
  }

  const profile = await findProfile();
  if (!profile) throw new HttpsError('not-found', 'Für diese Person gibt es noch kein Anmelde-Konto.');
  const uid = profile.id;
  const cur = profile.data();

  if (action === 'setPassword') {
    checkPw(d.password);
    await auth.updateUser(uid, { password: d.password });
    await auth.revokeRefreshTokens(uid);   // alte Sitzungen müssen sich neu anmelden
    return { ok: true };
  }

  if (action === 'update') {
    const patch = {};
    const authPatch = {};
    if (d.name !== undefined) {
      const name = String(d.name).trim();
      if (!name) throw new HttpsError('invalid-argument', 'Name fehlt.');
      if (isProtected(cur.name) && name.toLowerCase() !== String(cur.name).toLowerCase()) throw new HttpsError('failed-precondition', 'Dieser Name ist fest vergeben.');
      patch.name = name; patch.loginEmail = loginEmailFor(name);
      authPatch.email = patch.loginEmail; authPatch.displayName = name;
    }
    if (d.role !== undefined) {
      if (!ROLES.includes(d.role)) throw new HttpsError('invalid-argument', 'Unbekannte Rolle.');
      if (isProtected(cur.name) && d.role !== 'admin') throw new HttpsError('failed-precondition', 'Carlo und Levent sind immer Administratoren.');
      patch.role = d.role;
    }
    if (d.active !== undefined) {
      if (isProtected(cur.name) && d.active === false) throw new HttpsError('failed-precondition', 'Carlo und Levent können nicht gesperrt werden.');
      patch.active = !!d.active; authPatch.disabled = !d.active;
    }
    // Der letzte aktive Admin darf weder herabgestuft noch gesperrt werden.
    const losesAdmin = cur.role === 'admin' && ((patch.role && patch.role !== 'admin') || patch.active === false);
    if (losesAdmin) {
      const admins = await db.collection('users').where('role', '==', 'admin').get();
      const others = admins.docs.filter((x) => x.id !== uid && x.data().active !== false);
      if (!others.length) throw new HttpsError('failed-precondition', 'Es muss mindestens ein aktiver Administrator bleiben.');
    }
    if (Object.keys(authPatch).length) {
      try { await auth.updateUser(uid, authPatch); }
      catch (e) {
        if (e.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'Dieser Anmeldename ist schon vergeben.');
        console.error('updateUser fehlgeschlagen:', e.code);
        throw new HttpsError('internal', 'Konto konnte nicht geändert werden.');
      }
      if (authPatch.disabled) await auth.revokeRefreshTokens(uid);
    }
    if (Object.keys(patch).length) await profile.ref.update(patch);
    return { ok: true };
  }

  if (action === 'delete') {
    if (isProtected(cur.name)) throw new HttpsError('failed-precondition', 'Carlo und Levent können nicht gelöscht werden.');
    if (cur.role === 'admin') {
      const admins = await db.collection('users').where('role', '==', 'admin').get();
      if (!admins.docs.some((x) => x.id !== uid && x.data().active !== false)) throw new HttpsError('failed-precondition', 'Es muss mindestens ein aktiver Administrator bleiben.');
    }
    try { await auth.deleteUser(uid); } catch (e) { if (e.code !== 'auth/user-not-found') throw new HttpsError('internal', 'Konto konnte nicht gelöscht werden.'); }
    await profile.ref.delete();
    return { ok: true };
  }

  throw new HttpsError('invalid-argument', 'Unbekannte Aktion.');
});
