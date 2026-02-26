export const Tag = ({ children, onRemove, ...props }) => (
  <span className="tag" {...props}>
    {children}
    {onRemove && <button onClick={onRemove}>×</button>}
  </span>
)