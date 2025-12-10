import { tr } from './tr';
import { en } from './en';

export type Language = 'tr' | 'en';
export type TranslationKey = keyof typeof tr;

const translations = {
  tr,
  en
};

export function getTranslation(language: Language): typeof tr {
  return translations[language] || translations.tr;
}

export function t(language: Language, key: TranslationKey): string {
  const translation = getTranslation(language);
  return translation[key] || key;
}

