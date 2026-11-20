// Composants réutilisables : formulaires, cartes de contribution, questions…
import { html, useState, useEffect } from '/vendor/preact-htm.js';
import { SPACES, SPACE_MAP, VOTE_SETS, LIMITS } from './config.js';
import { store, send, toast } from './store.js';
import { confirmPrivacy } from './privacy.js';

export const fmtTime = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
export const fmtDate = (ts) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
export const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export const tagInfo = (space, id) => space?.tags?.options.find((o) => o.id === id);
export const voteSetFor = (c) => VOTE_SETS[c.questionId ? 'answer' : SPACE_MAP[c.space].votes];
export const support = (c) => (c.votes.up || 0) + (c.votes.same || 0) - (c.votes.down || 0);
export const optionLabel = (field, id) => field.options?.find((o) => o.id === id)?.label || id;
export const spaceLabel = (id) => {
  const s = SPACE_MAP[id];
  return s ? (s.num ? `${s.num}. ${s.title}` : s.title) : id;
};

export function Tag({ space, id }) {
  const t = tagInfo(space, id);
  return t ? html`<span class="tag tag-${t.color}">${t.label}</span>` : null;
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  return html`
    <div class="modal-back" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label=${title}>
        <div class="modal-head">
          <h2>${title}</h2>
          <button class="icon-btn" onClick=${onClose} aria-label="Fermer">✕</button>
        </div>
        ${children}
      </div>
    </div>`;
}

export function PrivacyHint() {
  return html`<p class="privacy-hint">🔒 Aucun nom, prénom, date ou détail permettant de reconnaître une personne accompagnée.</p>`;
}

// Texte « riche » minimal : lignes commençant par • - * deviennent des listes
export function RichText({ text }) {
  const blocks = [];
  let list = null;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    const m = line.match(/^[•\-*]\s*(.*)$/);
    if (m) { if (!list) { list = []; blocks.push(list); } list.push(m[1]); }
    else { list = null; if (line) blocks.push(line); }
  }
  return blocks.map((b) => (Array.isArray(b)
    ? html`<ul>${b.map((li) => html`<li>${li}</li>`)}</ul>`
    : html`<p>${b}</p>`));
}

// ---------------------------------------------------------------- formulaire de contribution
export function ContribForm({ space, initial, mode = 'add', questionId, onDone }) {
  const fields = questionId
    ? [{ id: 'text', label: 'Votre réponse', type: 'textarea', rows: 2, required: true, placeholder: 'Votre réponse…' }]
    : space.form;
  const [vals, setVals] = useState(() => (initial ? { text: initial.text, ...initial.fields } : {}));
  const [tag, setTag] = useState(initial?.tag || null);
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (id, v) => setVals((x) => ({ ...x, [id]: v }));
  const uid = (questionId || space.id) + (initial?.id || '');

  async function submit(e) {
    e.preventDefault();
    const missing = fields.find((f) => f.required && !(vals[f.id] || '').trim());
    if (missing) { toast(`Merci de remplir « ${missing.label} ».`, 'warn'); return; }
    if (!confirmPrivacy(Object.values(vals).join('\n'))) return;
    setBusy(true);
    const res = mode === 'edit'
      ? await send('contrib.edit', { id: initial.id, values: vals, tag })
      : await send('contrib.add', { space: space.id, questionId, values: vals, tag, anon });
    setBusy(false);
    if (!res) return;
    if (mode !== 'edit') { setVals({}); setTag(null); }
    toast(mode === 'edit' ? 'Modification enregistrée.' : 'Merci, c\'est publié !', 'ok');
    onDone?.();
  }

  return html`
    <form class="contrib-form" onSubmit=${submit}>
      ${fields.map((f) => {
        const id = `f-${uid}-${f.id}`;
        const common = { id, value: vals[f.id] || '', onInput: (e) => set(f.id, e.target.value) };
        let input;
        if (f.type === 'textarea') input = html`<textarea ...${common} rows=${f.rows || 3} maxlength=${LIMITS.text} placeholder=${f.placeholder || ''}></textarea>`;
        else if (f.type === 'select') {
          input = html`<select ...${common} onChange=${(e) => set(f.id, e.target.value)}>
            <option value="">— Choisir —</option>
            ${f.options.map((o) => html`<option value=${o.id}>${o.label}</option>`)}
          </select>`;
        } else input = html`<input type="text" ...${common} maxlength=${LIMITS.short} placeholder=${f.placeholder || ''} />`;
        return html`<div class="field ${f.type === 'textarea' ? 'wide' : ''}">
          <label for=${id}>${f.label}${f.required ? html`<span class="req" aria-hidden="true"> *</span>` : ''}</label>
          ${input}
        </div>`;
      })}
      ${!questionId && space.tags ? html`
        <fieldset class="field wide tag-pick">
          <legend>${space.tags.label} <span class="muted">(facultatif)</span></legend>
          ${space.tags.options.map((o) => html`
            <button type="button" class="tag tag-${o.color} pick ${tag === o.id ? 'on' : ''}" aria-pressed=${tag === o.id}
              onClick=${() => setTag(tag === o.id ? null : o.id)}>${tag === o.id ? '✓ ' : ''}${o.label}</button>`)}
        </fieldset>` : null}
      <div class="form-foot wide">
        ${mode !== 'edit' ? html`<label class="check"><input type="checkbox" checked=${anon} onChange=${(e) => setAnon(e.target.checked)} /> Publier sans mon prénom</label>` : html`<span></span>`}
        <button class="btn" type="submit" disabled=${busy}>${busy ? 'Envoi…' : mode === 'edit' ? 'Enregistrer' : questionId ? 'Répondre' : 'Publier'}</button>
      </div>
      <${PrivacyHint} />
    </form>`;
}

