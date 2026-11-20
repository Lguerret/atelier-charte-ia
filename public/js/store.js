// État partagé côté navigateur + connexion temps réel
import { useState, useEffect } from '/vendor/preact-htm.js';
import { SPACE_MAP } from './config.js';

export const store = {
  conn: 'connecting',  // connecting | online | offline
  joining: false,
  joined: false,
  session: null,       // état de la session envoyé par le serveur
  me: null,            // { uid, name, isAdmin, mine, votes, polls }
  error: null,
  toasts: [],
  config: { requirePassword: false, retentionDays: 30 },
};
const listeners = new Set();
export function setStore(patch) {
  Object.assign(store, patch);
  listeners.forEach((l) => l());
}
export function useStore() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    l(); // rattrape les mises à jour arrivées avant l'abonnement
    return () => listeners.delete(l);
  }, []);
  return store;
}

// ---- stockage local (identité de l'appareil, uniquement dans ce navigateur)
export const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* navigation privée */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
export const identKey = (code) => 'charteia:id:' + code;

// ---- notifications
let toastSeq = 0;
export function toast(text, kind = 'info') {
  const id = ++toastSeq;
  setStore({ toasts: [...store.toasts, { id, text, kind }] });
  setTimeout(() => setStore({ toasts: store.toasts.filter((t) => t.id !== id) }), kind === 'warn' ? 6000 : 3500);
}

// ---- navigation (hash)
export function parseRoute() {
  const [a, b] = location.hash.replace(/^#\/?/, '').split('/');
  if (a === 'espace' && SPACE_MAP[b]) return { view: 'space', space: b };
  if (['animer', 'projection', 'synthese', 'formateur'].includes(a)) return { view: a };
  return { view: 'space', space: 'accueil' };
}
export function useRoute() {
  const [route, setRoute] = useState(parseRoute());
  useEffect(() => {
    const h = () => { setRoute(parseRoute()); window.scrollTo(0, 0); };
    addEventListener('hashchange', h);
    return () => removeEventListener('hashchange', h);
  }, []);
  return route;
}
export const go = (hash) => { location.hash = hash; };
export const spaceHash = (id) => (id === 'synthese' ? '#/synthese' : id === 'accueil' ? '#/' : `#/espace/${id}`);

// ---- connexion Socket.IO
// eslint-disable-next-line no-undef
export const socket = io({ reconnectionDelayMax: 4000 });
let joinParams = null;
let lastFocusAt = null;

socket.on('connect', () => {
  setStore({ conn: 'online' });
  if (joinParams) doJoin(joinParams, true);
});
socket.on('disconnect', () => setStore({ conn: 'offline' }));
socket.io.on('reconnect_attempt', () => setStore({ conn: 'offline' }));
socket.on('state', ({ state, me }) => onState(state, me));
socket.on('session-deleted', () => {
  if (store.session) LS.del(identKey(store.session.code));
  joinParams = null;
  setStore({ joined: false, session: null, me: null, error: 'Cette session a été clôturée par le formateur.' });
  history.replaceState(null, '', location.pathname);
});

function onState(state, me) {
  const first = !store.session;
  setStore({ session: state, me });
  const { focus, focusAt } = state.live;
  if (!me.isAdmin && focus && focusAt !== lastFocusAt) {
    const route = parseRoute();
    const here = route.view === 'space' ? route.space : route.view;
    if (lastFocusAt !== null || (first && here === 'accueil')) {
      if (here !== focus && route.view !== 'projection') {
        go(spaceHash(focus));
        const label = focus === 'synthese' ? 'Synthèse' : SPACE_MAP[focus]?.title;
        if (lastFocusAt !== null) toast(`Le formateur vous invite sur « ${label} »`, 'info');
      }
    }
  }
  lastFocusAt = focusAt;
}

export function doJoin(params, silent = false) {
  if (!silent) setStore({ joining: true, error: null });
  return new Promise((resolve) => {
    socket.timeout(10000).emit('join', params, (err, res) => {
      setStore({ joining: false });
      if (err || !res?.ok) {
        if (!silent || res) {
          joinParams = null;
          setStore({ joined: false, session: null, error: err ? 'Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.' : res.error });
        }
        resolve(false);
        return;
      }
      const prev = LS.get(identKey(params.code)) || {};
      joinParams = { code: params.code, pid: res.pid, name: res.name, adminKey: params.adminKey };
      LS.set(identKey(params.code), { ...prev, pid: res.pid, name: res.name, adminKey: params.adminKey || prev.adminKey });
      setStore({ joined: true, error: null });
      const url = new URL(location.href);
      if (url.searchParams.get('s') !== params.code) {
        url.searchParams.set('s', params.code);
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
      resolve(true);
    });
  });
}

export function leaveSession() {
  joinParams = null;
  lastFocusAt = null;
  socket.disconnect().connect();
  setStore({ joined: false, session: null, me: null });
  history.replaceState(null, '', location.pathname);
  location.hash = '';
}

export function createSession({ title, name, password }) {
  return new Promise((resolve) => {
    socket.timeout(10000).emit('create', { title, password }, async (err, res) => {
      if (err || !res?.ok) {
        toast(err ? 'Le serveur ne répond pas.' : res.error, 'warn');
        resolve(false);
        return;
      }
      LS.set(identKey(res.code), { adminKey: res.adminKey, name });
      const list = LS.get('charteia:admin-sessions') || [];
      LS.set('charteia:admin-sessions', [{ code: res.code, title, createdAt: Date.now() }, ...list].slice(0, 10));
      const ok = await doJoin({ code: res.code, name, adminKey: res.adminKey });
      if (ok) go('#/animer');
      resolve(ok);
    });
  });
}

// Restaure une session à partir du fichier « Sauvegarde complète (JSON) »
export async function restoreSession({ file, name, password }) {
  let backup;
  try { backup = JSON.parse(await file.text()); } catch { toast('Ce fichier n\'est pas une sauvegarde lisible (.json).', 'warn'); return false; }
  const code = String(backup?.code || '').toUpperCase();
  const prev = LS.get(identKey(code)) || {};
  let res;
  try {
    const r = await fetch('/api/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup, password, adminKey: prev.adminKey }),
    });
    res = await r.json();
  } catch { toast('Le serveur ne répond pas, réessayez dans un instant.', 'warn'); return false; }
  if (!res?.ok) { toast(res?.error || 'Restauration impossible.', 'warn'); return false; }
  LS.set(identKey(res.code), { adminKey: res.adminKey, name });
  const list = (LS.get('charteia:admin-sessions') || []).filter((x) => x.code !== res.code);
  LS.set('charteia:admin-sessions', [{ code: res.code, title: res.title, createdAt: backup.createdAt || Date.now() }, ...list].slice(0, 10));
  toast(`Session ${res.code} restaurée (${res.contributions} contributions).`, 'ok');
  const ok = await doJoin({ code: res.code, name, adminKey: res.adminKey });
  if (ok) go('#/animer');
  return ok;
}

// Envoie une action au serveur ; renvoie la réponse, ou null en cas d'erreur (message affiché)
export function send(type, payload = {}) {
  if (!socket.connected) {
    toast('Connexion en cours de rétablissement… Votre texte est conservé, réessayez dans un instant.', 'warn');
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    socket.timeout(8000).emit('op', { type, ...payload }, (err, res) => {
      if (err) { toast('Le serveur ne répond pas, réessayez.', 'warn'); resolve(null); }
      else if (!res?.ok) { toast(res?.error || 'Erreur.', 'warn'); resolve(null); }
      else resolve(res);
    });
  });
}
