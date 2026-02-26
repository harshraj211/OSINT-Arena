export const BroadcastEmailForm = ({ onSend }) => (
  <form onSubmit={(e) => { e.preventDefault(); onSend(); }}>
    <input type="text" placeholder="Subject" />
    <textarea placeholder="Message"></textarea>
    <button type="submit">Send Broadcast</button>
  </form>
)