export const Tooltip = ({ text, children }) => (
  <div className="tooltip-wrapper">
    {children}
    <div className="tooltip">{text}</div>
  </div>
)