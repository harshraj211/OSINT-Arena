export const LeaderboardTabs = ({ activeTab, onTabChange }) => (
  <div className="leaderboard-tabs">
    <button className={activeTab === 'global' ? 'active' : ''} onClick={() => onTabChange('global')}>Global</button>
    <button className={activeTab === 'weekly' ? 'active' : ''} onClick={() => onTabChange('weekly')}>Weekly</button>
    <button className={activeTab === 'monthly' ? 'active' : ''} onClick={() => onTabChange('monthly')}>Monthly</button>
  </div>
)