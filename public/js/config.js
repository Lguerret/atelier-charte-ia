// Configuration partagée entre le serveur (Node) et le navigateur.
// Pour adapter l'atelier (titres, pistes de réflexion, questions préparées),
// il suffit de modifier ce fichier puis de redémarrer le serveur.

export const LIMITS = {
  name: 30,          // prénom
  title: 120,        // titre de session
  short: 120,        // champ court (outil, porteur, échéance…)
  text: 1500,        // contribution
  comment: 600,      // commentaire
  synthesis: 10000,  // rédaction consolidée par le formateur
  question: 300,     // texte d'une question
  option: 100,       // option de sondage
  options: 8,        // nombre max d'options
  contributions: 3000,
  comments: 100,     // par contribution
};

// Jeux de réactions disponibles selon l'espace
export const VOTE_SETS = {
  accord: {
    exclusive: true,
    options: [
      { id: 'up', icon: '👍', label: "D'accord" },
      { id: 'mid', icon: '💬', label: 'À discuter' },
      { id: 'down', icon: '✋', label: "Pas d'accord" },
    ],
  },
  usage: {
    exclusive: false,
    options: [
      { id: 'up', icon: '💡', label: 'Utile chez nous' },
      { id: 'same', icon: '🙋', label: 'Testé aussi' },
    ],
  },
  plan: {
    exclusive: false,
    options: [{ id: 'up', icon: '⭐', label: 'Prioritaire' }],
  },
  answer: {
    exclusive: false,
    options: [{ id: 'up', icon: '👍', label: 'Je partage' }],
  },
};

const TAGS_CHARTE = {
  label: 'Type de contribution',
  options: [
    { id: 'proposition', label: 'Proposition de règle', color: 'blue' },
    { id: 'vigilance', label: 'Point de vigilance', color: 'orange' },
    { id: 'question', label: 'Question ouverte', color: 'violet' },
  ],
};

const FORM_CHARTE = [
  {
    id: 'text', label: 'Votre contribution', type: 'textarea', rows: 3, required: true,
    placeholder: 'Une règle, un principe, un exemple, une question…',
  },
];

const charte = (num, id, icon, title, intro, pistes, extra = {}) => ({
  id, num, icon, title, intro, pistes,
  kind: 'charte', group: 'Bases de la charte IA', votes: 'accord',
  form: FORM_CHARTE, tags: TAGS_CHARTE, ...extra,
});

