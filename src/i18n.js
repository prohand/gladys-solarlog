// -----------------------------------------------------------------------------
// The languages every user-facing text is written in.
//
// Gladys renders a multi-language object in the reader's own language and
// falls back to English for any other one. Every message this integration
// returns — action answers, connection status, widget texts — is such an
// object, with one key per language below.
// -----------------------------------------------------------------------------

/** The languages of the Gladys interface, English first: it is the fallback. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/**
 * The text of one language, English when the object has none for it.
 *
 * @param {string} language a key of {@link LANGUAGES}, or anything else
 * @param {Record<string, string>} texts one text per language, `en` included
 * @returns {string}
 */
export function pick(language, texts) {
  return texts[language] ?? texts.en;
}

/**
 * One multi-language object, built by calling `build` once per language.
 *
 * @param {(language: string) => string} build the text in one language
 * @returns {Record<string, string>} `{ en, fr, de, es }`
 */
export function localize(build) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, build(language)]));
}

/**
 * Format a number the way the reader expects it (decimal comma in French,
 * German and Spanish), with at most `digits` decimals.
 *
 * @param {string} language
 * @param {number} value
 * @param {number} [digits]
 * @returns {string}
 */
export function formatNumber(language, value, digits = 0) {
  const locale = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' }[language] ?? 'en-GB';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
}
