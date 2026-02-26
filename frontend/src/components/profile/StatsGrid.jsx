export const StatsGrid = ({ stats }) => (
  <div className="stats-grid">
    {stats.map((stat, idx) => (
      <div key={idx} className="stat-card">
        <span className="stat-label">{stat.label}</span>
        <span className="stat-value">{stat.value}</span>
      </div>
    ))}
  </div>
)