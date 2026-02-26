export const AnswerInput = ({ onSubmit }) => {
  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(e.target.answer.value)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" name="answer" placeholder="Enter your answer..." />
      <button type="submit">Submit</button>
    </form>
  )
}