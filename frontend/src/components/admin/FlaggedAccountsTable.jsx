export const FlaggedAccountsTable = ({ accounts }) => (
  <table className="flagged-accounts">
    <thead>
      <tr>
        <th>User</th>
        <th>Reason</th>
        <th>Date</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      {accounts.map((account, idx) => (
        <tr key={idx}>
          <td>{account.user}</td>
          <td>{account.reason}</td>
          <td>{account.date}</td>
          <td><button>Review</button></td>
        </tr>
      ))}
    </tbody>
  </table>
)