export const eloColor = (elo) => {
  if (elo < 1200) return '#888888'      // Gray
  if (elo < 1600) return '#4FC3F7'      // Blue  
  if (elo < 2000) return '#66BB6A'      // Green
  if (elo < 2400) return '#FFA726'      // Orange
  return '#EF5350'                       // Red
}