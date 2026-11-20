// Atelier Charte IA — serveur temps réel (Express + Socket.IO)
// Un seul processus, état en mémoire, sauvegarde périodique dans un fichier JSON.

import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPACES, SPACE_MAP, VOTE_SETS, DEFAULT_QUESTIONS, LIMITS } from './public/js/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3210;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const RETENTION_DAYS = Math.max(1, Number(process.env.RETENTION_DAYS) || 30);
const PERSIST = process.env.PERSIST !== 'false';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'sessions.json');
const MAX_SESSIONS = 300;
const MAX_PARTICIPANTS = 200;

/** @type {Map<string, any>} */
const sessions = new Map();
let dirty = false;

// ---------------------------------------------------------------- utilitaires
const now = () => Date.now();
const newId = () => crypto.randomBytes(6).toString('base64url');
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans 0/O, 1/I/L
function newCode() {
  let code;
  do {
    code = Array.from(crypto.randomBytes(5), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  } while (sessions.has(code));
  return code;
}
function clean(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim().slice(0, max);
}
function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}
class UserError extends Error {}
const fail = (m) => { throw new UserError(m); };

// ---------------------------------------------------------------- sessions
function createSession(title) {
  const t = now();
  const s = {
    code: newCode(),
    title: clean(title, LIMITS.title) || 'Atelier charte IA',
    createdAt: t,
    lastActivity: t,
    adminKey: crypto.randomBytes(18).toString('base64url'),
    live: { focus: null, focusAt: 0, spotlight: null },
    spaces: {},
    participants: {}, // pid (secret) -> { uid (public), name, isAdmin, joinedAt }
    contributions: [],
    questions: DEFAULT_QUESTIONS.map((q) => ({
      id: newId(), space: q.space, text: q.text, type: q.type, options: q.options || [],
      status: 'draft', createdAt: t, answers: {},
    })),
  };
  migrate(s);
  sessions.set(s.code, s);
  dirty = true;
  return s;
}
function migrate(s) {
  for (const sp of SPACES) s.spaces[sp.id] ??= { locked: false, synthesis: '' };
}
function touch(s) { s.lastActivity = now(); dirty = true; }

// ---------------------------------------------------------------- persistance
function load() {
  if (!PERSIST) return;
  try {
    const arr = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    for (const s of arr) { migrate(s); sessions.set(s.code, s); }
    console.log(`${sessions.size} session(s) rechargée(s) depuis ${DATA_FILE}`);
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('Lecture des données impossible :', e.message);
  }
}
function save(force = false) {
  if (!PERSIST || (!dirty && !force)) return;
  dirty = false;
  const json = JSON.stringify([...sessions.values()]);
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, json);
    try { fs.renameSync(tmp, DATA_FILE); } catch { fs.writeFileSync(DATA_FILE, json); fs.rmSync(tmp, { force: true }); }
  } catch (e) {
    console.error('Sauvegarde impossible :', e.message);
    dirty = true;
  }
}
function purge() {
  const limit = now() - RETENTION_DAYS * 864e5;
  for (const [code, s] of sessions) {
    if ((s.lastActivity || s.createdAt) < limit) {
      sessions.delete(code);
      dirty = true;
      console.log(`Session ${code} supprimée (inactive depuis plus de ${RETENTION_DAYS} jours)`);
    }
  }
}

