export const ActivityLog = ({ activities }) => (
  <div className="activity-log">
    {activities.map((activity, idx) => (
      <div key={idx} className="activity-item">
        <span className="activity-date">{activity.date}</span>
        <span className="activity-text">{activity.text}</span>
      </div>
    ))}
  </div>
)