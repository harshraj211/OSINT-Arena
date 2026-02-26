export const HintPanel = ({ hints, currentHintIndex }) => (
  <div className="hint-panel">
    {hints && hints.length > 0 && (
      <div>
        <h4>Hint {currentHintIndex + 1}:</h4>
        <p>{hints[currentHintIndex]}</p>
      </div>
    )}
  </div>
)