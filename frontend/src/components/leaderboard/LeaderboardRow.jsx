export const LeaderboardRow = ({ rank, user, elo, solves }) => (
  <tr className="leaderboard-row">
    <td className="rank">{rank}</td>
    <td className="user">{user}</td>
    <td className="elo">{elo}</td>
    <td className="solves">{solves}</td>
  </tr>
)