import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import uzAdminTranslations from './locales/uz copy.json';
import koAdminTranslations from './locales/kr copy.json';
import enAdminTranslations from './locales/en copy.json';
// Smart Contract ABI
const MASTER_TOKEN_ABI = [
  "function mint(address to, uint256 amount)",
  "function balanceOf(address owner) view returns (uint256)",
  "function owner() view returns (address)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)"
];

const VOTING_ABI = [
  "function addOption(string name)",
  "function startVoting(uint256 durationInMinutes)",
  "function endVoting()",
  "function getResults() view returns (tuple(string name, uint256 votes)[])",
  "function getTotalVotes() view returns (uint256)",
  "function votingActive() view returns (bool)",
  "function votingStartTime() view returns (uint256)",
  "function votingEndTime() view returns (uint256)",
  "function owner() view returns (address)",
  "event OptionAdded(uint256 optionId, string name)",
  "event VoteCast(address indexed voter, uint256 optionId, uint256 amount)"
];

// CONFIG
const CONFIG = {
  CHAIN_ID: 1337,
  TOKEN_ADDRESS: "0x1829491F31Fb32DEC76ED1dA722326c183AD0968",
  VOTING_ADDRESS: "0x94d9Dc60c5A470700e6c0b099962A3ad87205510"
};

