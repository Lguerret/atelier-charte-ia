// Simule des participants pour tester une session (démo ou test de charge).
// Usage : npm run simulate -- <CODE> [nombre=20] [url=http://localhost:3210]
import { io } from 'socket.io-client';
import { SPACES, VOTE_SETS } from '../public/js/config.js';

const [code, nArg, urlArg] = process.argv.slice(2);
if (!code) {
  console.error('Usage : npm run simulate -- <CODE> [nombre=20] [url=http://localhost:3210]');
  process.exit(1);
}
const N = Number(nArg) || 20;
const URL = urlArg || process.env.URL || 'http://localhost:3210';
const NAMES = ['Camille', 'Sofia', 'Karim', 'Julie', 'Thomas', 'Nadia', 'Léa', 'Marc', 'Inès', 'Paul', 'Aïcha', 'Hugo', 'Claire', 'Yanis', 'Emma', 'Louis', 'Sarah', 'Malik', 'Chloé', 'Jean'];
const SAMPLES = {
  usages: [
    { outil: 'Le Chat (Mistral)', text: 'Reformuler une note d\'information aux familles', perimetre: 'support', fonctionne: 'Texte plus clair, gain de 20 minutes', limites: 'Ton parfois trop formel', vigilance: 'Aucune donnée nominative saisie', tag: 'developper' },
    { outil: 'Copilot', text: 'Préparer l\'ordre du jour d\'une réunion d\'équipe', perimetre: 'organisation', fonctionne: 'Structure rapide', limites: 'Générique', vigilance: '', tag: 'encadrer' },
    { outil: 'ChatGPT', text: 'Synthèse d\'un rapport d\'activité anonymisé', perimetre: 'accompagnement', fonctionne: 'Bonne trame', limites: 'Erreurs de chiffres', vigilance: 'Tout vérifier', tag: 'encadrer' },
  ],
  charte: ['Aucune décision concernant une personne accompagnée ne doit être prise par une IA.', 'Toujours relire et corriger ce que produit l\'IA avant utilisation.', 'Utiliser uniquement les outils validés par la structure.', 'Former tous les professionnels avant tout usage.'],
  plan: [{ text: 'Désigner un référent IA', axe: 'gouvernance', responsable: 'Direction', echeance: 'janvier 2027', tag: 'haute' }, { text: 'Organiser une sensibilisation pour toutes les équipes', axe: 'formation', responsable: 'Référent IA', echeance: 'T1 2027', tag: 'moyenne' }],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let received = 0;
let lastState = null;
async function bot(i) {
  const s = io(URL, { transports: ['websocket'] });
  s.on('state', ({ state }) => { received++; lastState = state; });
  const op = (type, p) => new Promise((res) => s.emit('op', { type, ...p }, res));
  await new Promise((res) => s.on('connect', res));
  const j = await new Promise((res) => s.emit('join', { code, name: NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${i}` : '') }, res));
  if (!j.ok) { console.error('join', j.error); return s; }
  await sleep(Math.random() * 2000);
  const space = pick(SPACES.filter((x) => x.freeForm !== false));
  let values; let tag = null;
  if (space.id === 'usages') { const u = pick(SAMPLES.usages); ({ tag } = u); values = u; }
  else if (space.id === 'plan') { const u = pick(SAMPLES.plan); ({ tag } = u); values = u; }
  else values = { text: pick(SAMPLES.charte) };
  const r = await op('contrib.add', { space: space.id, values, tag, anon: Math.random() < 0.2 });
  if (!r.ok) console.error('add', r.error);
  await sleep(500 + Math.random() * 1500);
  for (const c of (lastState?.contributions || []).slice(0, 5)) {
    const set = VOTE_SETS[c.questionId ? 'answer' : SPACES.find((x) => x.id === c.space).votes];
    await op('contrib.vote', { id: c.id, opt: pick(set.options).id });
  }
  for (const q of (lastState?.questions || []).filter((x) => x.status === 'open')) {
    if (q.type === 'poll') await op('poll.answer', { qid: q.id, idx: Math.floor(Math.random() * q.options.length) });
    else await op('contrib.add', { questionId: q.id, values: { text: pick(['Curieux', 'Prudent', 'Enthousiaste', 'Inquiet', 'Partagé']) } });
  }
  const c = pick(lastState?.contributions || [{}]);
  if (c.id) await op('comment.add', { id: c.id, text: 'Je suis d\'accord, à préciser pour notre service.' });
  return s;
}

const t0 = Date.now();
const sockets = await Promise.all(Array.from({ length: N }, (_, i) => bot(i)));
await sleep(1500);
console.log(`${N} participants simulés en ${((Date.now() - t0) / 1000).toFixed(1)} s — ${received} mises à jour reçues au total.`);
console.log(`État final : ${lastState?.contributions.length} contributions, ${lastState?.participants.filter((p) => p.online).length} en ligne.`);
if (process.env.KEEP) console.log('Bots connectés (Ctrl+C pour arrêter)…');
else { sockets.forEach((s) => s.close()); process.exit(0); }