// ---------------------------------------------------------------- contribution
function ContribBody({ c, space }) {
  if (c.questionId) return html`<p class="contrib-text">${c.text}</p>`;
  const titleField = space.titleField;
  const meta = space.form.filter((f) => f.id !== 'text' && f.id !== titleField && f.type !== 'textarea' && c.fields[f.id]);
  const long = space.form.filter((f) => f.id !== 'text' && f.type === 'textarea' && c.fields[f.id]);
  return html`
    ${titleField && c.fields[titleField] ? html`<h3 class="contrib-title">${c.fields[titleField]}</h3>` : null}
    <p class="contrib-text ${space.kind === 'plan' ? 'strong' : ''}">${c.text}</p>
    ${meta.length ? html`<div class="contrib-meta-fields">${meta.map((f) => html`
      <span class="meta-chip"><span class="muted">${f.label} :</span> ${f.type === 'select' ? optionLabel(f, c.fields[f.id]) : c.fields[f.id]}</span>`)}</div>` : null}
    ${long.length ? html`<dl class="contrib-details">${long.map((f) => html`<div><dt>${f.label}</dt><dd>${c.fields[f.id]}</dd></div>`)}</dl>` : null}`;
}

function VoteBar({ c, disabled }) {
  const set = voteSetFor(c);
  const my = store.me.votes[c.id] || [];
  return html`<div class="votes" role="group" aria-label="Réactions">
    ${set.options.map((o) => {
      const on = my.includes(o.id);
      return html`<button class="vote ${on ? 'on' : ''}" disabled=${disabled} aria-pressed=${on} title=${o.label}
        onClick=${() => send('contrib.vote', { id: c.id, opt: o.id })}>
        <span aria-hidden="true">${o.icon}</span><span class="vote-label">${o.label}</span><b>${c.votes[o.id] || 0}</b>
      </button>`;
    })}
  </div>`;
}

