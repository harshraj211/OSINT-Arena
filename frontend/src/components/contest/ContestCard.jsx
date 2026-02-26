export const ContestCard = ({ contest }) => (
  <div className="contest-card">
    <h3>{contest.name}</h3>
    <p>{contest.description}</p>
    <p>Participants: {contest.participants}</p>
  </div>
)