import en from "../../messages/en.json"

function lookup(path: string): string {
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, en)
  return typeof value === "string" ? value : path
}

export function t(path: string, vars?: Record<string, string | number>): string {
  let text = lookup(path)
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${key}}`, String(value))
    }
  }
  return text
}
