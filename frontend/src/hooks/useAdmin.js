import { useState, useCallback } from 'react'

export const useAdmin = () => {
  const [adminData, setAdminData] = useState(null)

  const getAnalytics = useCallback(async () => {
    // Fetch admin analytics
  }, [])

  return { adminData, getAnalytics }
}