// ---------------------------------------------------------------- vues envoyées aux clients
function buildState(s, admin, onlinePids) {
  const counts = (votes) => Object.fromEntries(Object.entries(votes).map(([k, v]) => [k, v.length]));
  return {
    code: s.code,
    title: s.title,
    createdAt: s.createdAt,
    retentionDays: RETENTION_DAYS,
    serverNow: now(),
    live: s.live,
    spaces: s.spaces,
    participants: Object.entries(s.participants)
      .map(([pid, p]) => ({ uid: p.uid, name: p.name, isAdmin: !!p.isAdmin, online: onlinePids.has(pid) })),
    contributions: s.contributions
      .filter((c) => admin || !c.hidden)
      .map((c) => ({
        id: c.id, space: c.space, questionId: c.questionId, author: c.author, text: c.text,
        fields: c.fields, tag: c.tag, createdAt: c.createdAt, edited: !!c.updatedAt,
        retained: c.retained, hidden: admin ? c.hidden : false, votes: counts(c.votes),
        comments: c.comments
          .filter((m) => admin || !m.hidden)
          .map((m) => ({ id: m.id, author: m.author, text: m.text, createdAt: m.createdAt, hidden: admin ? m.hidden : false })),
      })),
    questions: s.questions
      .filter((q) => admin || q.status !== 'draft')
      .map((q) => {
        const answers = Object.values(q.answers);
        return {
          id: q.id, space: q.space, text: q.text, type: q.type, options: q.options, status: q.status,
          createdAt: q.createdAt,
          results: q.type === 'poll' ? q.options.map((_, i) => answers.filter((a) => a === i).length) : null,
          total: q.type === 'poll' ? answers.length : s.contributions.filter((c) => c.questionId === q.id && !c.hidden).length,
        };
      }),
  };
}
function buildMe(s, pid, admin) {
  const mine = [];
  const votes = {};
  for (const c of s.contributions) {
    if (c.ownerPid === pid) mine.push(c.id);
    for (const m of c.comments) if (m.ownerPid === pid) mine.push(m.id);
    for (const [opt, arr] of Object.entries(c.votes)) if (arr.includes(pid)) (votes[c.id] ??= []).push(opt);
  }
  const polls = {};
  for (const q of s.questions) if (pid in q.answers) polls[q.id] = q.answers[pid];
  const p = s.participants[pid];
  return { uid: p?.uid, name: p?.name, isAdmin: admin, mine, votes, polls, adminKey: admin ? s.adminKey : undefined };
}

// ---------------------------------------------------------------- serveur HTTP
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});
app.get('/vendor/preact-htm.js', (req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'node_modules', 'htm', 'preact', 'standalone.module.js'));
});
app.get('/api/config', (req, res) => res.json({ requirePassword: !!ADMIN_PASSWORD, retentionDays: RETENTION_DAYS }));
app.get('/health', (req, res) => res.json({ ok: true, sessions: sessions.size }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

const server = createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e5,
  perMessageDeflate: { threshold: 2048 },
  pingInterval: 20000,
  pingTimeout: 25000,
});

// Diffusion groupée : au plus une diffusion toutes les 150 ms par session
const pending = new Map();
function scheduleBroadcast(code) {
  if (pending.has(code)) return;
  pending.set(code, setTimeout(() => { pending.delete(code); broadcast(code); }, 150));
}
function broadcast(code) {
  const s = sessions.get(code);
  const room = io.sockets.adapter.rooms.get(code);
  if (!s || !room) return;
  const sockets = [...room].map((id) => io.sockets.sockets.get(id)).filter(Boolean);
  const online = new Set(sockets.map((x) => x.data.pid));
  const views = {};
  for (const sock of sockets) {
    const admin = !!sock.data.isAdmin;
    const key = admin ? 'admin' : 'public';
    views[key] ??= buildState(s, admin, online);
    sock.emit('state', { state: views[key], me: buildMe(s, sock.data.pid, admin) });
  }
}

// ---------------------------------------------------------------- opérations
const getContrib = (s, id) => s.contributions.find((c) => c.id === id) || fail('Contribution introuvable (elle a peut-être été supprimée).');
const getQuestion = (s, id) => s.questions.find((q) => q.id === id) || fail('Question introuvable.');
const canEdit = (ctx, ownerPid) => ctx.isAdmin || ownerPid === ctx.pid;
function assertOpen(s, ctx, spaceId) {
  if (!ctx.isAdmin && s.spaces[spaceId]?.locked) fail('Cet espace a été fermé aux contributions par le formateur.');
}
function authorName(s, ctx, anon) {
  if (anon) return null;
  return s.participants[ctx.pid]?.name || 'Participant';
}
function readForm(space, values) {
  const fields = {};
  let text = '';
  for (const f of space.form) {
    let v = clean(values?.[f.id], f.type === 'textarea' ? LIMITS.text : LIMITS.short);
    if (f.type === 'select' && v && !f.options.some((o) => o.id === v)) v = '';
    if (f.required && !v) fail(`Le champ « ${f.label} » est obligatoire.`);
    if (f.id === 'text') text = v;
    else if (v) fields[f.id] = v;
  }
  return { text, fields };
}
const readTag = (space, tag) => (space.tags?.options.some((o) => o.id === tag) ? tag : null);
function clearSpotIf(s, kind, id) {
  if (s.live.spotlight?.kind === kind && s.live.spotlight.id === id) s.live.spotlight = null;
}

