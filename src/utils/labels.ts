/** UI chips and pill buttons always show lowercase. */
export function uiLabel(text: string) {
  // Lowercase, but the pronoun "I" stays a capital ("people I love").
  return text
    .trim()
    .toLowerCase()
    .replace(/(^|[^a-z'])i(?=$|[^a-z'])/g, '$1I')
    .replace(/(^|[^a-z'’])i(['’])(m|ve|ll|d)\b/g, "$1I$2$3");
}
