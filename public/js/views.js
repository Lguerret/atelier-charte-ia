// Écrans de l'application
import { html, useState, useEffect, useRef } from '/vendor/preact-htm.js';
import { SPACES, SPACE_MAP, LIMITS } from './config.js';
import {
  store, send, toast, go, doJoin, createSession, leaveSession, LS, identKey, spaceHash,
} from './store.js';
import {
  ContribForm, ContributionCard, QuestionCard, QuestionAdmin, QuestionCreate, PollResults, Modal, RichText,
  Tag, fmtTime, fmtDate, plural, support, spaceLabel,
} from './ui.js';
import { buildModel, buildMarkdown, downloadFile, downloadWord, voteSummary, groupTexts, withCount } from './export.js';

const joinUrl = (code) => `${location.origin}/?s=${code}`;
const NAV = [...SPACES.map((s) => s.id), 'synthese'];
const navLabel = (id) => (id === 'synthese' ? 'Synthèse et export' : spaceLabel(id));

async function copy(text, msg = 'Copié !') {
  try { await navigator.clipboard.writeText(text); toast(msg, 'ok'); }
  catch { window.prompt('Copiez ce texte :', text); }
}

// ================================================================ accès
export function JoinScreen() {
  const params = new URLSearchParams(location.search);
  const [code, setCode] = useState((params.get('s') || '').toUpperCase());
  const [name, setName] = useState('');
  const { error, joining } = store;
  async function submit(e) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c || !name.trim()) return;
    const prev = LS.get(identKey(c)) || {};
    await doJoin({ code: c, name: name.trim(), pid: prev.pid, adminKey: prev.adminKey });
  }
  return html`<main class="center-page">
    <div class="card join-card">
      <div class="brand-big"><span class="logo" aria-hidden="true">✦</span> Atelier Charte IA</div>
      <p class="lead">Co-construisons ensemble les bases d'une charte d'usage de l'intelligence artificielle pour nos structures.</p>
      <form onSubmit=${submit} class="join-form">
        <div class="field">
          <label for="j-code">Code de la session</label>
          <input id="j-code" class="code-input" autocomplete="off" autocapitalize="characters" maxlength="10" placeholder="ex. K7PM4"
            value=${code} onInput=${(e) => setCode(e.target.value.toUpperCase())} />
        </div>
        <div class="field">
          <label for="j-name">Votre prénom (ou un pseudonyme)</label>
          <input id="j-name" autocomplete="given-name" maxlength=${LIMITS.name} placeholder="ex. Camille" value=${name} onInput=${(e) => setName(e.target.value)} />
        </div>
        ${error ? html`<p class="error" role="alert">${error}</p>` : null}
        <button class="btn big" type="submit" disabled=${joining || !code.trim() || !name.trim()}>${joining ? 'Connexion…' : 'Rejoindre l\'atelier'}</button>
      </form>
      <div class="golden-rule">
        <strong>🔒 Règle d'or</strong>
        <p>Ne saisissez jamais d'information permettant d'identifier une personne accompagnée (nom, prénom, date de naissance, adresse, situation reconnaissable…). Parlez des situations de façon générale : « un résident », « une jeune accueillie ».</p>
      </div>
      <p class="muted small">Pas de compte à créer : seul votre prénom est demandé, et il n'est visible que des participants de la session. Les contenus sont supprimés au plus tard ${store.config.retentionDays} jours après la dernière activité.</p>
      <p class="small"><a href="#/formateur">Vous animez la session ? Espace formateur →</a></p>
    </div>
  </main>`;
}

