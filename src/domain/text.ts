// Sin tildes ni mayúsculas, para comparar lo que dice el usuario o la IA.
export function foldText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
