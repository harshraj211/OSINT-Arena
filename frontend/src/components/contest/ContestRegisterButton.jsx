export const ContestRegisterButton = ({ contestId, onRegister }) => (
  <button onClick={() => onRegister(contestId)}>Register for Contest</button>
)