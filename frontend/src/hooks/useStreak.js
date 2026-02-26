import { useState, useEffect } from 'react'

export const useStreak = (userId) => {
  const [current, setCurrent] = useState(0)
  const [record, setRecord] = useState(0)

  useEffect(() => {
    // Fetch streak data
  }, [userId])

  return { current, record }
}