const translations = {
  uz: uzAdminTranslations,
  ko: koAdminTranslations,
  en: enAdminTranslations
};
function AdminPanel() {
  const [account, setAccount] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('uz');
  // Token state
  const [mintAddress, setMintAddress] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [tokenStats, setTokenStats] = useState({
    totalSupply: '0',
    name: '',
    symbol: ''
  });

  // Voting state
  const [optionName, setOptionName] = useState('');
  const [votingDuration, setVotingDuration] = useState('60');
  const [votingStatus, setVotingStatus] = useState({
    active: false,
    startTime: 0,
    endTime: 0,
    totalVotes: '0'
  });
  const [votingOptions, setVotingOptions] = useState([]);
  const t = (key, params = {}) => {
  let text = translations[language][key] || key;
  Object.keys(params).forEach(param => {
    text = text.replace(`{${param}}`, params[param]);
  });
  return text;
};  
  const showAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 5000);
  };

  const checkMetaMask = () => {
    if (!window.ethereum) {
      showAlert('danger', t('networkSwitched'));
      return false;
    }
    return true;
  };

  const checkNetwork = async () => {
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(chainId, 16);
      
      if (currentChainId !== CONFIG.CHAIN_ID) {
        setIsCorrectNetwork(false);
        showAlert('warning', `⚠️ Noto'g'ri network! Chain ID: ${CONFIG.CHAIN_ID} kerak`);
        return false;
      }
      
      setIsCorrectNetwork(true);
      return true;
    } catch (error) {
      console.error('Network tekshirishda xatolik:', error);
      return false;
    }
  };

  const switchNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ethers.toQuantity(CONFIG.CHAIN_ID) }],
      });
      showAlert('success', t('networkSwitched'));
      await checkNetwork();
      if (account) {
        await loadData();
      }
    } catch (error) {
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: ethers.toQuantity(CONFIG.CHAIN_ID),
              chainName: 'Localhost 8545',
              rpcUrls: ['http://127.0.0.1:8545'],
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18
              }
            }]
          });
          showAlert('success', t('networkAdded'));
        } catch (addError) {
          showAlert('danger', t('networkAddError'));
        }
      } else {
        showAlert('danger', t('networkSwitchError'));
      }
    }
  };

  const connectWallet = async () => {
    if (!checkMetaMask()) return;

    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      setAccount(accounts[0]);
      
      const isCorrect = await checkNetwork();
      if (!isCorrect) {
        showAlert('warning', t('switchNetworkWarning'));
        return;
      }

      showAlert('success', t('walletConnected'));
      await loadData();
    } catch (error) {
      console.error(error);
      if (error.code === 4001) {
        showAlert('warning', t('userRejected'));
      } else {
        showAlert('danger', '❌ : ' + error.message);
      }
    }
  };

  const checkAdminStatus = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      const tokenContract = new ethers.Contract(CONFIG.TOKEN_ADDRESS, MASTER_TOKEN_ABI, provider);
      const votingContract = new ethers.Contract(CONFIG.VOTING_ADDRESS, VOTING_ABI, provider);

      const tokenOwner = await tokenContract.owner();
      const votingOwner = await votingContract.owner();

      const isOwner = tokenOwner.toLowerCase() === account.toLowerCase() || 
                      votingOwner.toLowerCase() === account.toLowerCase();
      
      setIsAdmin(isOwner);
      
      if (!isOwner) {
        showAlert('warning', t('notAdmin'));
      }

      return isOwner;
    } catch (error) {
      console.error(t('loadError'), error);
      return false;
    }
  };

  const loadData = async () => {
    if (!account) return;
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      const tokenContract = new ethers.Contract(CONFIG.TOKEN_ADDRESS, MASTER_TOKEN_ABI, provider);
      const votingContract = new ethers.Contract(CONFIG.VOTING_ADDRESS, VOTING_ABI, provider);

      // Check admin
      await checkAdminStatus();

      // Token stats
      const totalSupply = await tokenContract.totalSupply();
      const name = await tokenContract.name();
      const symbol = await tokenContract.symbol();
      
      setTokenStats({
        totalSupply: ethers.formatEther(totalSupply),
        name,
        symbol
      });

      // Voting status
      const active = await votingContract.votingActive();
      const startTime = await votingContract.votingStartTime();
      const endTime = await votingContract.votingEndTime();
      const totalVotes = await votingContract.getTotalVotes();
      
      setVotingStatus({
        active,
        startTime: Number(startTime),
        endTime: Number(endTime),
        totalVotes: ethers.formatEther(totalVotes)
      });

      // Voting options
      const results = await votingContract.getResults();
      setVotingOptions(results.map((opt, idx) => ({
        id: idx,
        name: opt.name,
        votes: ethers.formatEther(opt.votes)
      })));

    } catch (error) {
      console.error(t('loadError'), error);
      showAlert('danger', t('loadError'));
    }
  };

  // ADMIN FUNCTIONS

  const handleMintTokens = async () => {
    if (!isAdmin) {
      showAlert('danger', t('noAdminRights'));
      return;
    }

    if (!mintAddress || !ethers.isAddress(mintAddress)) {
      showAlert('warning', t('enterAddress'));
      return;
    }

    if (!mintAmount || parseFloat(mintAmount) <= 0) {
      showAlert('warning', t('enterAmount'));
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tokenContract = new ethers.Contract(CONFIG.TOKEN_ADDRESS, MASTER_TOKEN_ABI, signer);

      const amount = ethers.parseEther(mintAmount);
      
      showAlert('info', t('minting'));
      const tx = await tokenContract.mint(mintAddress, amount);
      
      showAlert('info', '⏳ Tranzaksiya tasdiqlanmoqda...');
      await tx.wait();
      
      showAlert('success', `✅ ${mintAmount} ${tokenStats.symbol} muvaffaqiyatli mint qilindi!`);
      setMintAddress('');
      setMintAmount('');
      await loadData();
    } catch (error) {
      console.error(error);
      if (error.code === 4001) {
        showAlert('warning', '❌ Tranzaksiya rad etildi');
      } else {
        showAlert('danger', '❌ Xatolik: ' + (error.reason || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddOption = async () => {
    if (!isAdmin) {
      showAlert('danger', '❌ Admin huquqi yo\'q!');
      return;
    }

    if (!optionName || optionName.trim() === '') {
      showAlert('warning', '⚠️ Variant nomini kiriting!');
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const votingContract = new ethers.Contract(CONFIG.VOTING_ADDRESS, VOTING_ABI, signer);

      showAlert('info', '⏳ Variant qo\'shilmoqda... MetaMask\'ni tekshiring!');
      const tx = await votingContract.addOption(optionName);
      
      showAlert('info', '⏳ Tranzaksiya tasdiqlanmoqda...');
      await tx.wait();
      
      showAlert('success', `✅ "${optionName}" varianti qo'shildi!`);
      setOptionName('');
      await loadData();
    } catch (error) {
      console.error(error);
      if (error.code === 4001) {
        showAlert('warning', '❌ Tranzaksiya rad etildi');
      } else {
        showAlert('danger', '❌ Xatolik: ' + (error.reason || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartVoting = async () => {
    if (!isAdmin) {
      showAlert('danger', '❌ Admin huquqi yo\'q!');
      return;
    }

    if (!votingDuration || parseInt(votingDuration) <= 0) {
      showAlert('warning', '⚠️ Voting davomiyligini kiriting!');
      return;
    }

    if (votingOptions.length === 0) {
      showAlert('warning', '⚠️ Avval voting variantlarini qo\'shing!');
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const votingContract = new ethers.Contract(CONFIG.VOTING_ADDRESS, VOTING_ABI, signer);

      showAlert('info', '⏳ Voting boshlanmoqda... MetaMask\'ni tekshiring!');
      const tx = await votingContract.startVoting(parseInt(votingDuration));
      
      showAlert('info', '⏳ Tranzaksiya tasdiqlanmoqda...');
      await tx.wait();
      
      showAlert('success', `✅ Voting ${votingDuration} daqiqaga boshlandi!`);
      await loadData();
    } catch (error) {
      console.error(error);
      if (error.code === 4001) {
        showAlert('warning', '❌ Tranzaksiya rad etildi');
      } else {
        showAlert('danger', '❌ Xatolik: ' + (error.reason || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEndVoting = async () => {
    if (!isAdmin) {
      showAlert('danger', '❌ Admin huquqi yo\'q!');
      return;
    }

    if (!votingStatus.active) {
      showAlert('warning', '⚠️ Voting allaqachon tugagan!');
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const votingContract = new ethers.Contract(CONFIG.VOTING_ADDRESS, VOTING_ABI, signer);

      showAlert('info', '⏳ Voting to\'xtatilmoqda... MetaMask\'ni tekshiring!');
      const tx = await votingContract.endVoting();
      
      showAlert('info', '⏳ Tranzaksiya tasdiqlanmoqda...');
      await tx.wait();
      
      showAlert('success', '✅ Voting to\'xtatildi!');
      await loadData();
    } catch (error) {
      console.error(error);
      if (error.code === 4001) {
        showAlert('warning', '❌ Tranzaksiya rad etildi');
      } else {
        showAlert('danger', '❌ Xatolik: ' + (error.reason || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  // Format date
  const formatDate = (timestamp) => {
    if (timestamp === 0) return 'N/A';
    return new Date(timestamp * 1000).toLocaleString('uz-UZ');
  };

  // Auto-refresh
  useEffect(() => {
    if (account && isCorrectNetwork) {
      const interval = setInterval(() => {
        loadData();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [account, isCorrectNetwork]);

  // MetaMask listeners
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        loadData();
      } else {
        setAccount('');
        setIsAdmin(false);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [account]);

  return (
    <div className="min-vh-100" style={{ background: 'linear-gradient(135deg, #000000ff 0%, #6e6d6dff 100%)' }}>
      {/* Navbar */}
      <nav className="navbar navbar-dark bg-dark shadow">
        <div className="container">
          <span className="navbar-brand mb-0 h1">
            <i className="bi bi-shield-lock-fill me-2"></i>
            Admin Panel
          </span> 
          {account ? (
            <div className="d-flex align-items-center gap-2">
              <div className="btn-group btn-group-sm">
  <button 
    className={`btn ${language === 'uz' ? 'btn-primary' : 'btn-outline-light'}`}
    onClick={() => setLanguage('uz')}
  >
    O'zbekcha
  </button>
  <button 
    className={`btn ${language === 'ko' ? 'btn-primary' : 'btn-outline-light'}`}
    onClick={() => setLanguage('ko')}
  >
    한국어
  </button>
  <button 
    className={`btn ${language === 'en' ? 'btn-primary' : 'btn-outline-light'}`}
    onClick={() => setLanguage('en')}
  >
    English
  </button>
</div>
              {isAdmin && <span className="badge bg-success">{t('admin')}</span>}
              {!isCorrectNetwork && (
                <button className="btn btn-warning btn-sm" onClick={switchNetwork}>
                  {t('switchNetwork')}
                </button>
              )}
              <span className="text-white">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={connectWallet}>
              <i className="bi bi-wallet2 me-2"></i>
                  {t('connectWallet')}
            </button>
          )}
        </div>
      </nav>

      {/* Alert */}
      {alert.show && (
        <div className="container mt-3">
          <div className={`alert alert-${alert.type} alert-dismissible fade show`} role="alert">
            {alert.message}
            <button type="button" className="btn-close" onClick={() => setAlert({ show: false })}></button>
          </div>
        </div>
      )}

      <div className="container py-4">
        {!account ? (
          <div className="row justify-content-center">
            <div className="col-md-6">
              <div className="card shadow-lg border-0">
                <div className="card-body text-center p-5">
                  <i className="bi bi-shield-lock display-1 text-danger mb-3"></i>
                  <h3 className="mb-3">{t('adminPanel')}</h3>
                  <p className="text-muted mb-4">
                    {t('connectDescription')}
                  </p>
                  <button className="btn btn-primary btn-lg" onClick={connectWallet}>
                    <i className="bi bi-wallet2 me-2"></i>
                    {t('connectWallet')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <div className="card bg-primary text-white shadow">
                  <div className="card-body">
                    <h6 className="card-title"><i className="bi bi-coin me-2"></i>{t('tokenInfo')}</h6>
                    <h4>{tokenStats.name} ({tokenStats.symbol})</h4>
                    <p className="mb-0">{t('totalSupply')}: {parseFloat(tokenStats.totalSupply).toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card bg-success text-white shadow">
                  <div className="card-body">
                    <h6 className="card-title"><i className="bi bi-bar-chart me-2"></i>{t('votingStatus')}</h6>
                    <h4>{votingStatus.active ? t('active') : t('inactive')}</h4>
                    <p className="mb-0">{t('totalVotes')}: {parseFloat(votingStatus.totalVotes).toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card bg-warning text-dark shadow">
                  <div className="card-body">
                    <h6 className="card-title"><i className="bi bi-list-ul me-2"></i>{t('options')}</h6>
                    <h4>{votingOptions.length} {t('optionsCount')}</h4>
                    <p className="mb-0">{t('votingOptionsCount')}</p>
                  </div>
                </div>
              </div>
            </div>

            {!isAdmin && (
              <div className="alert alert-warning">
                <i className="bi bi-exclamation-triangle me-2"></i>
                <strong>Warning:</strong> {t('warningNotAdmin')}
              </div>
            )}

            <div className="row g-4">
              {/* Token Mint */}
              <div className="col-lg-6">
                <div className="card shadow border-0">
                  <div className="card-header bg-primary text-white">
                    <h5 className="mb-0">
                      <i className="bi bi-coin me-2"></i>
                      {t('tokenMint')}
                    </h5>
                  </div>
                  <div className="card-body">
                    <div className="mb-3">
                      <label className="form-label fw-bold">{t('walletAddress')}:</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="0x..."
                        value={mintAddress}
                        onChange={(e) => setMintAddress(e.target.value)}
                        disabled={!isAdmin || loading}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold">{t('tokenAmount')}:</label>
                      <div className="input-group">
                        <input
                          type="number"
                          className="form-control"
                          placeholder="100"
                          value={mintAmount}
                          onChange={(e) => setMintAmount(e.target.value)}
                          disabled={!isAdmin || loading}
                          min="0"
                          step="1"
                        />
                        <span className="input-group-text">{tokenStats.symbol}</span>
                      </div>
                    </div>
                    <button 
                      className="btn btn-primary w-100"
                      onClick={handleMintTokens}
                      disabled={loading || !isAdmin}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          {t('waiting')}
                        </>
                      ) : (
                        <>
                          <i className="bi bi-plus-circle me-2"></i>
                          {t('mintTokens')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Add Option */}
              <div className="col-lg-6">
                <div className="card shadow border-0">
                  <div className="card-header bg-success text-white">
                    <h5 className="mb-0">
                      <i className="bi bi-plus-square me-2"></i>
                     {t('addOption')}
                    </h5>
                  </div>
                  <div className="card-body">
                    <div className="mb-3">
                      <label className="form-label fw-bold">{t('optionName')}:</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={t('placeholder')}
                        value={optionName}
                        onChange={(e) => setOptionName(e.target.value)}
                        disabled={!isAdmin || loading}
                      />
                    </div>
                    <button 
                      className="btn btn-success w-100"
                      onClick={handleAddOption}
                      disabled={loading || !isAdmin}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          {t('waiting')}
                        </>
                      ) : (
                        <>
                          <i className="bi bi-plus-circle me-2"></i>
                          {t('addOption')}
                        </>
                      )}
                    </button>
                    <div className="mt-3">
                      <small className="text-muted">
                        <i className="bi bi-info-circle me-1"></i>
                        {t('currentOptions')}: {votingOptions.length} {t('optionsCount')}
                      </small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Voting Control */}
              <div className="col-12">
                <div className="card shadow border-0">
                  <div className="card-header bg-warning">
                    <h5 className="mb-0">
                      <i className="bi bi-gear me-2"></i>
                      {t('votingControl')}
                    </h5>
                  </div>
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="card bg-light">
                          <div className="card-body">
                            <h6 className="card-title">{t('startVoting')}</h6>
                            <div className="mb-3">
                              <label className="form-label">{t('duration')}</label>
                              <input
                                type="number"
                                className="form-control"
                                value={votingDuration}
                                onChange={(e) => setVotingDuration(e.target.value)}
                                disabled={!isAdmin || loading || votingStatus.active}
                                min="1"
                              />
                            </div>
                            <button 
                              className="btn btn-success w-100"
                              onClick={handleStartVoting}
                              disabled={loading || !isAdmin || votingStatus.active}
                            >
                              <i className="bi bi-play-circle me-2"></i>
                              Voting Boshlash
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="card bg-light">
                          <div className="card-body">
                            <h6 className="card-title">{t('stopVoting')}</h6>
                            <div className="mb-3">
                              <p className="mb-1"><strong>{t('status')}:</strong> 
                                <span className={`badge ms-2 ${votingStatus.active ? 'bg-success' : 'bg-secondary'}`}>
                                  {votingStatus.active ? t('active') : t('inactive')}
                                </span>
                              </p>
                              <small className="text-muted">
                                {t('startTime')}: {formatDate(votingStatus.startTime)}<br/>
                                {t('endTime')}: {formatDate(votingStatus.endTime)}
                              </small>
                            </div>
                            <button 
                              className="btn btn-danger w-100"
                              onClick={handleEndVoting}
                              disabled={loading || !isAdmin || !votingStatus.active}
                            >
                              <i className="bi bi-stop-circle me-2"></i>
                              {t('stopVotingBtn')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className="col-12">
                <div className="card shadow border-0">
                  <div className="card-header bg-info text-white">
                    <h5 className="mb-0">
                      <i className="bi bi-bar-chart-fill me-2"></i>
                      {t('currentResults')}
                    </h5>
                  </div>
                  <div className="card-body">
                    {votingOptions.length === 0 ? (
                      <p className="text-muted text-center">{t('noOptions')}</p>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-hover">
                          <thead>
                            <tr>
                              <th>{t('number')}</th>
                              <th>{t('option')}</th>
                              <th>{t('votes')}</th>
                              <th>{t('percentage')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {votingOptions.map((option) => {
                              const total = votingOptions.reduce((sum, opt) => sum + parseFloat(opt.votes), 0);
                              const percentage = total > 0 ? ((parseFloat(option.votes) / total) * 100).toFixed(1) : 0;
                              
                              return (
                                <tr key={option.id}>
                                  <td>{option.id + 1}</td>
                                  <td><strong>{option.name}</strong></td>
                                  <td>{parseFloat(option.votes).toFixed(2)}</td>
                                  <td>
                                    <div className="progress" style={{ height: '25px' }}>
                                      <div 
                                        className="progress-bar bg-info"
                                        style={{ width: `${percentage}%` }}
                                      >
                                        {percentage}%
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <footer className="bg-dark text-white text-center py-3 mt-5" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999 }}>
        <div className="container">
          <p className="mb-0">
            <i className="bi bi-shield-lock me-2"></i>
            Admin Panel © 2025
          </p>
        </div>
      </footer>

      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" />
    </div>
  );
}

export default AdminPanel;