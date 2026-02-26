export const ChallengeFilter = ({ onFilterChange }) => (
  <div className="challenge-filter">
    <input type="text" placeholder="Search challenges..." onChange={(e) => onFilterChange(e.target.value)} />
  </div>
)