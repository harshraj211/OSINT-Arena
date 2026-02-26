import { useState, useCallback } from 'react'

export const useContest = () => {
  const [contests, setContests] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchContests = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch contests
    } finally {
      setLoading(false)
    }
  }, [])

  return { contests, loading, fetchContests }
}