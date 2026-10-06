/** Trimmed string value of a form field ("" if missing or a File). */
export function formText(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}
