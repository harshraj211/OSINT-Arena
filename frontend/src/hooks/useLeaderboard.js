import { useState, useEffect } from 'react'

export const useLeaderboard = (tab = 'global') => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    // Fetch leaderboard data
    setLoading(false)
  }, [tab])

  return { data, loading }
}