export const ChallengeEditor = ({ challenge, onSave }) => (
  <form onSubmit={(e) => { e.preventDefault(); onSave(challenge); }}>
    <input type="text" placeholder="Title" />
    <textarea placeholder="Description"></textarea>
    <button type="submit">Save Challenge</button>
  </form>
)