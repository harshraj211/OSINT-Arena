export const EloDisplay = ({ elo, tier }) => (
  <div className="elo-display">
    <span className={`elo-tier tier-${tier}`}>{tier}</span>
    <span className="elo-number">{elo}</span>
  </div>
)