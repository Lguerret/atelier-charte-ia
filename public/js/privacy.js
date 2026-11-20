// Garde-fou simple (non exhaustif) : repère dans un texte des éléments qui
// ressemblent à des données identifiantes, avant publication.
const CHECKS = [
  { why: 'un nom de personne', re: /\b(?:M\.|Mme|Mlle|Mr|Monsieur|Madame|Mademoiselle)\s+[A-ZÀ-Ý][a-zà-ÿ'-]{2,}/u },
  { why: 'une date de naissance', re: /\bn[ée]e?\s+(?:le|en)\s+\d/i },
  { why: 'une date précise', re: /\b\d{1,2}[/.-]\d{1,2}[/.-](?:19|20)\d{2}\b/ },
  { why: 'un numéro de sécurité sociale', re: /\b[12][\s.]?\d{2}[\s.]?(?:0[1-9]|1[0-2])[\s.]?(?:\d{2}|2A|2B)[\s.]?\d{3}[\s.]?\d{3}(?:[\s.]?\d{2})?\b/ },
  { why: 'un numéro de téléphone', re: /(?:\+33\s?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/ },
  { why: 'une adresse e-mail', re: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  { why: 'une adresse postale', re: /\b\d{1,4}\s?(?:bis|ter)?,?\s+(?:rue|avenue|av\.|boulevard|bd|chemin|impasse|allée|place|route)\s/i },
];

export function checkPrivacy(text) {
  const found = new Set();
  for (const c of CHECKS) if (c.re.test(text || '')) found.add(c.why);
  return [...found];
}

export function confirmPrivacy(text) {
  const found = checkPrivacy(text);
  if (!found.length) return true;
  return window.confirm(
    `⚠️ Votre texte semble contenir ${found.join(', ')}.\n\n`
    + 'Pour protéger les personnes accompagnées, ne saisissez aucune information permettant de les identifier : '
    + 'remplacez-la par une mention générale (« un résident », « une jeune accueillie », « Mme X »).\n\n'
    + '« Annuler » pour corriger votre texte — « OK » seulement si vous êtes certain·e qu\'il ne s\'agit pas d\'une personne accompagnée.',
  );
}