function Comments({ c, locked }) {
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  const { me } = store;
  async function submit(e) {
    e.preventDefault();
    if (!text.trim() || !confirmPrivacy(text)) return;
    if (await send('comment.add', { id: c.id, text, anon })) setText('');
  }
  return html`<div class="comments">
    ${c.comments.map((m) => html`
      <div class="comment ${m.hidden ? 'is-hidden' : ''}" key=${m.id}>
        <div class="comment-head"><b>${m.author || 'Anonyme'}</b> <span class="muted">${fmtTime(m.createdAt)}</span>
          ${m.hidden ? html`<span class="tag tag-grey">masqué</span>` : null}
          <span class="spacer"></span>
          ${me.isAdmin ? html`<button class="link-btn" onClick=${() => send('admin.hide', { id: c.id, cid: m.id, hidden: !m.hidden })}>${m.hidden ? 'Afficher' : 'Masquer'}</button>` : null}
          ${me.isAdmin || me.mine.includes(m.id) ? html`<button class="link-btn danger" onClick=${() => confirm('Supprimer ce commentaire ?') && send('comment.delete', { id: c.id, cid: m.id })}>Supprimer</button>` : null}
        </div>
        <p>${m.text}</p>
      </div>`)}
    ${locked ? null : html`<form class="comment-form" onSubmit=${submit}>
      <label class="sr-only" for=${'cm-' + c.id}>Votre commentaire</label>
      <textarea id=${'cm-' + c.id} rows="2" maxlength=${LIMITS.comment} placeholder="Votre commentaire, une question, un complément…" value=${text} onInput=${(e) => setText(e.target.value)}></textarea>
      <div class="form-foot">
        <label class="check"><input type="checkbox" checked=${anon} onChange=${(e) => setAnon(e.target.checked)} /> Sans mon prénom</label>
        <button class="btn small" type="submit" disabled=${!text.trim()}>Commenter</button>
      </div>
    </form>`}
  </div>`;
}

