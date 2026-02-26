export const ChallengeList = ({ challenges }) => (
  <div className="challenge-list">
    {challenges.map((challenge) => (
      <div key={challenge.id} className="challenge-item">
        {challenge.title}
      </div>
    ))}
  </div>
)