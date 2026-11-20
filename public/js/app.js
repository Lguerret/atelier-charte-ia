// Point d'entrée de l'application
import { html, render } from '/vendor/preact-htm.js';
import { store, setStore, useStore, useRoute, doJoin, LS, identKey } from './store.js';
import { JoinScreen, FormateurHome, Layout, SpaceView, Dashboard, Projection, Synthesis } from './views.js';

function Toasts() {
  return html`<div class="toasts" aria-live="polite">
    ${store.toasts.map((t) => html`<div class="toast toast-${t.kind}" key=${t.id}>${t.text}</div>`)}
  </div>`;
}

function App() {
  useStore();
  const route = useRoute();
  let page;
  if (!store.joined || !store.session) {
    if (store.joining) page = html`<main class="center-page"><p class="loading">Connexion à la session…</p></main>`;
    else page = route.view === 'formateur' ? html`<${FormateurHome} />` : html`<${JoinScreen} />`;
  } else if (route.view === 'projection') {
    page = html`<${Projection} />`;
  } else {
    const current = route.view === 'space' ? route.space : route.view === 'formateur' ? 'accueil' : route.view;
    let view;
    if (route.view === 'animer') view = html`<${Dashboard} />`;
    else if (route.view === 'synthese') view = html`<${Synthesis} />`;
    else view = html`<${SpaceView} spaceId=${route.view === 'space' ? route.space : 'accueil'} />`;
    page = html`<${Layout} current=${current}>${view}<//>`;
  }
  return html`${page}<${Toasts} />`;
}

// ---- démarrage
fetch('/api/config').then((r) => r.json()).then((config) => setStore({ config })).catch(() => {});

const params = new URLSearchParams(location.search);
const code = (params.get('s') || '').toUpperCase();
const key = params.get('k');
if (code && key) {
  // lien formateur : on mémorise la clé sur cet appareil puis on la retire de l'URL
  LS.set(identKey(code), { ...(LS.get(identKey(code)) || {}), adminKey: key });
  params.delete('k');
  history.replaceState(null, '', location.pathname + '?' + params.toString() + location.hash);
}
if (code) {
  const id = LS.get(identKey(code));
  if (id?.pid || id?.adminKey) {
    doJoin({ code, pid: id.pid, name: id.name || (id.adminKey ? 'Formateur' : ''), adminKey: id.adminKey });
  }
}

const root = document.getElementById('app');
root.textContent = '';
render(html`<${App} />`, root);
