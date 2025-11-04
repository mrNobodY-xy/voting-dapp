import React, { useState } from 'react';
import VotingDApp from './VotingDApp';
import AdminPanel from './AdminPanel';
import { BrowserRouter } from 'react-router-dom';
function App() {
  const [currentPage, setCurrentPage] = useState('voting'); // 'voting' yoki 'admin'

  return ( <BrowserRouter>
    <div>
      {/* Navigation Tabs */}
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        zIndex: 1000,
        background: '#1a1a1a',
        borderBottom: '3px solid #667eea',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
      }}>
        <div className="container">
          <div className="d-flex gap-2 py-2">
            <button
              className={`btn ${currentPage === 'voting' ? 'btn-primary' : 'btn-outline-light'}`}
              onClick={() => setCurrentPage('voting')}
            >
              <i className="bi bi-box-ballot-fill me-2"></i>
              Voting
            </button>
            <button
              className={`btn ${currentPage === 'admin' ? 'btn-danger' : 'btn-outline-light'}`}
              onClick={() => setCurrentPage('admin')}
            >
              <i className="bi bi-shield-lock-fill me-2"></i>
              Admin Panel
            </button>
          </div>
        </div>
      </div>

      {/* Content with top padding to account for fixed nav */}
      <div style={{ paddingTop: '60px' }}>
        {currentPage === 'voting' ? <VotingDApp /> : <AdminPanel />}
      </div>

      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" />
    </div>
    </BrowserRouter>
  );
}

export default App;