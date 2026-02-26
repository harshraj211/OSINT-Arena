export const Button = ({ children, ...props }) => (
  <button {...props}>{children}</button>
)

export const Badge = ({ children, ...props }) => (
  <span {...props}>{children}</span>
)

export const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null
  return (
    <div className="modal">
      <div className="modal-content">
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    </div>
  )
}

export const Tooltip = ({ text, children }) => (
  <div className="tooltip" title={text}>{children}</div>
)

export const Spinner = () => <div className="spinner"></div>

export const Tag = ({ children, ...props }) => (
  <span className="tag" {...props}>{children}</span>
)
