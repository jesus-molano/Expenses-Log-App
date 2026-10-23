// Sin tildes ni mayúsculas, para comparar lo que dice el usuario o la IA.
export function foldText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

// `phrase` aparece como palabra (o palabras) completa dentro de `text`, ya
// plegado con foldText.
export function hasWord(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(text);
}

// Palabras con contenido de un texto ya plegado.
export function wordsOf(folded: string) {
  return folded.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}
