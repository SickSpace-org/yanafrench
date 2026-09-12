export type VocabWord = {
  id: string;
  word: string;
  pronunciation: string;
  meaning: string;
  example: string;
  category: "Connectors" | "Opinion" | "Everyday" | "TEF Vocabulary" | "Grammar terms" | "Saved";
  dateLearned: string;
};

export const vocabulary: VocabWord[] = [
  { id: "pourtant", word: "pourtant", pronunciation: "poor-tahn", meaning: "however · yet", example: "Il pleut, pourtant je vais sortir.", category: "Connectors", dateLearned: "14 Oct" },
  { id: "quant-a", word: "quant à", pronunciation: "kahn ah", meaning: "as for", example: "Quant à moi, je préfère le train.", category: "Connectors", dateLearned: "14 Oct" },
  { id: "il-nempeche", word: "il n'empêche que", pronunciation: "eel nahm-pesh kuh", meaning: "nevertheless", example: "Il n'empêche que son idée est intéressante.", category: "Connectors", dateLearned: "14 Oct" },
  { id: "a-mon-avis", word: "à mon avis", pronunciation: "ah mohn ah-vee", meaning: "in my opinion", example: "À mon avis, ce film est trop long.", category: "Opinion", dateLearned: "7 Oct" },
  { id: "force-est", word: "force est de constater", pronunciation: "fors eh duh kohn-stah-tay", meaning: "it must be said", example: "Force est de constater qu'il a raison.", category: "Opinion", dateLearned: "7 Oct" },
  { id: "au-fur-et-a-mesure", word: "au fur et à mesure", pronunciation: "oh fewr ay ah muh-zewr", meaning: "as things progress", example: "Je comprends au fur et à mesure que j'écoute.", category: "Everyday", dateLearned: "4 Oct" },
  { id: "dans-lensemble", word: "dans l'ensemble", pronunciation: "dahn lahn-sahm-bluh", meaning: "on the whole", example: "Dans l'ensemble, le cours s'est bien passé.", category: "Everyday", dateLearned: "4 Oct" },
  { id: "en-revanche", word: "en revanche", pronunciation: "ahn ruh-vahnsh", meaning: "on the other hand", example: "J'aime lire, en revanche je déteste écrire.", category: "Connectors", dateLearned: "1 Oct" },
  { id: "de-ce-fait", word: "de ce fait", pronunciation: "duh suh feh", meaning: "as a result", example: "Il a raté le bus, de ce fait il est en retard.", category: "Connectors", dateLearned: "1 Oct" },
  { id: "si-jamais", word: "si jamais", pronunciation: "see zhah-meh", meaning: "if ever", example: "Si jamais tu changes d'avis, préviens-moi.", category: "Grammar terms", dateLearned: "28 Sep" },
  { id: "au-cas-ou", word: "au cas où", pronunciation: "oh kah oo", meaning: "in case", example: "Prends un parapluie, au cas où.", category: "Grammar terms", dateLearned: "28 Sep" },
  { id: "clb", word: "NCLC", pronunciation: "en-say-el-say", meaning: "Canadian Language Benchmark", example: "Mon objectif est NCLC 7 en expression orale.", category: "TEF Vocabulary", dateLearned: "20 Sep" },
];

export const vocabCategories = ["All", "Saved", "Connectors", "Opinion", "Everyday", "TEF Vocabulary", "Grammar terms"] as const;

export function getVocabulary() {
  return vocabulary;
}
