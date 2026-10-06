/** String value of a form field ("" if missing or a File). Trimmed unless `trim: false` (passwords). */
export function formText(form: FormData, name: string, { trim = true } = {}): string {
  const v = form.get(name);
  if (typeof v !== "string") return "";
  return trim ? v.trim() : v;
}
