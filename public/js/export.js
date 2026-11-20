// Construction de la synthèse (brouillon de charte + usages + plan d'action) et exports
import { SPACES, SPACE_MAP, VOTE_SETS } from './config.js';

const PRIORITY_ORDER = { haute: 0, moyenne: 1, basse: 2 };
const tagLabel = (space, id) => space.tags?.options.find((o) => o.id === id)?.label || '';
const fieldLabel = (space, fid, value) => {
  const f = space.form.find((x) => x.id === fid);
  return f?.type === 'select' ? f.options.find((o) => o.id === value)?.label || value : value;
};
export function voteSummary(c) {
  const set = VOTE_SETS[c.questionId ? 'answer' : SPACE_MAP[c.space].votes];
  return set.options.map((o) => `${o.icon} ${c.votes[o.id] || 0}`).join(' · ');
}
// Regroupe les réponses identiques (« Enthousiaste » ×3)
export function groupTexts(items) {
  const map = new Map();
  for (const c of items) {
    const key = c.text.trim().toLowerCase().replace(/[.!…\s]+$/, '');
    if (!map.has(key)) map.set(key, { text: c.text.trim(), n: 0 });
    map.get(key).n++;
  }
  return [...map.values()].sort((a, b) => b.n - a.n);
}
const withCount = (g) => (g.n > 1 ? `${g.text} (×${g.n})` : g.text);
export { withCount };

const pollRows = (q) => q.options.map((label, i) => {
  const n = q.results?.[i] || 0;
  return { label, n, pct: q.total ? Math.round((n * 100) / q.total) : 0 };
});

export function buildModel(st, includeAll) {
  const visible = st.contributions.filter((c) => !c.hidden);
  const questions = st.questions.filter((q) => q.status !== 'draft');
  const forSpace = (id) => {
    const qs = questions.filter((q) => q.space === id);
    return {
      polls: qs.filter((q) => q.type === 'poll' && q.total > 0).map((q) => ({ q, rows: pollRows(q) })),
      answers: qs.filter((q) => q.type === 'open').map((q) => ({ q, items: visible.filter((c) => c.questionId === q.id) })).filter((a) => a.items.length),
    };
  };
  const charte = SPACES.filter((s) => s.kind === 'charte').map((space) => {
    const items = visible.filter((c) => c.space === space.id);
    const own = items.filter((c) => !c.questionId);
    const { polls, answers } = forSpace(space.id);
    return {
      space,
      synthesis: st.spaces[space.id]?.synthesis || '',
      retained: items.filter((c) => c.retained),
      others: includeAll ? own.filter((c) => !c.retained) : [],
      polls,
      answers: includeAll ? answers.map((a) => ({ ...a, items: a.items.filter((c) => !c.retained) })).filter((a) => a.items.length) : [],
    };
  });
  const usagesSpace = SPACE_MAP.usages;
  const planSpace = SPACE_MAP.plan;
  const usages = visible.filter((c) => c.space === 'usages' && !c.questionId);
  const actions = visible.filter((c) => c.space === 'plan' && !c.questionId).sort((a, b) =>
    (PRIORITY_ORDER[a.tag] ?? 3) - (PRIORITY_ORDER[b.tag] ?? 3) || (b.votes.up || 0) - (a.votes.up || 0));
  return {
    title: st.title,
    date: st.createdAt,
    start: forSpace('accueil'),
    usagesExtra: forSpace('usages'),
    charte,
    usages: usages.map((c) => ({
      c,
      outil: c.fields.outil || '',
      usage: c.text,
      cadre: c.fields.perimetre ? fieldLabel(usagesSpace, 'perimetre', c.fields.perimetre) : '',
      fonctionne: c.fields.fonctionne || '',
      limites: c.fields.limites || '',
      vigilance: c.fields.vigilance || '',
      bilan: tagLabel(usagesSpace, c.tag),
    })),
    actions: actions.map((c) => ({
      c,
      action: c.text,
      priorite: tagLabel(planSpace, c.tag).replace('Priorité ', ''),
      axe: c.fields.axe ? fieldLabel(planSpace, 'axe', c.fields.axe) : '',
      porteur: c.fields.responsable || '',
      echeance: c.fields.echeance || '',
      soutiens: c.votes.up || 0,
    })),
    planExtra: forSpace('plan'),
  };
}

// ---------------------------------------------------------------- Markdown
const mdCell = (s) => String(s || '').replace(/\|/g, '\\|').replace(/\n+/g, ' ');
const mdLines = (s) => String(s || '').split('\n').map((l) => l.trimEnd()).join('\n');

