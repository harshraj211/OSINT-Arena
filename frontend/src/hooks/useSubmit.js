import { useState } from 'react'

export const useSubmit = () => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  const submit = async (challengeId, answer) => {
    setIsSubmitting(true)
    try {
      // Submit logic
    } finally {
      setIsSubmitting(false)
    }
  }

  return { isSubmitting, result, submit }
}