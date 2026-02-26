export const BadgeShelf = ({ badges }) => (
  <div className="badge-shelf">
    {badges.map((badge, idx) => (
      <div key={idx} className="badge-item" title={badge.name}>
        {badge.icon}
      </div>
    ))}
  </div>
)