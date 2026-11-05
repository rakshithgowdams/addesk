const KEEP_KEYS = new Set(["addesk-install-dismissed"])

type KeyValueStore = {
  length: number
  key(index: number): string | null
  removeItem(key: string): void
  clear(): void
}

export function clearBrowserUserData(
  storage: KeyValueStore = globalThis.localStorage,
  session: { clear(): void } = globalThis.sessionStorage,
): void {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key) keys.push(key)
  }
  for (const key of keys) {
    if (!KEEP_KEYS.has(key)) storage.removeItem(key)
  }
  session.clear()
}

export function rememberInstallDismissed(storage: Pick<Storage, "setItem"> = globalThis.localStorage) {
  storage.setItem("addesk-install-dismissed", "1")
}