export function buildMarkdown(model, dateStr) {
  const out = [];
  out.push(`# Charte d'usage de l'intelligence artificielle — bases de travail`, '');
  out.push(`*${model.title} — ${dateStr}*`, '');
  out.push("> Document de travail issu d'un atelier collaboratif. À compléter, adapter et faire valider par les instances de la structure (direction, CSE, CVS…).", '');
  const polls = (list) => list.forEach(({ q, rows }) => {
    out.push(`**Sondage — ${q.text}** (${q.total} réponses)`, '');
    rows.forEach((r) => out.push(`- ${r.label} : ${r.pct} % (${r.n})`));
    out.push('');
  });
  if (model.start.polls.length || model.start.answers.length) {
    out.push('## Point de départ du groupe', '');
    polls(model.start.polls);
    model.start.answers.forEach(({ q, items }) => {
      out.push(`**${q.text}**`, '');
      groupTexts(items).forEach((g) => out.push(`- ${mdCell(withCount(g))}`));
      out.push('');
    });
  }
  out.push('## Partie 1 — Bases de la charte', '');
  for (const s of model.charte) {
    out.push(`### ${s.space.num}. ${s.space.title}`, '');
    if (s.synthesis) out.push(mdLines(s.synthesis), '');
    if (s.retained.length) {
      out.push('**Propositions retenues par le groupe**', '');
      s.retained.forEach((c) => out.push(`- ${tagLabel(s.space, c.tag) ? `[${tagLabel(s.space, c.tag)}] ` : ''}${mdCell(c.text)}`));
      out.push('');
    }
    polls(s.polls);
    if (s.others.length) {
      out.push('**Autres contributions**', '');
      s.others.forEach((c) => out.push(`- ${tagLabel(s.space, c.tag) ? `[${tagLabel(s.space, c.tag)}] ` : ''}${mdCell(c.text)} _(${voteSummary(c)})_`));
      out.push('');
    }
    s.answers.forEach(({ q, items }) => {
      out.push(`**Réponses à « ${q.text} »**`, '');
      groupTexts(items).forEach((g) => out.push(`- ${mdCell(withCount(g))}`));
      out.push('');
    });
    if (!s.synthesis && !s.retained.length && !s.others.length && !s.polls.length && !s.answers.length) out.push('_À construire._', '');
  }
  out.push("## Partie 2 — Usages de l'IA testés par le groupe", '');
  if (model.usages.length) {
    out.push('| Outil | Usage | Cadre | Ce qui a fonctionné | Limites | Vigilance | Bilan |', '|---|---|---|---|---|---|---|');
    model.usages.forEach((u) => out.push(`| ${[u.outil, u.usage, u.cadre, u.fonctionne, u.limites, u.vigilance, u.bilan].map(mdCell).join(' | ')} |`));
    out.push('');
  } else out.push('_Aucun usage partagé._', '');
  polls(model.usagesExtra.polls);
  out.push("## Partie 3 — Plan d'action", '');
  if (model.actions.length) {
    out.push('| Priorité | Action | Axe | Porteur | Échéance | ⭐ |', '|---|---|---|---|---|---|');
    model.actions.forEach((a) => out.push(`| ${[a.priorite, a.action, a.axe, a.porteur, a.echeance, a.soutiens].map(mdCell).join(' | ')} |`));
    out.push('');
  } else out.push('_Aucune action proposée._', '');
  polls(model.planExtra.polls);
  return out.join('\n');
}

// ---------------------------------------------------------------- fichiers
export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const WORD_CSS = `
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1d2939;line-height:1.4}
h1{font-size:20pt;color:#1f4e79}h2{font-size:15pt;color:#1f4e79;border-bottom:1px solid #9cb3c9;padding-bottom:3pt;margin-top:18pt}
h3{font-size:12.5pt;color:#2e6b8a;margin-top:12pt}h4{font-size:11pt;margin:8pt 0 4pt}
table{border-collapse:collapse;width:100%;margin:6pt 0}th,td{border:1px solid #9cb3c9;padding:4pt;vertical-align:top;font-size:9.5pt;text-align:left}
th{background:#e8eef5}.muted,.doc-note{color:#5b6475}.doc-note{border-left:3px solid #9cb3c9;padding-left:8pt;font-style:italic}
.no-export{display:none}`;

export function downloadWord(el, filename) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll('.no-export').forEach((n) => n.remove());
  const doc = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Charte IA</title><style>${WORD_CSS}</style></head><body>${clone.innerHTML}</body></html>`;
  downloadFile(filename, '﻿' + doc, 'application/msword');
}