export function ContributionCard({ c, showSpace }) {
  const { session: st, me } = store;
  const space = SPACE_MAP[c.space];
  const isAdmin = me.isAdmin;
  const mine = me.mine.includes(c.id);
  const [editing, setEditing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const locked = !isAdmin && !c.questionId && st.spaces[c.space]?.locked;
  const spot = st.live.spotlight;
  const isSpot = spot?.kind === 'contrib' && spot.id === c.id;
  const canRetain = space.kind === 'charte' || !!c.questionId;

  return html`<article class="card contrib ${c.hidden ? 'is-hidden' : ''} ${c.retained ? 'is-retained' : ''} ${isSpot ? 'is-spot' : ''}">
    <div class="contrib-top">
      ${showSpace ? html`<span class="tag tag-plain">${spaceLabel(c.space)}</span>` : null}
      <${Tag} space=${space} id=${c.tag} />
      ${c.retained ? html`<span class="tag tag-retained">✔ Retenue pour la charte</span>` : null}
      ${isSpot ? html`<span class="tag tag-spot">★ Mise en avant</span>` : null}
      ${c.hidden ? html`<span class="tag tag-grey">Masquée aux participants</span>` : null}
    </div>
    <${ContribBody} c=${c} space=${space} />
    <div class="contrib-meta">${c.author || 'Anonyme'} · ${fmtTime(c.createdAt)}${c.edited ? ' · modifié' : ''}${mine ? ' · vous' : ''}</div>
    <${VoteBar} c=${c} disabled=${locked} />
    <div class="contrib-actions">
      <button class="link-btn" aria-expanded=${showComments} onClick=${() => setShowComments((v) => !v)}>
        💬 ${c.comments.length ? plural(c.comments.length, 'commentaire', 'commentaires') : 'Commenter'}
      </button>
      <span class="spacer"></span>
      ${(mine || isAdmin) && !locked ? html`<button class="link-btn" onClick=${() => setEditing(true)}>Modifier</button>` : null}
      ${mine || isAdmin ? html`<button class="link-btn danger" onClick=${() => confirm('Supprimer définitivement cette contribution ?') && send('contrib.delete', { id: c.id })}>Supprimer</button>` : null}
    </div>
    ${isAdmin ? html`<div class="admin-bar">
      <button class="chip-btn ${isSpot ? 'on' : ''}" onClick=${() => send('admin.spotlight', isSpot ? { kind: null } : { kind: 'contrib', id: c.id })}>${isSpot ? '★ Retirer la mise en avant' : '☆ Mettre en avant'}</button>
      ${canRetain ? html`<button class="chip-btn ${c.retained ? 'on' : ''}" onClick=${() => send('admin.retain', { id: c.id, retained: !c.retained })}>${c.retained ? '✔ Retenue' : 'Retenir pour la charte'}</button>` : null}
      <button class="chip-btn" onClick=${() => send('admin.hide', { id: c.id, hidden: !c.hidden })}>${c.hidden ? 'Rendre visible' : 'Masquer'}</button>
    </div>` : null}
    ${showComments ? html`<${Comments} c=${c} locked=${locked} />` : null}
    ${editing ? html`<${Modal} title="Modifier la contribution" onClose=${() => setEditing(false)}>
      <${ContribForm} space=${space} initial=${c} mode="edit" questionId=${c.questionId} onDone=${() => setEditing(false)} />
    <//>` : null}
  </article>`;
}

// ---------------------------------------------------------------- questions du formateur
const STATUS = { draft: 'Brouillon', open: 'Ouverte', closed: 'Close' };

export function PollResults({ q, big }) {
  const total = q.total || 0;
  return html`<div class="poll ${big ? 'big' : ''}">
    ${q.options.map((o, i) => {
      const n = q.results?.[i] || 0;
      const pct = total ? Math.round((n * 100) / total) : 0;
      return html`<div class="poll-opt static">
        <span class="poll-bar" style=${{ width: pct + '%' }}></span>
        <span class="poll-label">${o}</span><span class="poll-pct">${pct} % <span class="muted">(${n})</span></span>
      </div>`;
    })}
    <p class="muted small">${plural(total, 'réponse', 'réponses')}</p>
  </div>`;
}

function Poll({ q }) {
  const { me } = store;
  const my = me.polls[q.id];
  const answered = my !== undefined;
  const showResults = me.isAdmin || answered || q.status === 'closed';
  const total = q.total || 0;
  return html`<div class="poll" role="group" aria-label="Choix">
    ${q.options.map((o, i) => {
      const n = q.results?.[i] || 0;
      const pct = total ? Math.round((n * 100) / total) : 0;
      return html`<button class="poll-opt ${my === i ? 'on' : ''}" disabled=${q.status !== 'open'} aria-pressed=${my === i}
        onClick=${() => send('poll.answer', { qid: q.id, idx: i })}>
        ${showResults ? html`<span class="poll-bar" style=${{ width: pct + '%' }}></span>` : null}
        <span class="poll-label">${my === i ? '✔ ' : ''}${o}</span>
        ${showResults ? html`<span class="poll-pct">${pct} % <span class="muted">(${n})</span></span>` : null}
      </button>`;
    })}
    <p class="muted small">${plural(total, 'réponse', 'réponses')}${!showResults ? ' · les résultats s\'affichent après votre vote' : ''}${answered && q.status === 'open' ? ' · vous pouvez changer d\'avis tant que le sondage est ouvert' : ''}</p>
  </div>`;
}

export function QuestionAdmin({ q, compact }) {
  const spot = store.session.live.spotlight;
  const isSpot = spot?.kind === 'question' && spot.id === q.id;
  return html`<div class="admin-bar">
    ${q.status === 'draft' ? html`<button class="chip-btn go" onClick=${() => send('admin.question.status', { id: q.id, status: 'open' })}>▶ Ouvrir</button>` : null}
    ${q.status === 'open' ? html`<button class="chip-btn" onClick=${() => send('admin.question.status', { id: q.id, status: 'closed' })}>■ Clore</button>` : null}
    ${q.status === 'closed' ? html`<button class="chip-btn" onClick=${() => send('admin.question.status', { id: q.id, status: 'open' })}>↺ Rouvrir</button>` : null}
    <button class="chip-btn ${isSpot ? 'on' : ''}" onClick=${() => send('admin.spotlight', isSpot ? { kind: null } : { kind: 'question', id: q.id })}>${isSpot ? '★ Retirer de l\'écran' : '☆ Mettre en avant'}</button>
    ${compact ? null : html`<button class="chip-btn danger" onClick=${() => confirm('Supprimer cette question et ses réponses ?') && send('admin.question.delete', { id: q.id })}>Supprimer</button>`}
  </div>`;
}

export function QuestionCard({ q }) {
  const { session: st, me } = store;
  const answers = st.contributions.filter((c) => c.questionId === q.id);
  const spot = st.live.spotlight;
  const isSpot = spot?.kind === 'question' && spot.id === q.id;
  const answeredOpen = answers.some((c) => me.mine.includes(c.id));
  return html`<section class="card question status-${q.status} ${isSpot ? 'is-spot' : ''}" id=${'q-' + q.id}>
    <div class="q-head">
      <span class="q-badge">${q.type === 'poll' ? '📊 Sondage' : '❓ Question'} du formateur</span>
      <span class="status status-${q.status}">${STATUS[q.status]}</span>
    </div>
    <h3 class="q-text">${q.text}</h3>
    ${q.type === 'poll' ? html`<${Poll} q=${q} />` : html`
      ${q.status === 'open' ? html`<details class="answer-box" open=${!answeredOpen}>
        <summary>${answeredOpen ? 'Ajouter une autre réponse' : 'Votre réponse'}</summary>
        <${ContribForm} space=${SPACE_MAP[q.space]} questionId=${q.id} />
      </details>` : null}
      ${answers.length ? html`<div class="answers grid">${answers.slice().sort((a, b) => b.createdAt - a.createdAt).map((c) => html`<${ContributionCard} key=${c.id} c=${c} />`)}</div>`
        : html`<p class="muted small">Pas encore de réponse.</p>`}`}
    ${me.isAdmin ? html`<${QuestionAdmin} q=${q} />` : null}
  </section>`;
}

export function QuestionCreate({ defaultSpace, onDone }) {
  const [space, setSpace] = useState(defaultSpace || 'accueil');
  const [type, setType] = useState('open');
  const [text, setText] = useState('');
  const [options, setOptions] = useState('');
  const [open, setOpen] = useState(true);
  async function submit(e) {
    e.preventDefault();
    const res = await send('admin.question.create', { space, type, text, options: options.split('\n'), open });
    if (res) { setText(''); setOptions(''); toast(open ? 'Question ouverte aux participants.' : 'Question enregistrée en brouillon.', 'ok'); onDone?.(); }
  }
  return html`<form class="contrib-form" onSubmit=${submit}>
    <div class="field">
      <label for="qc-space">Espace</label>
      <select id="qc-space" value=${space} onChange=${(e) => setSpace(e.target.value)}>
        ${SPACES.map((s) => html`<option value=${s.id}>${spaceLabel(s.id)}</option>`)}
      </select>
    </div>
    <fieldset class="field">
      <legend>Type</legend>
      <div class="seg">
        <button type="button" class=${type === 'open' ? 'on' : ''} onClick=${() => setType('open')}>Question ouverte</button>
        <button type="button" class=${type === 'poll' ? 'on' : ''} onClick=${() => setType('poll')}>Sondage</button>
      </div>
    </fieldset>
    <div class="field wide">
      <label for="qc-text">Question</label>
      <textarea id="qc-text" rows="2" maxlength=${LIMITS.question} value=${text} onInput=${(e) => setText(e.target.value)} placeholder="ex. Quel usage de l'IA vous paraît le plus utile pour votre équipe ?"></textarea>
    </div>
    ${type === 'poll' ? html`<div class="field wide">
      <label for="qc-opts">Choix proposés (un par ligne)</label>
      <textarea id="qc-opts" rows="4" value=${options} onInput=${(e) => setOptions(e.target.value)} placeholder=${'Oui\nNon\nJe ne sais pas'}></textarea>
    </div>` : null}
    <div class="form-foot wide">
      <label class="check"><input type="checkbox" checked=${open} onChange=${(e) => setOpen(e.target.checked)} /> Ouvrir immédiatement</label>
      <button class="btn" type="submit" disabled=${!text.trim()}>Créer la question</button>
    </div>
  </form>`;
}
