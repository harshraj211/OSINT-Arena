export const SolveResultModal = ({ isOpen, onClose, result }) => (
  <div className={`result-modal ${isOpen ? 'open' : ''}`}>
    <div className="result-content">
      <h2>{result?.success ? 'Success!' : 'Incorrect'}</h2>
      <p>{result?.message}</p>
      <button onClick={onClose}>Close</button>
    </div>
  </div>
)