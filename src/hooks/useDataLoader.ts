import { useState, useEffect, useRef } from 'react'

const cache = new Map<string, unknown>()

export function useDataLoader<T>(filename: string) {
  const [data, setData] = useState<T | null>(() => (cache.get(filename) as T) ?? null)
  const [loading, setLoading] = useState(!cache.has(filename))
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (cache.has(filename)) {
      setData(cache.get(filename) as T)
      setLoading(false)
      return
    }
    if (fetchedRef.current) return
    fetchedRef.current = true

    fetch(`./data/${filename}`)
      .then(r => { if (!r.ok) throw new Error(`Failed: ${filename}`); return r.json() })
      .then((json: T) => { cache.set(filename, json); setData(json); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [filename])

  return { data, loading, error }
}
