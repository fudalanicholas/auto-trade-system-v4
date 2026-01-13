import { useState } from 'react';
import './App.css';
import TradeTable from './components/TradeTable';
import Analytics from './components/Analytics';

function App() {
  const [activeTab, setActiveTab] = useState('trades');
  const [selectedBroker, setSelectedBroker] = useState('all');
  const [tableKey, setTableKey] = useState(0);
  
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Force re-render of TradeTable when switching back to trades tab
    if (tab === 'trades') {
      setTableKey(prevKey => prevKey + 1);
    }
  };

  return (
    <div className="app-container">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
      </header>
      
      <nav className="dashboard-nav">
        <button 
          className={`nav-tab ${activeTab === 'trades' ? 'active' : ''}`}
          onClick={() => handleTabChange('trades')}
        >
          Trades
        </button>
        <button 
          className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => handleTabChange('analytics')}
        >
          Analytics
        </button>
        <button 
          className={`nav-tab ${activeTab === 'command' ? 'active' : ''}`}
          onClick={() => handleTabChange('command')}
        >
          Command
        </button>
      </nav>
      
      <main className="dashboard-content">
        {activeTab === 'trades' && (
          <section className="trades-section">
            <div className="section-header">
              <h2>Recent Trades</h2>
              <div className="section-actions">
                <select 
                  className="filter-select"
                  value={selectedBroker}
                  onChange={(e) => setSelectedBroker(e.target.value)}
                >
                  <option value="all">All Brokers</option>
                  <option value="topstep">Topstep</option>
                  <option value="kraken">Kraken</option>
                  <option value="ibkr">IBKR</option>
                </select>
              </div>
            </div>
            <div className="table-container">
              <TradeTable selectedBroker={selectedBroker} key={tableKey} />
            </div>
          </section>
        )}
        
        {activeTab === 'analytics' && (
          <section className="analytics-section">
            <div className="section-header">
              <h2>Analytics</h2>
            </div>
            <Analytics />
          </section>
        )}
        
        {activeTab === 'command' && (
          <section className="command-section">
            <h2>Command (Coming Soon)</h2>
            <p>Dashboard commands will be available here in a future update.</p>
          </section>
        )}
      </main>
      
      <footer className="dashboard-footer">
        <p>Auto Trade System v4 © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;
