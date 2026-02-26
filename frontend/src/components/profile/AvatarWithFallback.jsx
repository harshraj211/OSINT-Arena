export const AvatarWithFallback = ({ src, name }) => (
  <div className="avatar">
    {src ? <img src={src} alt={name} /> : <span>{name?.charAt(0)}</span>}
  </div>
)