export const gravatarUrl = (email) => {
  const hash = email.trim().toLowerCase()
  return `https://www.gravatar.com/avatar/${hash}?d=identicon`
}