export const SPACES = [
  {
    id: 'accueil', kind: 'accueil', group: 'Démarrage', icon: '👋', title: 'Accueil',
    intro: "Bienvenue dans l'espace de travail collaboratif de la session. Tout ce que vous écrivez ici est visible par le groupe et par le formateur, en direct.",
    pistes: [], votes: 'accord', freeForm: false, form: [], tags: null,
  },
  {
    id: 'usages', kind: 'usages', group: 'Démarrage', icon: '🧪', title: 'Usages testés',
    intro: "Partagez ce que vous avez expérimenté avec l'IA depuis la première session : l'outil, ce que vous lui avez demandé, ce qui a fonctionné, les limites et les points de vigilance. Il n'y a pas de « mauvais » retour : les échecs sont aussi instructifs que les réussites.",
    pistes: [
      "Quelle tâche avez-vous confiée à l'IA ? Pourquoi celle-ci ?",
      "Le résultat était-il utilisable tel quel, à retravailler, ou inutilisable ?",
      'Combien de temps cela vous a-t-il pris (ou fait gagner) ?',
      "Avez-vous dû retirer des informations avant de les saisir ? Comment avez-vous fait ?",
      "Qu'est-ce qui vous a surpris, gêné ou inquiété ?",
    ],
    votes: 'usage', formTitle: 'Partager un usage testé', titleField: 'outil',
    form: [
      { id: 'outil', label: 'Outil utilisé', type: 'text', required: true, placeholder: 'ex. Le Chat (Mistral), Copilot, ChatGPT, outil métier…' },
      { id: 'text', label: 'Ce que vous avez fait avec', type: 'textarea', rows: 2, required: true, placeholder: "ex. reformuler une note d'information destinée aux familles" },
      {
        id: 'perimetre', label: 'Dans quel cadre ?', type: 'select', options: [
          { id: 'support', label: 'Fonctions support / administratives' },
          { id: 'accompagnement', label: 'Accompagnement des personnes' },
          { id: 'organisation', label: 'Organisation personnelle du travail' },
        ],
      },
      { id: 'fonctionne', label: 'Ce qui a bien fonctionné', type: 'textarea', rows: 2, placeholder: 'Gain de temps, qualité, idées…' },
      { id: 'limites', label: 'Limites, difficultés', type: 'textarea', rows: 2, placeholder: 'Erreurs, résultats génériques, temps de vérification…' },
      { id: 'vigilance', label: 'Points de vigilance', type: 'textarea', rows: 2, placeholder: 'Données, éthique, fiabilité, dépendance…' },
    ],
    tags: {
      label: 'Votre bilan',
      options: [
        { id: 'developper', label: 'À développer', color: 'green' },
        { id: 'encadrer', label: 'À encadrer', color: 'orange' },
        { id: 'abandonner', label: 'Pas convaincant', color: 'grey' },
      ],
    },
  },
  charte(1, 'finalites', '🎯', 'Finalités et périmètre',
    "Pourquoi se doter d'une charte IA, à qui s'applique-t-elle et quels outils couvre-t-elle ?",
    [
      "Qu'attendons-nous de l'IA dans notre structure ? Qu'est-ce que nous voulons absolument éviter ?",
      "À qui la charte s'applique-t-elle : salariés, bénévoles, stagiaires, intervenants extérieurs ?",
      'Quels outils sont concernés : IA générative grand public, fonctions IA intégrées aux logiciels métiers, objets connectés… ?',
      "Comment s'articule-t-elle avec le projet d'établissement, le règlement intérieur, la charte informatique ?",
    ]),
  charte(2, 'valeurs', '🤝', 'Valeurs et principes éthiques',
    "L'IA doit rester au service de l'accompagnement humain, jamais s'y substituer. Quels principes non négociables voulons-nous poser ?",
    [
      'Dignité de la personne accompagnée et primauté du lien humain.',
      "Supervision humaine : aucune décision automatisée sur l'orientation, l'évaluation ou les droits d'une personne.",
      'Non-discrimination : comment rester vigilant face aux biais des outils ?',
      'Sobriété numérique : quels usages ne valent pas leur coût environnemental ?',
      'Quelle phrase voudriez-vous lire en tête de votre charte ?',
    ]),
  charte(3, 'perimetre', '🚦', 'Usages autorisés, encadrés, interdits',
    "Distinguer ce qui est permis librement, ce qui l'est sous conditions, et ce qui est exclu — en séparant fonctions support et accompagnement des personnes.",
    [
      'Fonctions support (plannings, communication, rédaction administrative…) : quels usages vous semblent acceptables ?',
      "Accompagnement (comptes rendus, synthèses, écrits professionnels) : à quelles conditions — pseudonymisation, relecture, traçabilité ?",
      "Quels usages doivent être strictement interdits (décision d'orientation automatisée, évaluation automatique d'une personne, préconisation médicale…) ?",
      'Ressources humaines : quelle place pour l\'IA dans le recrutement ou la gestion des équipes ?',
    ],
    {
      form: [
        { id: 'text', label: 'Usage concerné et règle proposée', type: 'textarea', rows: 3, required: true, placeholder: "ex. Rédiger un compte rendu d'entretien : autorisé uniquement après pseudonymisation et relecture par le professionnel." },
        {
          id: 'domaine', label: 'Domaine', type: 'select', options: [
            { id: 'support', label: 'Fonctions support / administratives' },
            { id: 'accompagnement', label: 'Accompagnement des personnes' },
            { id: 'rh', label: 'Ressources humaines' },
          ],
        },
      ],
      tags: {
        label: 'Position proposée',
        options: [
          { id: 'autorise', label: 'Autorisé', color: 'green' },
          { id: 'encadre', label: 'Sous conditions', color: 'orange' },
          { id: 'interdit', label: 'Interdit', color: 'red' },
        ],
      },
    }),
  charte(4, 'donnees', '🔒', 'Protection des données des personnes accompagnées',
    'Données de santé, de handicap, de protection de l\'enfance : un régime de protection renforcé. Quelles règles concrètes pour les professionnels ?',
    [
      "Quelles données ne doivent jamais être saisies dans un outil d'IA non validé par la structure ?",
      'Comment pseudonymiser concrètement un écrit avant de l\'utiliser avec une IA ?',
      "Quel rôle pour le délégué à la protection des données (DPO) ? Quand une analyse d'impact est-elle nécessaire ?",
      "Que faire si une donnée a été saisie par erreur ?",
    ]),
  charte(5, 'outils', '🧰', 'Choix des outils et usages non déclarés',
    "Beaucoup de professionnels utilisent déjà l'IA sans le dire (« IA de l'ombre »). Comment cadrer plutôt qu'interdire, et quels outils retenir ?",
    [
      'Comment reconnaître les usages existants sans les sanctionner, pour mieux les accompagner ?',
      "Quels critères pour valider un outil : hébergement dans l'UE, données non réutilisées pour l'entraînement, sécurité, coût, impact environnemental ?",
      'Qui valide un nouvel outil, et selon quelle procédure (test, avis du DPO, décision de la direction) ?',
      'Comptes personnels ou comptes fournis par la structure ?',
    ]),
  charte(6, 'droits', '🗣️', 'Information et droits des personnes accompagnées',
    "Les personnes accompagnées et leurs proches doivent être informés de manière claire et accessible. Comment garantir transparence et droit d'opposition ?",
    [
      "Comment informer les personnes et leurs familles de l'usage de l'IA (livret d'accueil, supports en FALC…) ?",
      "Comment garantir le droit de refuser l'usage de l'IA pour les documents qui les concernent ?",
      'Quelle place pour le Conseil de la vie sociale (CVS) ?',
      "Comment accompagner les personnes dans leurs propres usages de l'IA (désinformation, arnaques, isolement) ?",
    ]),
  charte(7, 'responsabilites', '🧭', 'Rôles et responsabilités',
    "Le professionnel reste responsable de ce qu'il produit avec l'IA. Qui fait quoi dans la structure ?",
    [
      "Comment formuler la responsabilité du professionnel sur les contenus produits avec l'IA ?",
      'Faut-il un référent IA ? Avec quelles missions et quel temps dédié ?',
      "Quel rôle pour la direction, l'encadrement, le DPO, un comité d'éthique ?",
      "Faut-il signaler qu'un écrit a été préparé avec l'aide d'une IA ? Comment ?",
    ]),
  charte(8, 'formation', '🎓', 'Formation et accompagnement des équipes',
    'Une charte ne vit que si les équipes sont formées et accompagnées. De quoi avons-nous besoin ?',
    [
      'Quel socle commun pour tous (opportunités, limites, risques, règles de la charte) ?',
      'Quels besoins de prise en main pratique (rédiger une requête, vérifier un résultat, pseudonymiser) ?',
      'Comment partager les bonnes pratiques entre équipes (temps d\'échange, fiches, ambassadeurs) ?',
      "Comment ne laisser personne de côté, quelle que soit son aisance avec le numérique ?",
    ]),
  charte(9, 'suivi', '📈', 'Gouvernance, suivi et incidents',
    'Faire vivre la charte dans le temps : évaluation, révision, signalement des incidents.',
    [
      'Qui fait vivre la charte, et à quel rythme est-elle révisée ?',
      'Quels indicateurs simples suivre (professionnels formés, outils validés, incidents…) ?',
      'Comment signaler un incident ou un doute, sans crainte ?',
      'Comment associer les instances (CSE, CVS, conseil d\'administration) ?',
    ]),
  {
    id: 'plan', kind: 'plan', group: "Plan d'action", icon: '🗺️', title: "Plan d'action",
    intro: "Quelles actions concrètes pour intégrer l'IA dans votre structure ? Proposez des actions, précisez la priorité, le porteur (une fonction plutôt qu'un nom) et l'échéance. Votez ⭐ pour les actions qui vous semblent prioritaires.",
    pistes: [
      'Quelle première action pourrait être lancée dans le mois qui vient ?',
      'Qui doit porter la démarche, et avec quel soutien ?',
      'Quels usages pilotes tester, sur quel périmètre, avec quel bilan ?',
      'Comment associer les équipes, les personnes accompagnées et les instances ?',
    ],
    votes: 'plan', formTitle: 'Proposer une action',
    form: [
      { id: 'text', label: 'Action à mener', type: 'textarea', rows: 2, required: true, placeholder: 'ex. Désigner un référent IA et lui dédier du temps' },
      {
        id: 'axe', label: 'Axe', type: 'select', options: [
          { id: 'gouvernance', label: 'Gouvernance et pilotage' },
          { id: 'charte', label: 'Rédaction et validation de la charte' },
          { id: 'formation', label: 'Formation et sensibilisation' },
          { id: 'outils', label: 'Choix et sécurisation des outils' },
          { id: 'donnees', label: 'Protection des données' },
          { id: 'information', label: 'Information des personnes accompagnées' },
          { id: 'pilotes', label: 'Usages pilotes' },
          { id: 'autre', label: 'Autres' },
        ],
      },
      { id: 'responsable', label: 'Porteur (fonction)', type: 'text', placeholder: 'ex. Direction, cadre de service, référent IA' },
      { id: 'echeance', label: 'Échéance', type: 'text', placeholder: "ex. janvier 2027, d'ici 3 mois" },
    ],
    tags: {
      label: 'Priorité',
      options: [
        { id: 'haute', label: 'Priorité haute', color: 'red' },
        { id: 'moyenne', label: 'Priorité moyenne', color: 'orange' },
        { id: 'basse', label: 'Priorité basse', color: 'grey' },
      ],
    },
  },
];

