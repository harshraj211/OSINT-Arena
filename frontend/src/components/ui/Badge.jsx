export const Badge = ({ children, variant = 'default', ...props }) => (
  <span className={`badge badge-${variant}`} {...props}>{children}</span>
)