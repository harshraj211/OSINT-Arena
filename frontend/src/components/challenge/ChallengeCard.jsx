export const ChallengeCard = ({ challenge }) => (
  <div className="challenge-card">
    <h3>{challenge.title}</h3>
    <p>{challenge.description}</p>
  </div>
)