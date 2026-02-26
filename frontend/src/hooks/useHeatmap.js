import { useState, useEffect } from 'react'

export const useHeatmap = (userId) => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Fetch heatmap data
  }, [userId])

  return { data, loading }
}