const OPS = {
  // ---- participants
  'contrib.add'(s, ctx, p) {
    if (s.contributions.length >= LIMITS.contributions) fail('Nombre maximal de contributions atteint pour cette session.');
    let space; let text; let fields = {}; let tag = null; let questionId = null;
    if (p.questionId) {
      const q = getQuestion(s, p.questionId);
      if (q.type !== 'open') fail('Cette question attend un vote, pas un texte.');
      if (q.status !== 'open' && !ctx.isAdmin) fail('Cette question est close.');
      space = SPACE_MAP[q.space];
      questionId = q.id;
      text = clean(p.values?.text, LIMITS.text);
      if (!text) fail('Votre réponse est vide.');
    } else {
      space = SPACE_MAP[p.space];
      if (!space || space.freeForm === false) fail('Espace inconnu.');
      assertOpen(s, ctx, space.id);
      ({ text, fields } = readForm(space, p.values));
      tag = readTag(space, p.tag);
    }
    const c = {
      id: newId(), space: space.id, questionId, ownerPid: ctx.pid, author: authorName(s, ctx, p.anon),
      text, fields, tag, createdAt: now(), updatedAt: null, hidden: false, retained: false, votes: {}, comments: [],
    };
    s.contributions.push(c);
    return { id: c.id };
  },
  'contrib.edit'(s, ctx, p) {
    const c = getContrib(s, p.id);
    if (!canEdit(ctx, c.ownerPid)) fail('Vous ne pouvez modifier que vos propres contributions.');
    if (!c.questionId) assertOpen(s, ctx, c.space);
    if (c.questionId) {
      const text = clean(p.values?.text, LIMITS.text);
      if (!text) fail('Votre réponse est vide.');
      c.text = text;
    } else {
      const space = SPACE_MAP[c.space];
      Object.assign(c, readForm(space, p.values));
      c.tag = readTag(space, p.tag);
    }
    c.updatedAt = now();
  },
  'contrib.delete'(s, ctx, p) {
    const c = getContrib(s, p.id);
    if (!canEdit(ctx, c.ownerPid)) fail('Vous ne pouvez supprimer que vos propres contributions.');
    s.contributions = s.contributions.filter((x) => x !== c);
    clearSpotIf(s, 'contrib', c.id);
  },
  'contrib.vote'(s, ctx, p) {
    const c = getContrib(s, p.id);
    if (!c.questionId) assertOpen(s, ctx, c.space);
    const set = VOTE_SETS[c.questionId ? 'answer' : SPACE_MAP[c.space].votes];
    if (!set.options.some((o) => o.id === p.opt)) fail('Réaction inconnue.');
    const had = (c.votes[p.opt] || []).includes(ctx.pid);
    if (set.exclusive) for (const k of Object.keys(c.votes)) c.votes[k] = c.votes[k].filter((x) => x !== ctx.pid);
    else c.votes[p.opt] = (c.votes[p.opt] || []).filter((x) => x !== ctx.pid);
    if (!had) (c.votes[p.opt] ??= []).push(ctx.pid);
  },
  'comment.add'(s, ctx, p) {
    const c = getContrib(s, p.id);
    if (!c.questionId) assertOpen(s, ctx, c.space);
    if (c.comments.length >= LIMITS.comments) fail('Nombre maximal de commentaires atteint.');
    const text = clean(p.text, LIMITS.comment);
    if (!text) fail('Votre commentaire est vide.');
    const m = { id: newId(), ownerPid: ctx.pid, author: authorName(s, ctx, p.anon), text, createdAt: now(), hidden: false };
    c.comments.push(m);
    return { id: m.id };
  },
  'comment.delete'(s, ctx, p) {
    const c = getContrib(s, p.id);
    const m = c.comments.find((x) => x.id === p.cid) || fail('Commentaire introuvable.');
    if (!canEdit(ctx, m.ownerPid)) fail('Vous ne pouvez supprimer que vos propres commentaires.');
    c.comments = c.comments.filter((x) => x !== m);
  },
  'poll.answer'(s, ctx, p) {
    const q = getQuestion(s, p.qid);
    if (q.type !== 'poll') fail('Cette question attend une réponse écrite.');
    if (q.status !== 'open') fail('Ce sondage est clos.');
    const idx = Number(p.idx);
    if (!Number.isInteger(idx) || idx < 0 || idx >= q.options.length) fail('Choix invalide.');
    q.answers[ctx.pid] = idx;
  },

  // ---- formateur
  'admin.hide'(s, ctx, p) {
    const c = getContrib(s, p.id);
    if (p.cid) {
      const m = c.comments.find((x) => x.id === p.cid) || fail('Commentaire introuvable.');
      m.hidden = !!p.hidden;
    } else {
      c.hidden = !!p.hidden;
      if (c.hidden) clearSpotIf(s, 'contrib', c.id);
    }
  },
  'admin.retain'(s, ctx, p) { getContrib(s, p.id).retained = !!p.retained; },
  'admin.spotlight'(s, ctx, p) {
    if (!p.kind) { s.live.spotlight = null; return; }
    if (p.kind === 'contrib') getContrib(s, p.id);
    else if (p.kind === 'question') getQuestion(s, p.id);
    else fail('Élément inconnu.');
    s.live.spotlight = { kind: p.kind, id: p.id, at: now() };
  },
  'admin.focus'(s, ctx, p) {
    if (p.space && !SPACE_MAP[p.space] && p.space !== 'synthese') fail('Espace inconnu.');
    s.live.focus = p.space || null;
    s.live.focusAt = now();
  },
  'admin.lock'(s, ctx, p) {
    if (!s.spaces[p.space]) fail('Espace inconnu.');
    s.spaces[p.space].locked = !!p.locked;
  },
  'admin.synthesis'(s, ctx, p) {
    if (!s.spaces[p.space]) fail('Espace inconnu.');
    s.spaces[p.space].synthesis = typeof p.text === 'string' ? p.text.replace(/\r\n?/g, '\n').slice(0, LIMITS.synthesis) : '';
  },
  'admin.question.create'(s, ctx, p) {
    if (!SPACE_MAP[p.space]) fail('Espace inconnu.');
    const text = clean(p.text, LIMITS.question);
    if (!text) fail('Le texte de la question est vide.');
    const type = p.type === 'poll' ? 'poll' : 'open';
    const options = type === 'poll'
      ? (Array.isArray(p.options) ? p.options : []).map((o) => clean(o, LIMITS.option)).filter(Boolean).slice(0, LIMITS.options)
      : [];
    if (type === 'poll' && options.length < 2) fail('Un sondage doit proposer au moins deux choix.');
    const q = { id: newId(), space: p.space, text, type, options, status: p.open ? 'open' : 'draft', createdAt: now(), answers: {} };
    s.questions.push(q);
    return { id: q.id };
  },
  'admin.question.status'(s, ctx, p) {
    const q = getQuestion(s, p.id);
    if (!['draft', 'open', 'closed'].includes(p.status)) fail('Statut inconnu.');
    q.status = p.status;
  },
  'admin.question.delete'(s, ctx, p) {
    const q = getQuestion(s, p.id);
    s.questions = s.questions.filter((x) => x !== q);
    s.contributions = s.contributions.filter((c) => c.questionId !== q.id);
    clearSpotIf(s, 'question', q.id);
  },
  'admin.session.rename'(s, ctx, p) {
    const title = clean(p.title, LIMITS.title);
    if (!title) fail('Le titre est vide.');
    s.title = title;
  },
  'admin.session.delete'(s) {
    sessions.delete(s.code);
    io.to(s.code).emit('session-deleted');
    io.in(s.code).socketsLeave(s.code);
    return { deleted: true };
  },
};

