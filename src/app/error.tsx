"use client"

import { useEffect } from "react"

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <main className="mx-auto grid min-h-full max-w-md gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <button type="button" className="h-11 rounded-lg bg-primary px-4 text-primary-foreground" onClick={() => reset()}>
        Try again
      </button>
    </main>
  )
}
