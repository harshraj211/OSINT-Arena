export const HeatmapCell = ({ date, value, intensity }) => (
  <div className={`heatmap-cell intensity-${intensity}`} title={`${date}: ${value} solves`}></div>
)