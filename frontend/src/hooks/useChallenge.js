import { useState, useCallback } from 'react'

export const useChallenge = () => {
  const [challenge, setChallenge] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchChallenge = useCallback(async (id) => {
    setLoading(true)
    try {
      // Fetch challenge logic
    } finally {
      setLoading(false)
    }
  }, [])

  return { challenge, loading, fetchChallenge }
}