export const SubmitButton = ({ isLoading, onClick }) => (
  <button disabled={isLoading} onClick={onClick}>
    {isLoading ? 'Submitting...' : 'Submit Answer'}
  </button>
)