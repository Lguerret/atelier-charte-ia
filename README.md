# Atelier Charte IA

Espace de travail collaboratif **en temps réel** pour la session 2 (visio) de la formation « Intégrer l'IA en ESMS » :
mise en commun des usages testés, co-construction des bases d'une charte IA, plan d'action, synthèse exportable.

- **Participants** : un lien ou un code + un prénom. Pas de compte. Ordinateur ou téléphone.
- **Formateur** : tableau de bord d'animation (questions et sondages, guidage du groupe, mise en avant, modération, vue projection).
- **Livrable** : brouillon de charte + usages + plan d'action, à télécharger en Word, PDF (impression) ou Markdown.

---

## 1. Lancer en local (2 minutes)

Prérequis : [Node.js](https://nodejs.org) 18 ou plus récent.

**Le plus simple (Windows)** : double-cliquez sur **`demarrer.cmd`**. Il installe les dépendances la première fois, lance le serveur et ouvre l'espace formateur. **Laissez la fenêtre ouverte** : la fermer arrête l'application.

En ligne de commande :

```powershell
cd atelier-charte-ia
npm.cmd install
node server.js
```

> Sous PowerShell, `npm` peut être bloqué (« l'exécution de scripts est désactivée sur ce système ») : utilisez `npm.cmd` à la place, et `node server.js` pour lancer.

Ouvrez <http://localhost:3210/#/formateur>, créez la session, puis partagez le lien affiché.

> En local, seuls les appareils de votre réseau peuvent se connecter. Pour une visio, déployez l'application (section 3).

## 2. Déroulé conseillé pendant la visio

1. **Avant la séance** (10 min avant) : ouvrez `/#/formateur`, créez la session. Notez le **lien formateur** (tableau de bord → « Lien formateur ») pour pouvoir reprendre depuis un autre appareil.
2. **Accueil** : collez le lien participant dans la discussion de la visio. Ouvrez la **vue projection** (bouton du tableau de bord) et partagez cette fenêtre : elle affiche le code, puis suit automatiquement l'espace où vous guidez le groupe.
3. **Brise-glace** : ouvrez les questions préparées de l'Accueil (sondage « fréquence d'usage », question « en un mot »).
4. **Usages testés** : « ➜ Amener tout le monde ici ». Chacun remplit une fiche (outil, usage, ce qui a marché, limites, vigilance, bilan). Mettez en avant une fiche pour l'approfondir à l'oral ; les autres réagissent (💡 utile chez nous / 🙋 testé aussi) et commentent.
5. **Charte** (9 espaces) : guidez le groupe d'espace en espace selon votre temps. Les contributions se votent (👍 d'accord / 💬 à discuter / ✋ pas d'accord). Pour consolider :
   - « Retenir pour la charte » sur les propositions validées par le groupe ;
   - zone **Rédaction pour la charte** : rédigez en direct, visible par tous (bouton « Insérer les contributions retenues »).
   - « 🔒 Clore les contributions » quand l'espace est terminé.
6. **Plan d'action** : chacun propose des actions (priorité, porteur, échéance) et vote ⭐ pour les prioritaires.
7. **Synthèse** : amenez le groupe sur « Synthèse et export » ; chacun télécharge le document (Word / PDF / Markdown).
8. **Après** : « Sauvegarde complète (JSON) » puis, si vous le souhaitez, « Supprimer définitivement la session ».

12 questions sont **préparées en brouillon** dans chaque nouvelle session (une ou deux par espace) : ouvrez-les d'un clic, supprimez celles qui ne servent pas, ou créez les vôtres (question ouverte ou sondage) depuis n'importe quel espace.

## 3. Déployer (accès depuis Internet)

L'application est un **unique serveur Node.js**. Les données sont enregistrées dans une base PostgreSQL si `DATABASE_URL` est défini, sinon dans un fichier JSON. Tout hébergeur Node avec WebSockets convient.

### Option A — Render (le plus simple, offre gratuite)
1. Déposez le dossier `atelier-charte-ia` dans un dépôt GitHub.
2. Sur [render.com](https://render.com) : *New → Blueprint*, choisissez le dépôt (le fichier `render.yaml` est fourni).
3. Renseignez `ADMIN_PASSWORD` (mot de passe pour créer des sessions). Le Blueprint crée aussi une base PostgreSQL gratuite reliée au service.
4. L'adresse `https://<nom>.onrender.com` est prête.

⚠️ Offre gratuite : le service **s'endort après 15 min d'inactivité** (réveil ~1 min) → ouvrez la page 10 min avant la séance. Grâce à la base PostgreSQL, les sessions **survivent** aux mises en veille et redémarrages. La base gratuite de Render **expire 30 jours après sa création** : exportez la synthèse avant, ou passez la base en offre payante.

**Restaurer une session** : si une session a disparu, ouvrez `#/formateur` et choisissez le fichier « Sauvegarde complète (JSON) » téléchargé depuis son tableau de bord. Elle reprend avec le même code. Limites : les participants ne peuvent plus modifier leurs anciennes contributions (le formateur, si), et les votes sont restaurés en nombre seulement.

### Option B — Hébergeur français / UE (recommandé pour la conformité RGPD)
Scalingo, Clever Cloud ou Alwaysdata hébergent du Node.js en France (vérifiez le support WebSocket de l'offre choisie). Le `Procfile` fourni (`web: npm start`) suffit généralement ; le port est lu dans la variable `PORT`. Pour conserver les données entre redémarrages, rattachez un volume et pointez `DATA_FILE` dessus.

### Option C — Serveur ou VPS
```powershell
npm install --omit=dev
$env:ADMIN_PASSWORD = "votre-mot-de-passe"; npm start
```
Placez-le derrière un proxy HTTPS (Caddy, Nginx) qui transmet les WebSockets.

### Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3210` | Port d'écoute |
| `ADMIN_PASSWORD` | *(vide)* | Si défini, exigé pour **créer** une session. Recommandé en ligne. |
| `RETENTION_DAYS` | `30` | Suppression automatique des sessions inactives depuis N jours |
| `PERSIST` | `true` | `false` = tout en mémoire, rien sur disque |
| `DATA_FILE` | `data/sessions.json` | Fichier de sauvegarde (si pas de base) |
| `DATABASE_URL` | *(vide)* | Base PostgreSQL : les sessions survivent aux redémarrages |

## 4. Données et confidentialité

- **Collecte minimale** : seuls un prénom (ou pseudonyme) et les contributions sont stockés. Pas d'e-mail, pas de compte, pas d'adresse IP enregistrée, pas de traceur ni de service tiers (aucune ressource externe chargée).
- **Option « Publier sans mon prénom »** sur chaque contribution et commentaire.
- **Rappel permanent** de la règle d'or (aucune donnée sur les personnes accompagnées) sur l'écran d'accès, l'accueil, sous chaque formulaire et en pied de page.
- **Garde-fou automatique** : avant publication, le texte est analysé ; s'il ressemble à un nom (« M. Dupont »), une date de naissance, un n° de sécurité sociale, un téléphone, un e-mail ou une adresse, le participant est invité à corriger. Ce filtre est une aide, pas une garantie.
- **Modération** : le formateur peut masquer ou supprimer toute contribution ou commentaire.
- **Durée de conservation** : suppression automatique après `RETENTION_DAYS` jours d'inactivité, ou immédiate par le formateur.
- L'identité de l'appareil (identifiant aléatoire + prénom) est gardée dans le navigateur (`localStorage`) pour retrouver ses contributions après rechargement.

## 5. Adapter le contenu

Tout le contenu métier est dans **`public/js/config.js`** : titres et textes des espaces, pistes de réflexion, champs des formulaires, étiquettes, réactions, questions préparées. Modifiez puis redémarrez le serveur.

Les 9 espaces de la charte s'inspirent de la trame fournie (valeurs et principes, cadre opérationnel, gouvernance) et des enjeux propres aux ESMS :
1. Finalités et périmètre · 2. Valeurs et principes éthiques · 3. Usages autorisés, encadrés, interdits · 4. Protection des données des personnes accompagnées · 5. Choix des outils et usages non déclarés · 6. Information et droits des personnes accompagnées · 7. Rôles et responsabilités · 8. Formation et accompagnement des équipes · 9. Gouvernance, suivi et incidents.

## 6. Architecture

```
atelier-charte-ia/
├─ server.js            Express + Socket.IO : sessions, droits, diffusion temps réel, sauvegarde JSON
├─ public/
│  ├─ index.html
│  ├─ style.css
│  └─ js/
│     ├─ config.js      contenu de l'atelier (partagé serveur / navigateur)
│     ├─ store.js       état local, connexion temps réel, navigation
│     ├─ ui.js          composants (formulaires, cartes, questions)
│     ├─ views.js       écrans (accès, espaces, tableau de bord, projection, synthèse)
│     ├─ export.js      synthèse, export Word / Markdown
│     └─ privacy.js     détection de données identifiantes
└─ scripts/simulate.js  simulateur de participants (test de charge / démo)
```

- Interface : Preact + htm servis localement (aucun outil de build, aucun CDN).
- Temps réel : le serveur regroupe les changements (150 ms) et renvoie l'état de la session à chaque participant, compressé. Reconnexion automatique (téléphone en veille, Wi-Fi instable) sans perte d'identité.
- Droits : la clé formateur (aléatoire) n'est jamais transmise aux participants ; les identifiants internes des participants ne sont jamais diffusés.

### Tester avec des participants simulés
Créez une session, ouvrez quelques questions, puis :
```powershell
npm.cmd run simulate -- CODE 20 http://localhost:3210
```
(Test réalisé : 20 participants simultanés, 40 contributions et ~280 mises à jour diffusées en 5 s, sans erreur.)

## 7. Limites connues (prototype)

- Un seul processus serveur : adapté à quelques dizaines de participants simultanés, pas à des centaines.
- L'export « Word » est un fichier `.doc` (HTML) : Word peut afficher un avertissement de format à l'ouverture, cliquez « Oui ».
- Pas d'historique des modifications ; la « Rédaction pour la charte » est éditée par le formateur seul (dernier enregistrement gagnant).
