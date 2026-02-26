export const LeaderboardTable = ({ data, tab = 'global' }) => (
  <table className="leaderboard-table">
    <thead>
      <tr>
        <th>Rank</th>
        <th>User</th>
        <th>ELO</th>
        <th>Solves</th>
      </tr>
    </thead>
    <tbody>
      {data.map((row, idx) => (
        <tr key={idx}>
          <td>{idx + 1}</td>
          <td>{row.user}</td>
          <td>{row.elo}</td>
          <td>{row.solves}</td>
        </tr>
      ))}
    </tbody>
  </table>
)