export const SPACE_MAP = Object.fromEntries(SPACES.map((s) => [s.id, s]));

// Questions préparées, créées en « brouillon » à chaque nouvelle session.
// Le formateur les ouvre d'un clic (ou les supprime) depuis son tableau de bord.
export const DEFAULT_QUESTIONS = [
  { space: 'accueil', type: 'poll', text: "Depuis la première session, à quelle fréquence avez-vous utilisé l'IA dans votre travail ?", options: ['Jamais', 'Une ou deux fois', 'Chaque semaine', 'Presque tous les jours'] },
  { space: 'accueil', type: 'open', text: "En un mot : comment vous sentez-vous face à l'IA aujourd'hui ?" },
  { space: 'usages', type: 'poll', text: "Pour quel type de tâche avez-vous le plus utilisé l'IA ?", options: ['Rédaction / reformulation', 'Synthèse de documents', "Recherche d'informations", 'Organisation / planning', 'Communication', 'Autre'] },
  { space: 'usages', type: 'open', text: 'Quelle a été votre plus grande surprise (bonne ou mauvaise) en testant l\'IA ?' },
  { space: 'valeurs', type: 'open', text: 'Quelle phrase voudriez-vous lire en tête de votre charte ?' },
  { space: 'perimetre', type: 'poll', text: "Rédiger un compte rendu d'entretien avec l'IA, après pseudonymisation, devrait être :", options: ['Autorisé', 'Autorisé sous conditions', 'Interdit', 'Je ne sais pas'] },
  { space: 'donnees', type: 'poll', text: "Sauriez-vous pseudonymiser un écrit avant de l'utiliser avec une IA ?", options: ['Oui, sans difficulté', 'Plus ou moins', 'Non'] },
  { space: 'outils', type: 'poll', text: "Dans votre structure, des outils d'IA sont-ils déjà utilisés sans cadre formel ?", options: ['Oui, souvent', 'Parfois', 'Non', 'Je ne sais pas'] },
  { space: 'droits', type: 'open', text: "Comment expliqueriez-vous l'usage de l'IA à une personne accompagnée ou à sa famille ?" },
  { space: 'responsabilites', type: 'poll', text: 'Faut-il désigner un référent IA dans votre structure ?', options: ['Oui', 'Non', 'Oui, mutualisé entre plusieurs structures', 'Je ne sais pas'] },
  { space: 'formation', type: 'open', text: 'De quelle formation auriez-vous besoin en priorité ?' },
  { space: 'plan', type: 'poll', text: 'Quel est le premier chantier à lancer dans votre structure ?', options: ['Rédiger la charte', 'Former les équipes', 'Choisir un outil sécurisé', 'Désigner un référent IA', 'Informer les personnes accompagnées'] },
];