export function FormateurHome() {
  const [title, setTitle] = useState('');
  const [name, setName] = useState('Formateur');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const recent = LS.get('charteia:admin-sessions') || [];
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    await createSession({ title: title.trim() || 'Formation IA en ESMS — session 2', name: name.trim() || 'Formateur', password });
    setBusy(false);
  }
  return html`<main class="center-page">
    <div class="card join-card">
      <div class="brand-big"><span class="logo" aria-hidden="true">✦</span> Espace formateur</div>
      <p class="lead">Créez une session : vous obtiendrez un code et un lien à partager aux stagiaires, ainsi qu'un tableau de bord d'animation.</p>
      <form onSubmit=${submit} class="join-form">
        <div class="field">
          <label for="f-title">Titre de l'atelier</label>
          <input id="f-title" maxlength=${LIMITS.title} placeholder="Formation IA en ESMS — session 2" value=${title} onInput=${(e) => setTitle(e.target.value)} />
        </div>
        <div class="field">
          <label for="f-name">Nom affiché</label>
          <input id="f-name" maxlength=${LIMITS.name} value=${name} onInput=${(e) => setName(e.target.value)} />
        </div>
        ${store.config.requirePassword ? html`<div class="field">
          <label for="f-pass">Mot de passe formateur</label>
          <input id="f-pass" type="password" autocomplete="current-password" value=${password} onInput=${(e) => setPassword(e.target.value)} />
        </div>` : null}
        <button class="btn big" type="submit" disabled=${busy}>${busy ? 'Création…' : 'Créer la session'}</button>
      </form>
      ${recent.length ? html`<div class="recent">
        <h2 class="h3">Sessions créées sur cet appareil</h2>
        <ul class="plain">${recent.map((r) => html`<li><a href=${`/?s=${r.code}#/animer`}><b>${r.code}</b> — ${r.title}</a> <span class="muted small">${fmtDate(r.createdAt)}</span></li>`)}</ul>
      </div>` : null}
      <p class="small"><a href="/">← Retour à l'accès participant</a></p>
    </div>
  </main>`;
}

// ================================================================ structure de page
function Header() {
  const { session: st, me, conn } = store;
  const online = st.participants.filter((p) => p.online).length;
  return html`<header class="topbar">
    <a class="brand" href="#/"><span class="logo" aria-hidden="true">✦</span><span class="brand-text">Charte IA</span></a>
    <span class="session-title" title=${st.title}>${st.title}</span>
    <span class="spacer"></span>
    <span class="conn conn-${conn}" title=${conn === 'online' ? 'Connecté' : 'Reconnexion…'}>
      <span class="dot"></span><span class="conn-text">${conn === 'online' ? `${online} en ligne` : 'Reconnexion…'}</span>
    </span>
    <button class="code-pill" title="Copier le lien d'accès" onClick=${() => copy(joinUrl(st.code), 'Lien d\'accès copié')}>Code <b>${st.code}</b></button>
    ${me.isAdmin ? html`<a class="btn small" href="#/animer">Tableau de bord</a>` : html`<span class="me-chip" title="Votre prénom">👤 ${me.name}</span>`}
  </header>`;
}

function Nav({ current }) {
  const { session: st, me } = store;
  const count = (id) => st.contributions.filter((c) => c.space === id && !c.questionId).length;
  const openQ = (id) => st.questions.some((q) => q.space === id && q.status === 'open');
  const groups = [];
  for (const s of SPACES) {
    let g = groups.find((x) => x.name === s.group);
    if (!g) { g = { name: s.group, items: [] }; groups.push(g); }
    g.items.push(s);
  }
  const idx = NAV.indexOf(current);
  return html`
    <nav class="sidenav" aria-label="Espaces de travail">
      ${me.isAdmin ? html`<a class="nav-item admin ${current === 'animer' ? 'active' : ''}" href="#/animer">🎛️ Tableau de bord</a>` : null}
      ${groups.map((g) => html`<div class="nav-group">
        <div class="nav-group-title">${g.name}</div>
        ${g.items.map((s) => html`<a class="nav-item ${current === s.id ? 'active' : ''} ${st.live.focus === s.id ? 'focused' : ''}" href=${spaceHash(s.id)}>
          <span class="nav-icon" aria-hidden="true">${s.num || s.icon}</span><span class="nav-label">${s.title}</span>
          ${openQ(s.id) ? html`<span class="nav-q" title="Question ouverte">?</span>` : null}
          ${count(s.id) ? html`<span class="nav-count">${count(s.id)}</span>` : null}
        </a>`)}
      </div>`)}
      <div class="nav-group">
        <div class="nav-group-title">Livrable</div>
        <a class="nav-item ${current === 'synthese' ? 'active' : ''}" href="#/synthese"><span class="nav-icon" aria-hidden="true">📄</span><span class="nav-label">Synthèse et export</span></a>
      </div>
    </nav>
    <div class="mobilenav">
      <button class="icon-btn" disabled=${idx <= 0} aria-label="Espace précédent" onClick=${() => go(spaceHash(NAV[idx - 1]))}>‹</button>
      <label class="sr-only" for="mnav">Aller à l'espace</label>
      <select id="mnav" value=${idx >= 0 ? current : ''} onChange=${(e) => e.target.value && go(e.target.value === 'animer' ? '#/animer' : spaceHash(e.target.value))}>
        ${idx < 0 ? html`<option value="">${current === 'animer' ? 'Tableau de bord' : '—'}</option>` : null}
        ${me.isAdmin && idx >= 0 ? html`<option value="animer">🎛️ Tableau de bord</option>` : null}
        ${NAV.map((id) => html`<option value=${id}>${navLabel(id)}${id !== 'synthese' && count(id) ? ` (${count(id)})` : ''}</option>`)}
      </select>
      <button class="icon-btn" disabled=${idx < 0 || idx >= NAV.length - 1} aria-label="Espace suivant" onClick=${() => go(spaceHash(NAV[idx + 1]))}>›</button>
    </div>`;
}

function resolveSpot(st) {
  const sp = st.live.spotlight;
  if (!sp) return null;
  if (sp.kind === 'contrib') { const c = st.contributions.find((x) => x.id === sp.id && !x.hidden); return c ? { ...sp, c } : null; }
  const q = st.questions.find((x) => x.id === sp.id);
  return q ? { ...sp, q } : null;
}

function Banners({ current }) {
  const { session: st, me } = store;
  const [dismissed, setDismissed] = useState(null);
  const spot = resolveSpot(st);
  const pending = st.questions.filter((q) => {
    if (q.status !== 'open' || q.space === current) return false;
    if (q.type === 'poll') return me.polls[q.id] === undefined;
    return !st.contributions.some((c) => c.questionId === q.id && me.mine.includes(c.id));
  });
  const showSpot = spot && dismissed !== spot.at && !(spot.c ? spot.c.space === current : spot.q.space === current);
  if (!showSpot && !pending.length) return null;
  return html`<div class="banners">
    ${showSpot ? html`<div class="banner spot" role="status">
      <span class="banner-icon" aria-hidden="true">★</span>
      <div class="banner-body"><b>Mis en avant par le formateur</b>
        <span class="banner-text">${spot.c ? `« ${spot.c.text.slice(0, 160)}${spot.c.text.length > 160 ? '…' : ''} »` : spot.q.text}</span></div>
      <a class="btn small" href=${spaceHash(spot.c ? spot.c.space : spot.q.space)}>Voir</a>
      <button class="icon-btn" aria-label="Masquer ce bandeau" onClick=${() => setDismissed(spot.at)}>✕</button>
    </div>` : null}
    ${pending.length ? html`<div class="banner question" role="status">
      <span class="banner-icon" aria-hidden="true">${pending[0].type === 'poll' ? '📊' : '❓'}</span>
      <div class="banner-body"><b>${pending.length > 1 ? `${pending.length} questions du formateur vous attendent` : 'Le formateur vous pose une question'}</b>
        <span class="banner-text">${pending[0].text}</span></div>
      <a class="btn small" href=${spaceHash(pending[0].space)}>Répondre</a>
    </div>` : null}
  </div>`;
}

export function Layout({ current, children }) {
  const { session: st } = store;
  return html`<div class="app">
    <${Header} />
    <div class="body">
      <${Nav} current=${current} />
      <main class="main" id="main">
        <${Banners} current=${current} />
        ${children}
        <footer class="footer no-print">
          <span>🔒 Aucune donnée permettant d'identifier une personne accompagnée.</span>
          <span>Données conservées ${st.retentionDays} jours maximum · <button class="link-btn" onClick=${() => confirm('Quitter la session sur cet appareil ?') && leaveSession()}>Quitter la session</button></span>
        </footer>
      </main>
    </div>
  </div>`;
}

// ================================================================ espaces de travail
function Welcome() {
  const { session: st, me } = store;
  const online = st.participants.filter((p) => p.online);
  return html`<div class="welcome-grid">
    <section class="card">
      <h2 class="h3">Bonjour ${me.name} 👋</h2>
      <p>Objectifs de cette séance :</p>
      <ol class="steps">
        <li><b>Approfondir</b> les usages de l'IA testés depuis la première session.</li>
        <li><b>Élaborer</b> ensemble un plan d'action pour intégrer l'IA dans vos structures.</li>
        <li><b>Poser les bases</b> d'une charte IA adaptée aux ESMS.</li>
      </ol>
    </section>
    <section class="card">
      <h2 class="h3">Comment participer ?</h2>
      <ul class="plain how">
        <li>🧭 Naviguez entre les espaces avec le menu${' '}<span class="muted">(ou la liste déroulante sur téléphone)</span>.</li>
        <li>✍️ Écrivez vos contributions : elles apparaissent en direct pour tout le groupe.</li>
        <li>👍 💬 ✋ Réagissez aux propositions des autres et commentez-les.</li>
        <li>❓ Répondez aux questions du formateur lorsqu'elles s'affichent.</li>
        <li>📄 Repartez avec la synthèse : brouillon de charte + plan d'action.</li>
      </ul>
    </section>
    <section class="card golden">
      <h2 class="h3">🔒 Règle d'or</h2>
      <p>Comme dans un outil d'IA, <b>ne saisissez ici aucune information permettant d'identifier une personne accompagnée</b> : ni nom, ni prénom, ni date de naissance, ni détail rendant une situation reconnaissable.</p>
      <p class="muted small">Parlez de « un résident », « une jeune accueillie », « une famille »… Vous pouvez aussi publier sans afficher votre prénom.</p>
    </section>
    <section class="card">
      <h2 class="h3">${plural(online.length, 'personne connectée', 'personnes connectées')}</h2>
      <div class="people">${online.map((p) => html`<span class="person ${p.isAdmin ? 'admin' : ''}">${p.name}${p.isAdmin ? ' · formateur' : ''}</span>`)}</div>
    </section>
  </div>`;
}

function UsagesOverview({ items }) {
  if (!items.length) return null;
  const space = SPACE_MAP.usages;
  const tools = {};
  for (const c of items) {
    const raw = (c.fields.outil || '').trim();
    const key = raw.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();
    if (!key) continue;
    tools[key] ??= { label: raw, n: 0 };
    tools[key].n++;
  }
  const top = Object.values(tools).sort((a, b) => b.n - a.n).slice(0, 8);
  return html`<section class="card overview">
    <div class="ov-item"><b class="ov-num">${items.length}</b><span>usages partagés</span></div>
    ${space.tags.options.map((t) => html`<div class="ov-item"><b class="ov-num">${items.filter((c) => c.tag === t.id).length}</b><span class="tag tag-${t.color}">${t.label}</span></div>`)}
    ${top.length ? html`<div class="ov-tools"><span class="muted small">Outils les plus cités :</span> ${top.map((t) => html`<span class="meta-chip">${t.label} <b>${t.n}</b></span>`)}</div>` : null}
  </section>`;
}

function SynthesisEditor({ space, sp }) {
  const [text, setText] = useState(sp.synthesis || '');
  const focused = useRef(false);
  const timer = useRef();
  useEffect(() => { if (!focused.current) setText(sp.synthesis || ''); }, [sp.synthesis]);
  const push = (v) => send('admin.synthesis', { space: space.id, text: v });
  const insertRetained = () => {
    const lines = store.session.contributions.filter((c) => c.space === space.id && c.retained && !c.hidden).map((c) => '• ' + c.text.replace(/\s*\n+\s*/g, ' '));
    if (!lines.length) { toast('Aucune contribution retenue dans cet espace : utilisez « Retenir pour la charte » sur les cartes.', 'warn'); return; }
    const v = (text.trim() ? text.trimEnd() + '\n' : '') + lines.join('\n');
    setText(v);
    push(v);
  };
  return html`<section class="card synth admin-only">
    <div class="synth-head">
      <div><h2 class="h3">Rédaction pour la charte</h2><p class="muted small">Consolidez ici, en direct, les propositions du groupe. Visible par tous. Commencez une ligne par « • » pour faire une liste.</p></div>
      <button class="btn-secondary small" onClick=${insertRetained}>Insérer les contributions retenues</button>
    </div>
    <label class="sr-only" for=${'syn-' + space.id}>Rédaction consolidée</label>
    <textarea id=${'syn-' + space.id} rows="6" maxlength=${LIMITS.synthesis} value=${text}
      placeholder="ex. L'IA est un outil au service de l'accompagnement : elle ne remplace jamais le jugement professionnel…"
      onFocus=${() => { focused.current = true; }}
      onBlur=${() => { focused.current = false; clearTimeout(timer.current); push(text); }}
      onInput=${(e) => { const v = e.target.value; setText(v); clearTimeout(timer.current); timer.current = setTimeout(() => push(v), 800); }}></textarea>
  </section>`;
}

// Bloc « Partager un usage testé » : après publication, propose d'en partager un autre
function UsageShare({ space }) {
  const { session: st, me } = store;
  const mine = st.contributions.filter((c) => c.space === space.id && !c.questionId && me.mine.includes(c.id));
  const [formOpen, setFormOpen] = useState(mine.length === 0);
  const [round, setRound] = useState(0); // repart d'un formulaire vierge à chaque nouvel usage
  const n = mine.length;
  const ordinal = ['premier', 'deuxième', 'troisième', 'quatrième', 'cinquième'][n] || `${n + 1}e`;
  return html`<section class="card form-card">
    <h2 class="h3">${formOpen && n ? `Partager un ${ordinal} usage testé` : space.formTitle}</h2>
    ${formOpen ? html`
      <${ContribForm} key=${round} space=${space} onDone=${() => setFormOpen(false)} />
      ${n ? html`<div class="share-cancel"><button class="link-btn" onClick=${() => setFormOpen(false)}>Annuler</button></div>` : null}
    ` : html`
      <div class="share-done">
        ${n ? html`<p>✅ Merci ! Vous avez partagé ${n > 1 ? `${n} usages` : 'un usage'} :
          ${mine.map((c, i) => html`${i ? ', ' : ' '}<b>${c.fields.outil || 'usage'}</b>`)}.</p>`
          : html`<p>✅ Merci, votre usage est partagé !</p>`}
        <p class="muted small">Vous avez testé autre chose ? Chaque usage a sa propre fiche, pour que le groupe puisse réagir à chacun.</p>
      </div>
    `}
    ${formOpen ? null : html`<button class="btn-secondary add-another" onClick=${() => { setRound((r) => r + 1); setFormOpen(true); }}>
      ＋ Partager un ${['premier', 'deuxième', 'troisième', 'quatrième', 'cinquième'][n] || 'autre'} usage
    </button>`}
  </section>`;
}

function SpaceAdmin({ space, sp }) {
  const { session: st } = store;
  const [asking, setAsking] = useState(false);
  const focused = st.live.focus === space.id;
  return html`<div class="admin-strip">
    <span class="admin-label">Animation</span>
    <button class="chip-btn ${focused ? 'on' : ''}" onClick=${() => send('admin.focus', { space: space.id }).then((r) => r && toast('Les participants sont invités sur cet espace.', 'ok'))}>
      ➜ Amener tout le monde ici${focused ? ' (actif)' : ''}</button>
    ${space.freeForm !== false ? html`<button class="chip-btn ${sp.locked ? 'on' : ''}" onClick=${() => send('admin.lock', { space: space.id, locked: !sp.locked })}>
      ${sp.locked ? '🔓 Rouvrir les contributions' : '🔒 Clore les contributions'}</button>` : null}
    <button class="chip-btn" onClick=${() => setAsking(true)}>＋ Poser une question</button>
    ${asking ? html`<${Modal} title="Nouvelle question" onClose=${() => setAsking(false)}><${QuestionCreate} defaultSpace=${space.id} onDone=${() => setAsking(false)} /><//>` : null}
  </div>`;
}

export function SpaceView({ spaceId }) {
  const { session: st, me } = store;
  const space = SPACE_MAP[spaceId];
  const sp = st.spaces[spaceId] || {};
  const [sort, setSort] = useState('recent');
  const [filter, setFilter] = useState(null);
  useEffect(() => { setFilter(null); }, [spaceId]);
  const rank = { open: 0, draft: 1, closed: 2 };
  const questions = st.questions.filter((q) => q.space === spaceId)
    .sort((a, b) => rank[a.status] - rank[b.status] || a.createdAt - b.createdAt);
  const all = st.contributions.filter((c) => c.space === spaceId && !c.questionId);
  let items = filter ? all.filter((c) => c.tag === filter) : all;
  items = [...items].sort(sort === 'recent'
    ? (a, b) => b.createdAt - a.createdAt
    : (a, b) => support(b) - support(a) || b.createdAt - a.createdAt);
  const idx = NAV.indexOf(spaceId);

  return html`<div class="space">
    <header class="space-head">
      <div class="eyebrow">${space.group}${space.num ? ` · ${space.num}/9` : ''}</div>
      <h1><span aria-hidden="true">${space.icon}</span> ${space.title}</h1>
      <p class="lead">${space.intro}</p>
      ${space.pistes?.length ? html`<details class="pistes" open>
        <summary>Pistes de réflexion</summary>
        <ul>${space.pistes.map((p) => html`<li>${p}</li>`)}</ul>
      </details>` : null}
      ${sp.locked ? html`<div class="notice">🔒 Le formateur a clos cet espace : vous pouvez lire et consulter, mais plus ajouter de contribution.</div>` : null}
    </header>
    ${me.isAdmin ? html`<${SpaceAdmin} space=${space} sp=${sp} />` : null}
    ${spaceId === 'accueil' ? questions.filter((q) => q.status === 'open').map((q) => html`<${QuestionCard} key=${q.id} q=${q} />`) : null}
    ${spaceId === 'accueil' ? html`<${Welcome} />` : null}
    ${space.kind === 'charte' && me.isAdmin ? html`<${SynthesisEditor} key=${spaceId} space=${space} sp=${sp} />` : null}
    ${space.kind === 'charte' && !me.isAdmin && sp.synthesis ? html`<section class="card synth">
      <h2 class="h3">Rédaction en cours pour la charte</h2>
      <div class="synth-text"><${RichText} text=${sp.synthesis} /></div>
    </section>` : null}
    ${questions.filter((q) => spaceId !== 'accueil' || q.status !== 'open').map((q) => html`<${QuestionCard} key=${q.id} q=${q} />`)}
    ${spaceId === 'usages' ? html`<${UsagesOverview} items=${all} />` : null}
    ${space.freeForm !== false ? html`
      ${(!sp.locked || me.isAdmin) && spaceId === 'usages' ? html`<${UsageShare} space=${space} />` : null}
      ${(!sp.locked || me.isAdmin) && spaceId !== 'usages' ? html`<details class="card form-card" open>
        <summary><h2 class="h3">${space.formTitle || 'Ajouter une contribution'}</h2></summary>
        <${ContribForm} key=${spaceId} space=${space} />
      </details>` : null}
      <div class="toolbar">
        <h2 class="h3">${plural(all.length, 'contribution', 'contributions')}</h2>
        <span class="spacer"></span>
        ${space.tags ? html`<div class="filters" role="group" aria-label="Filtrer">
          <button class="chip-btn ${!filter ? 'on' : ''}" onClick=${() => setFilter(null)}>Toutes</button>
          ${space.tags.options.map((t) => html`<button class="chip-btn ${filter === t.id ? 'on' : ''}" onClick=${() => setFilter(filter === t.id ? null : t.id)}>${t.label}</button>`)}
        </div>` : null}
        <div class="seg small" role="group" aria-label="Trier">
          <button class=${sort === 'recent' ? 'on' : ''} onClick=${() => setSort('recent')}>Récentes</button>
          <button class=${sort === 'top' ? 'on' : ''} onClick=${() => setSort('top')}>Plus soutenues</button>
        </div>
      </div>
      ${items.length ? html`<div class="grid">${items.map((c) => html`<${ContributionCard} key=${c.id} c=${c} />`)}</div>`
        : html`<p class="empty">${filter ? 'Aucune contribution avec ce filtre.' : 'Aucune contribution pour l\'instant : lancez-vous, il n\'y a pas de mauvaise idée !'}</p>`}
    ` : null}
    <div class="pager no-print">
      ${idx > 0 ? html`<a class="btn-secondary" href=${spaceHash(NAV[idx - 1])}>‹ ${navLabel(NAV[idx - 1])}</a>` : html`<span></span>`}
      ${idx < NAV.length - 1 ? html`<a class="btn-secondary" href=${spaceHash(NAV[idx + 1])}>${navLabel(NAV[idx + 1])} ›</a>` : null}
    </div>
  </div>`;
}

// ================================================================ tableau de bord formateur
export function Dashboard() {
  const { session: st, me } = store;
  const [title, setTitle] = useState(st.title);
  const [feedFilter, setFeedFilter] = useState('all');
  if (!me.isAdmin) return html`<p class="empty">Cet espace est réservé au formateur.</p>`;
  const people = st.participants.filter((p) => !p.isAdmin);
  const online = people.filter((p) => p.online);
  const adminUrl = `${location.origin}/?s=${st.code}&k=${me.adminKey}#/animer`;
  const spot = resolveSpot(st);
  const feed = [];
  for (const c of st.contributions) {
    if (feedFilter === 'all' || feedFilter === 'contrib') feed.push({ kind: 'c', at: c.createdAt, c });
    if (feedFilter === 'all' || feedFilter === 'comment') for (const m of c.comments) feed.push({ kind: 'm', at: m.createdAt, c, m });
  }
  feed.sort((a, b) => b.at - a.at);
  const rank = { open: 0, draft: 1, closed: 2 };
  const questions = [...st.questions].sort((a, b) => rank[a.status] - rank[b.status] || SPACES.findIndex((s) => s.id === a.space) - SPACES.findIndex((s) => s.id === b.space));

  return html`<div class="dashboard">
    <header class="space-head">
      <div class="eyebrow">Formateur</div>
      <h1>🎛️ Tableau de bord d'animation</h1>
    </header>
    <div class="dash-grid">
      <div class="dash-col">
        <section class="card join-share">
          <h2 class="h3">Faire rejoindre les stagiaires</h2>
          <p class="muted small">Collez ce lien dans la discussion de la visio, ou donnez le code.</p>
          <div class="big-code">${st.code}</div>
          <div class="copy-row"><input readonly value=${joinUrl(st.code)} aria-label="Lien d'accès participant" onFocus=${(e) => e.target.select()} />
            <button class="btn small" onClick=${() => copy(joinUrl(st.code), 'Lien participant copié')}>Copier</button></div>
          <div class="row-btns">
            <button class="btn-secondary" onClick=${() => window.open(`/?s=${st.code}#/projection`, 'projection-charte-ia', 'width=1280,height=800')}>🖥️ Ouvrir la vue projection</button>
          </div>
          <details class="small">
            <summary>Lien formateur (à conserver, ne pas partager)</summary>
            <p class="muted">Permet de reprendre l'animation depuis un autre appareil.</p>
            <div class="copy-row"><input readonly value=${adminUrl} aria-label="Lien formateur" onFocus=${(e) => e.target.select()} />
              <button class="btn-secondary small" onClick=${() => copy(adminUrl, 'Lien formateur copié')}>Copier</button></div>
          </details>
        </section>

        <section class="card">
          <h2 class="h3">Pilotage en direct</h2>
          <div class="kv"><span>Espace où les participants sont guidés</span>
            <div class="row-btns">
              <select aria-label="Amener les participants sur" value=${st.live.focus || ''} onChange=${(e) => send('admin.focus', { space: e.target.value || null })}>
                <option value="">— Navigation libre —</option>
                ${NAV.map((id) => html`<option value=${id}>${navLabel(id)}</option>`)}
              </select>
              ${st.live.focus ? html`<button class="chip-btn" title="Ramener les retardataires" onClick=${() => send('admin.focus', { space: st.live.focus })}>↻ Relancer</button>` : null}
            </div>
          </div>
          <div class="kv"><span>Mis en avant</span>
            ${spot ? html`<div class="row-btns"><span class="spot-preview">★ ${spot.c ? spot.c.text.slice(0, 90) : spot.q.text.slice(0, 90)}</span>
              <button class="chip-btn" onClick=${() => send('admin.spotlight', { kind: null })}>Retirer</button></div>`
              : html`<span class="muted small">Rien — utilisez « ☆ Mettre en avant » sur une carte ou une question.</span>`}
          </div>
        </section>

        <section class="card">
          <h2 class="h3">Questions et sondages</h2>
          <p class="muted small">Des questions sont préparées en brouillon : ouvrez-les au bon moment, modifiez-les ou créez les vôtres.</p>
          <details class="create-q"><summary class="btn-secondary small">＋ Nouvelle question</summary><${QuestionCreate} /></details>
          <ul class="q-list">
            ${questions.map((q) => html`<li class="q-row status-${q.status}" key=${q.id}>
              <div class="q-row-head">
                <span class="status status-${q.status}">${{ draft: 'Brouillon', open: 'Ouverte', closed: 'Close' }[q.status]}</span>
                <span class="muted small">${q.type === 'poll' ? 'Sondage' : 'Question'} · ${spaceLabel(q.space)} · ${plural(q.total, 'réponse', 'réponses')}</span>
              </div>
              <a class="q-row-text" href=${spaceHash(q.space)}>${q.text}</a>
              ${q.type === 'poll' && q.total ? html`<${PollResults} q=${q} />` : null}
              <${QuestionAdmin} q=${q} />
            </li>`)}
          </ul>
        </section>
      </div>

      <div class="dash-col">
        <section class="card">
          <h2 class="h3">Participants · ${online.length} en ligne / ${people.length}</h2>
          <div class="people">${people.length ? people.map((p) => html`<span class="person ${p.online ? 'on' : 'off'}">${p.online ? '🟢' : '⚪'} ${p.name}</span>`) : html`<span class="muted small">Personne pour l'instant : partagez le lien !</span>`}</div>
        </section>

        <section class="card">
          <h2 class="h3">Espaces</h2>
          <table class="spaces-table">
            <thead><tr><th>Espace</th><th title="Contributions">✍️</th><th title="Commentaires">💬</th><th></th></tr></thead>
            <tbody>${SPACES.map((s) => {
              const cs = st.contributions.filter((c) => c.space === s.id);
              return html`<tr class=${st.live.focus === s.id ? 'focused' : ''}>
                <td><a href=${spaceHash(s.id)}>${spaceLabel(s.id)}</a>${st.spaces[s.id]?.locked ? ' 🔒' : ''}${st.spaces[s.id]?.synthesis ? ' 📝' : ''}</td>
                <td>${cs.length}</td><td>${cs.reduce((n, c) => n + c.comments.length, 0)}</td>
                <td><button class="chip-btn" title="Amener tout le monde ici" onClick=${() => send('admin.focus', { space: s.id })}>➜</button></td>
              </tr>`;
            })}</tbody>
          </table>
        </section>

        <section class="card feed">
          <div class="toolbar">
            <h2 class="h3">Fil en direct</h2><span class="spacer"></span>
            <div class="seg small" role="group" aria-label="Filtrer le fil">
              <button class=${feedFilter === 'all' ? 'on' : ''} onClick=${() => setFeedFilter('all')}>Tout</button>
              <button class=${feedFilter === 'contrib' ? 'on' : ''} onClick=${() => setFeedFilter('contrib')}>Contributions</button>
              <button class=${feedFilter === 'comment' ? 'on' : ''} onClick=${() => setFeedFilter('comment')}>Commentaires</button>
            </div>
          </div>
          ${feed.length ? null : html`<p class="muted small">Les contributions apparaîtront ici en temps réel.</p>`}
          <ul class="feed-list">${feed.slice(0, 60).map((f) => {
            const hidden = f.kind === 'm' ? f.m.hidden : f.c.hidden;
            const isSpot = f.kind === 'c' && st.live.spotlight?.kind === 'contrib' && st.live.spotlight.id === f.c.id;
            const canRetain = f.kind === 'c' && (SPACE_MAP[f.c.space].kind === 'charte' || f.c.questionId);
            return html`<li class="feed-item ${hidden ? 'is-hidden' : ''}" key=${f.kind + (f.m?.id || f.c.id)}>
              <div class="feed-meta"><b>${(f.kind === 'm' ? f.m.author : f.c.author) || 'Anonyme'}</b> · ${fmtTime(f.at)} ·
                <a href=${spaceHash(f.c.space)}>${spaceLabel(f.c.space)}</a>${f.kind === 'm' ? ' · 💬 commentaire' : f.c.questionId ? ' · réponse' : ''}
                ${hidden ? html` <span class="tag tag-grey">masqué</span>` : null}${f.kind === 'c' && f.c.retained ? html` <span class="tag tag-retained">retenue</span>` : null}</div>
              <div class="feed-text">${f.kind === 'm' ? f.m.text : (f.c.fields.outil ? `[${f.c.fields.outil}] ` : '') + f.c.text}</div>
              <div class="feed-actions">
                ${f.kind === 'c' ? html`<button class="chip-btn ${isSpot ? 'on' : ''}" onClick=${() => send('admin.spotlight', isSpot ? { kind: null } : { kind: 'contrib', id: f.c.id })}>${isSpot ? '★' : '☆'} En avant</button>` : null}
                ${canRetain ? html`<button class="chip-btn ${f.c.retained ? 'on' : ''}" onClick=${() => send('admin.retain', { id: f.c.id, retained: !f.c.retained })}>✔ Retenir</button>` : null}
                <button class="chip-btn" onClick=${() => send('admin.hide', f.kind === 'm' ? { id: f.c.id, cid: f.m.id, hidden: !hidden } : { id: f.c.id, hidden: !hidden })}>${hidden ? 'Afficher' : 'Masquer'}</button>
              </div>
            </li>`;
          })}</ul>
        </section>

        <section class="card">
          <h2 class="h3">Session</h2>
          <form class="copy-row" onSubmit=${(e) => { e.preventDefault(); send('admin.session.rename', { title }).then((r) => r && toast('Titre mis à jour.', 'ok')); }}>
            <input aria-label="Titre de la session" maxlength=${LIMITS.title} value=${title} onInput=${(e) => setTitle(e.target.value)} />
            <button class="btn-secondary small" type="submit">Renommer</button>
          </form>
          <div class="row-btns">
            <a class="btn-secondary" href="#/synthese">📄 Synthèse et export</a>
            <button class="btn-secondary" onClick=${() => downloadFile(`atelier-charte-ia-${st.code}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), ...st, serverNow: undefined }, null, 2), 'application/json')}>Sauvegarde complète (JSON)</button>
          </div>
          <p class="muted small">Pensez à exporter la synthèse avant de supprimer la session.</p>
          <button class="btn-danger" onClick=${() => confirm('Supprimer définitivement la session et toutes les contributions ? Cette action est irréversible.') && send('admin.session.delete')}>Supprimer définitivement la session</button>
        </section>
      </div>
    </div>
  </div>`;
}

// ================================================================ vue projection (partage d'écran)
export function Projection() {
  const { session: st } = store;
  const spot = resolveSpot(st);
  const focusId = st.live.focus && SPACE_MAP[st.live.focus] ? st.live.focus : null;
  const online = st.participants.filter((p) => p.online && !p.isAdmin);
  let body;
  if (spot?.c) {
    const c = spot.c;
    body = html`<div class="proj-spot">
      <div class="eyebrow">★ Contribution mise en avant · ${spaceLabel(c.space)}</div>
      ${c.fields.outil ? html`<div class="proj-sub">${c.fields.outil}</div>` : null}
      <blockquote>${c.text}</blockquote>
      ${['fonctionne', 'limites', 'vigilance'].filter((k) => c.fields[k]).map((k) => html`<p class="proj-detail"><b>${SPACE_MAP.usages.form.find((f) => f.id === k).label} :</b> ${c.fields[k]}</p>`)}
      <div class="proj-meta">${c.author || 'Anonyme'} · ${voteSummary(c)}${c.comments.length ? ` · 💬 ${c.comments.length}` : ''}</div>
      ${c.comments.filter((m) => !m.hidden).slice(-4).map((m) => html`<p class="proj-comment"><b>${m.author || 'Anonyme'} :</b> ${m.text}</p>`)}
    </div>`;
  } else if (spot?.q) {
    body = html`<${ProjQuestion} q=${spot.q} />`;
  } else if (focusId) {
    const space = SPACE_MAP[focusId];
    const openQ = st.questions.filter((q) => q.space === focusId && q.status === 'open');
    const top = st.contributions.filter((c) => c.space === focusId && !c.questionId && !c.hidden)
      .sort((a, b) => support(b) - support(a) || b.createdAt - a.createdAt).slice(0, 9);
    body = html`<div>
      <h1 class="proj-title"><span aria-hidden="true">${space.icon}</span> ${space.num ? space.num + '. ' : ''}${space.title}</h1>
      ${openQ.map((q) => html`<${ProjQuestion} q=${q} />`)}
      ${top.length ? html`<div class="proj-grid">${top.map((c) => html`<div class="proj-card">
        <${Tag} space=${space} id=${c.tag} />
        ${c.fields.outil ? html`<div class="proj-sub small">${c.fields.outil}</div>` : null}
        <p>${c.text.length > 260 ? c.text.slice(0, 260) + '…' : c.text}</p>
        <div class="proj-meta small">${c.author || 'Anonyme'} · ${voteSummary(c)}</div>
      </div>`)}</div>` : openQ.length ? null : html`<p class="proj-empty">Les contributions apparaîtront ici en direct.</p>`}
    </div>`;
  } else {
    body = html`<div class="proj-welcome">
      <h1>${st.title}</h1>
      <p>Rejoignez l'atelier depuis votre ordinateur ou votre téléphone :</p>
      <div class="proj-url">${location.host}/?s=${st.code}</div>
      <p>Code de session</p>
      <div class="big-code huge">${st.code}</div>
      <div class="people center">${online.map((p) => html`<span class="person">${p.name}</span>`)}</div>
    </div>`;
  }
  return html`<div class="projection">
    <header class="proj-head">
      <span class="brand"><span class="logo" aria-hidden="true">✦</span> Charte IA</span>
      <span>Rejoindre : <b>${location.host}/?s=${st.code}</b> · code <b class="code">${st.code}</b></span>
      <span>${plural(online.length, 'participant', 'participants')} en ligne</span>
    </header>
    <main class="proj-body">${body}</main>
    <footer class="proj-foot">🔒 Aucune donnée permettant d'identifier une personne accompagnée</footer>
  </div>`;
}

function ProjQuestion({ q }) {
  const answers = store.session.contributions.filter((c) => c.questionId === q.id && !c.hidden);
  return html`<section class="proj-question">
    <div class="eyebrow">${q.type === 'poll' ? '📊 Sondage' : '❓ Question'} · ${spaceLabel(q.space)}${q.status === 'closed' ? ' · clos' : ''}</div>
    <h2>${q.text}</h2>
    ${q.type === 'poll' ? html`<${PollResults} q=${q} big />` : html`<div class="proj-wall">
      ${answers.length ? answers.slice().sort((a, b) => support(b) - support(a) || b.createdAt - a.createdAt).slice(0, 24)
        .map((c) => html`<span class="proj-answer">${c.text}${c.votes.up ? html` <b>👍 ${c.votes.up}</b>` : null}</span>`)
        : html`<p class="proj-empty">En attente des réponses…</p>`}
    </div>`}
  </section>`;
}

// ================================================================ synthèse & export
function PollBlock({ polls }) {
  return polls.map(({ q, rows }) => html`<div class="doc-poll">
    <h4>Sondage — ${q.text} <span class="muted">(${plural(q.total, 'réponse', 'réponses')})</span></h4>
    <ul>${rows.map((r) => html`<li>${r.label} : <b>${r.pct} %</b> (${r.n})</li>`)}</ul>
  </div>`);
}

export function Synthesis() {
  const { session: st, me } = store;
  const anyRetained = st.contributions.some((c) => c.retained && !c.hidden);
  const [includeAll, setIncludeAll] = useState(!anyRetained);
  const docRef = useRef();
  const model = buildModel(st, includeAll);
  const dateStr = fmtDate(st.createdAt);
  const base = `charte-ia-${st.code}-${new Date().toISOString().slice(0, 10)}`;
  const label = (space, c) => {
    const t = space.tags?.options.find((o) => o.id === c.tag);
    return t ? html`<b>[${t.label}]</b> ` : null;
  };

  return html`<div class="synthesis">
    <header class="space-head no-print">
      <div class="eyebrow">Livrable</div>
      <h1>📄 Synthèse et export</h1>
      <p class="lead">Brouillon de charte, usages partagés et plan d'action, mis à jour en direct. Téléchargez-le à la fin de la séance pour le retravailler dans votre structure.</p>
    </header>
    <div class="card export-bar no-print">
      <label class="check"><input type="checkbox" checked=${includeAll} onChange=${(e) => setIncludeAll(e.target.checked)} /> Inclure toutes les contributions (pas seulement celles retenues par le formateur)</label>
      <div class="row-btns">
        <button class="btn" onClick=${() => downloadWord(docRef.current, base + '.doc')}>⬇ Word</button>
        <button class="btn-secondary" onClick=${() => window.print()}>🖨️ Imprimer / PDF</button>
        <button class="btn-secondary" onClick=${() => downloadFile(base + '.md', buildMarkdown(model, dateStr), 'text/markdown;charset=utf-8')}>⬇ Markdown</button>
      </div>
      ${me.isAdmin && !anyRetained ? html`<p class="muted small">Astuce formateur : utilisez « Retenir pour la charte » sur les cartes et la zone « Rédaction pour la charte » de chaque espace pour consolider le brouillon.</p>` : null}
    </div>

    <article class="doc card" ref=${docRef}>
      <h1>Charte d'usage de l'intelligence artificielle — bases de travail</h1>
      <p class="muted">${st.title} — ${dateStr}</p>
      <p class="doc-note">Document de travail issu d'un atelier collaboratif. À compléter, adapter et faire valider par les instances de la structure (direction, CSE, CVS…) avant diffusion.</p>

      ${model.start.polls.length || model.start.answers.length ? html`<h2>Point de départ du groupe</h2>
        <${PollBlock} polls=${model.start.polls} />
        ${model.start.answers.map(({ q, items }) => html`<h4>${q.text}</h4><ul>${groupTexts(items).map((g) => html`<li>${withCount(g)}</li>`)}</ul>`)}` : null}

      <h2>Partie 1 — Bases de la charte</h2>
      ${model.charte.map((s) => html`<section>
        <h3>${s.space.num}. ${s.space.title}</h3>
        ${s.synthesis ? html`<div class="doc-synth"><${RichText} text=${s.synthesis} /></div>` : null}
        ${s.retained.length ? html`<h4>Propositions retenues par le groupe</h4>
          <ul>${s.retained.map((c) => html`<li>${label(s.space, c)}${c.text}</li>`)}</ul>` : null}
        <${PollBlock} polls=${s.polls} />
        ${s.others.length ? html`<h4>Autres contributions</h4>
          <ul>${s.others.map((c) => html`<li>${label(s.space, c)}${c.text} <span class="muted">(${voteSummary(c)})</span></li>`)}</ul>` : null}
        ${s.answers.map(({ q, items }) => html`<h4>Réponses à « ${q.text} »</h4><ul>${groupTexts(items).map((g) => html`<li>${withCount(g)}</li>`)}</ul>`)}
        ${!s.synthesis && !s.retained.length && !s.others.length && !s.polls.length && !s.answers.length ? html`<p class="muted"><i>À construire.</i></p>` : null}
      </section>`)}

      <h2>Partie 2 — Usages de l'IA testés par le groupe</h2>
      ${model.usages.length ? html`<div class="table-wrap"><table>
        <thead><tr><th>Outil</th><th>Usage</th><th>Cadre</th><th>Ce qui a fonctionné</th><th>Limites</th><th>Vigilance</th><th>Bilan</th></tr></thead>
        <tbody>${model.usages.map((u) => html`<tr><td><b>${u.outil}</b></td><td>${u.usage}</td><td>${u.cadre}</td><td>${u.fonctionne}</td><td>${u.limites}</td><td>${u.vigilance}</td><td>${u.bilan}</td></tr>`)}</tbody>
      </table></div>` : html`<p class="muted"><i>Aucun usage partagé.</i></p>`}
      <${PollBlock} polls=${model.usagesExtra.polls} />

      <h2>Partie 3 — Plan d'action</h2>
      ${model.actions.length ? html`<div class="table-wrap"><table>
        <thead><tr><th>Priorité</th><th>Action</th><th>Axe</th><th>Porteur</th><th>Échéance</th><th title="Soutiens">⭐</th></tr></thead>
        <tbody>${model.actions.map((a) => html`<tr><td>${a.priorite}</td><td>${a.action}</td><td>${a.axe}</td><td>${a.porteur}</td><td>${a.echeance}</td><td>${a.soutiens}</td></tr>`)}</tbody>
      </table></div>` : html`<p class="muted"><i>Aucune action proposée.</i></p>`}
      <${PollBlock} polls=${model.planExtra.polls} />
    </article>
  </div>`;
}
