export const EloAdjustModal = ({ user, onAdjust }) => (
  <div className="elo-adjust-modal">
    <h3>Adjust ELO for {user}</h3>
    <input type="number" placeholder="New ELO" />
    <button onClick={() => onAdjust()}>Save</button>
  </div>
)