export const normalizeAnswer = (answer) => {
  return answer.trim().toLowerCase().replace(/\s+/g, ' ')
}