// ---------------------------------------------------------------- sockets
io.on('connection', (socket) => {
  socket.data = { code: null, pid: null, isAdmin: false };
  let created = 0;
  let bucket = { start: now(), n: 0 };
  const allow = () => {
    const t = now();
    if (t - bucket.start > 10000) bucket = { start: t, n: 0 };
    return ++bucket.n <= 40;
  };

  socket.on('create', (p, ack) => {
    if (typeof ack !== 'function') return;
    try {
      if (ADMIN_PASSWORD && !safeEqual(p?.password || '', ADMIN_PASSWORD)) fail('Mot de passe formateur incorrect.');
      if (++created > 5) fail('Trop de sessions créées depuis cet appareil.');
      if (sessions.size >= MAX_SESSIONS) fail('Nombre maximal de sessions atteint sur ce serveur.');
      const s = createSession(p?.title);
      console.log(`Session ${s.code} créée`);
      ack({ ok: true, code: s.code, adminKey: s.adminKey });
    } catch (e) {
      ack({ ok: false, error: e instanceof UserError ? e.message : 'Erreur inattendue.' });
      if (!(e instanceof UserError)) console.error(e);
    }
  });

  socket.on('join', (p, ack) => {
    if (typeof ack !== 'function') return;
    try {
      const code = clean(p?.code, 10).toUpperCase();
      const s = sessions.get(code) || fail('Session introuvable. Vérifiez le code auprès du formateur.');
      const isAdmin = !!p.adminKey && safeEqual(p.adminKey, s.adminKey);
      const name = clean(p.name, LIMITS.name);
      let pid = typeof p.pid === 'string' && s.participants[p.pid] ? p.pid : null;
      if (!pid) {
        if (!name) fail('Merci d\'indiquer votre prénom.');
        if (Object.keys(s.participants).length >= MAX_PARTICIPANTS) fail('Cette session est complète.');
        pid = crypto.randomUUID();
        s.participants[pid] = { uid: newId(), name, isAdmin, joinedAt: now() };
      } else {
        if (name) s.participants[pid].name = name;
        if (isAdmin) s.participants[pid].isAdmin = true;
      }
      if (socket.data.code && socket.data.code !== code) {
        socket.leave(socket.data.code);
        scheduleBroadcast(socket.data.code);
      }
      socket.data.code = code;
      socket.data.pid = pid;
      socket.data.isAdmin = isAdmin;
      socket.join(code);
      touch(s);
      ack({ ok: true, pid, isAdmin, name: s.participants[pid].name });
      scheduleBroadcast(code);
    } catch (e) {
      ack({ ok: false, error: e instanceof UserError ? e.message : 'Erreur inattendue.' });
      if (!(e instanceof UserError)) console.error(e);
    }
  });

  socket.on('op', (p, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      if (!allow()) fail('Doucement ! Trop d\'actions en peu de temps, réessayez dans quelques secondes.');
      const s = sessions.get(socket.data.code) || fail('Vous n\'êtes plus connecté à la session. Rechargez la page.');
      const type = String(p?.type || '');
      const fn = Object.hasOwn(OPS, type) ? OPS[type] : null;
      if (!fn) fail('Action inconnue.');
      if (type.startsWith('admin.') && !socket.data.isAdmin) fail('Action réservée au formateur.');
      const ctx = { pid: socket.data.pid, isAdmin: socket.data.isAdmin };
      const result = fn(s, ctx, p) || {};
      if (sessions.has(s.code)) { touch(s); scheduleBroadcast(s.code); } else dirty = true;
      reply({ ok: true, ...result });
    } catch (e) {
      reply({ ok: false, error: e instanceof UserError ? e.message : 'Erreur inattendue.' });
      if (!(e instanceof UserError)) console.error(e);
    }
  });

  socket.on('disconnect', () => {
    if (socket.data.code) scheduleBroadcast(socket.data.code);
  });
});

// ---------------------------------------------------------------- démarrage
load();
purge();
setInterval(() => save(), 3000).unref();
setInterval(purge, 3600 * 1000).unref();
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { save(true); process.exit(0); });
}
server.listen(PORT, () => {
  console.log(`Atelier Charte IA prêt sur http://localhost:${PORT}`);
  if (!ADMIN_PASSWORD) console.log('Astuce : définissez ADMIN_PASSWORD pour réserver la création de sessions au formateur.');
});
