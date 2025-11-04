import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import uzTranslations from './locales/uz.json';
import koTranslations from './locales/kr.json';
import enTranslations from './locales/en.json';
import { useSearchParams } from 'react-router-dom';
// Smart Contract ABI
const MASTER_TOKEN_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function mintForNewUser()", // YANGI FUNKSIYA
  "function hasMinted(address) view returns (bool)" // Tekshirish uchun (agar contractda bor bo'lsa)
];

const VOTING_ABI = [
  "function vote(uint256 optionId, uint256 amount)",
  "function getResults() view returns (tuple(string name, uint256 votes)[])",
  "function getUserVotes(address user) view returns (uint256[])",
  "function getTotalVotes() view returns (uint256)",
  "function totalVotesByUser(address) view returns (uint256)",
  "function votingActive() view returns (bool)",
  "function votingEndTime() view returns (uint256)",
  "function token() view returns (address)",
  "event VoteCast(address indexed voter, uint256 optionId, uint256 amount)"
];
 
// TRANSLATIONS
const translations = {
  uz: uzTranslations,
  ko: koTranslations,
  en: enTranslations
};

function VotingDApp() {
  const [language, setLanguage] = useState('uz');
  const [account, setAccount] = useState('');
  const [balance, setBalance] = useState('0');
  const [votingOptions, setVotingOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(0);
  const [voteAmount, setVoteAmount] = useState('');
  const [userTotalVotes, setUserTotalVotes] = useState('0');
  const [isVotingActive, setIsVotingActive] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [networkName, setNetworkName] = useState('');
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [searchParams] = useSearchParams();
  const [hasClaimed, setHasClaimed] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // URL query params dan olish, default qiymatlar bilan
  const chainIdParam = searchParams.get('chain_id') || '1337';
  const tokenAddressParam = searchParams.get('token_address') || '0x1829491F31Fb32DEC76ED1dA722326c183AD0968';
  const votingAddressParam = searchParams.get('voting_address') || '0x94d9Dc60c5A470700e6c0b099962A3ad87205510';
  const rpcUrlParam = searchParams.get('rpc_url') || 'http://127.0.0.1:8545';
// CONFIG
  const CONFIG = {
    CHAIN_ID: parseInt(chainIdParam, 10),
    TOKEN_ADDRESS: tokenAddressParam,
    VOTING_ADDRESS: votingAddressParam,
    RPC_URL: rpcUrlParam
  };

  // Get translation
  const t = (key, params = {}) => {
    let text = translations[language][key] || key;
    Object.keys(params).forEach(param => {
      text = text.replace(`{${param}}`, params[param]);
    });
    return text;
  };

  // Alert
  const showAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 5000);
  };

  // MetaMask mavjudligini tekshirish
  const checkMetaMask = () => {
    if (!window.ethereum) {
      showAlert('danger', t('metaMaskNotFound'));
      return false;
    }
    return true;
  };

  // Network tekshirish
  const checkNetwork = async () => {
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(chainId, 16);
      
      if (currentChainId !== CONFIG.CHAIN_ID) {
        setIsCorrectNetwork(false);
        showAlert('warning', t('wrongNetwork', { chainId: CONFIG.CHAIN_ID }));
        return false;
      }
      
      setIsCorrectNetwork(true);
      return true;
    } catch (error) {
      console.error('Network check error:', error);
      return false;
    }
  };

  // Network o'zgartirish
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
              rpcUrls: [CONFIG.RPC_URL],
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18,
              }
            }]
          });
          showAlert('success', t('networkAdded'));
        } catch (addError) {
          showAlert('danger', t('networkAddError', { error: addError.message }));
        }
      } else {
        showAlert('danger', t('networkSwitchError', { error: error.message }));
      }
    }
  };

  // Wallet ulanish
  const connectWallet = async () => {
    if (!checkMetaMask()) return;

    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      setAccount(accounts[0]);
      
      const isCorrect = await checkNetwork();
      if (!isCorrect) {
        showAlert('warning', t('switchNetworkFirst'));
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      setNetworkName(network.name === 'unknown' ? 'Localhost' : network.name);

      showAlert('success', t('walletConnected'));
      
      await loadData();
    } catch (error) {
      console.error(error);
      if (error.code === 4001) {
        showAlert('warning', t('userRejected'));
      } else {
        showAlert('danger', t('error', { error: error.message }));
      }
    }
  };

  // Ma'lumotlarni yuklash
  const loadData = async () => {
    if (!account) return;
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const tokenContract = new ethers.Contract(CONFIG.TOKEN_ADDRESS, MASTER_TOKEN_ABI, provider);
      const votingContract = new ethers.Contract(CONFIG.VOTING_ADDRESS, VOTING_ABI, provider);

      const tokenCode = await provider.getCode(CONFIG.TOKEN_ADDRESS);
      const votingCode = await provider.getCode(CONFIG.VOTING_ADDRESS);
      
      if (tokenCode === '0x') {
        showAlert('danger', t('tokenNotFound'));
        return;
      }
      
      if (votingCode === '0x') {
        showAlert('danger', t('votingNotFound'));
        return;
      }
      try {
        const claimed = await tokenContract.hasMinted(account);
        setHasClaimed(claimed);
      }
      catch (error) {
      console.log('hasMinted check not available');
    }
      const bal = await tokenContract.balanceOf(account);
      setBalance(ethers.formatEther(bal));

      const active = await votingContract.votingActive();
      setIsVotingActive(active);

      const results = await votingContract.getResults();
      setVotingOptions(results.map((opt, idx) => ({
        id: idx,
        name: opt.name,
        votes: ethers.formatEther(opt.votes)
      })));

      const userVotes = await votingContract.totalVotesByUser(account);
      setUserTotalVotes(ethers.formatEther(userVotes));

    } catch (error) {
      console.error('Load data error:', error);
      showAlert('danger', t('loadError', { error: error.message }));
    }
  };
// Token olish funksiyasi
const claimTokens = async () => {
  if (!isCorrectNetwork) {
    showAlert('warning', t('switchNetworkFirst'));
    return;
  }

  try {
    setIsClaiming(true);
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const tokenContract = new ethers.Contract(CONFIG.TOKEN_ADDRESS, MASTER_TOKEN_ABI, signer);

    // Avval tekshirish (agar hasMinted funksiyasi bor bo'lsa)
    try {
      const alreadyClaimed = await tokenContract.hasMinted(account);
      if (alreadyClaimed) {
        showAlert('warning', t('alreadyClaimed'));
        setHasClaimed(true);
        setIsClaiming(false);
        return;
      }
    } catch (error) {
      // Agar hasMinted funksiyasi yo'q bo'lsa, davom etamiz
      console.log('hasMinted check skipped');
    }

    showAlert('info', t('claimingTokens'));
    
    // mintForNewUser funksiyasini chaqirish
    const tx = await tokenContract.mintForNewUser();
    
    showAlert('info', t('confirmClaim'));
    
    // Transaction tasdiqlashni kutish
    const receipt = await tx.wait();
    
    showAlert('success', t('claimSuccess'));
    setHasClaimed(true);
    
    // Balansni yangilash
    await loadData();
    
  } catch (error) {
    console.error('Claim error:', error);
    
    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      showAlert('warning', t('txRejected'));
    } else if (error.message?.includes('already claimed')) {
      showAlert('warning', t('alreadyClaimed'));
      setHasClaimed(true);
    } else {
      showAlert('danger', t('error', { error: error.reason || error.message }));
    }
  } finally {
    setIsClaiming(false);
  }
};
  // Ovoz berish
  const handleVote = async () => {
    if (!voteAmount || parseFloat(voteAmount) <= 0) {
      showAlert('warning', t('enterAmount'));
      return;
    }

    if (parseFloat(voteAmount) > parseFloat(balance)) {
      showAlert('warning', t('insufficientBalance'));
      return;
    }

    if (!isCorrectNetwork) {
      showAlert('warning', t('switchNetworkFirst'));
      return;
    }

    try {
      setLoading(true);
      const amount = ethers.parseEther(voteAmount);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const tokenContract = new ethers.Contract(CONFIG.TOKEN_ADDRESS, MASTER_TOKEN_ABI, signer);
      const votingContract = new ethers.Contract(CONFIG.VOTING_ADDRESS, VOTING_ABI, signer);

      showAlert('info', t('approvingToken'));
      const approveTx = await tokenContract.approve(CONFIG.VOTING_ADDRESS, amount);
      
      showAlert('info', t('confirmingApprove'));
      await approveTx.wait();
      showAlert('success', t('tokenApproved'));

      showAlert('info', t('sendingVote'));
      const voteTx = await votingContract.vote(selectedOption, amount);
      
      showAlert('info', t('confirmingVote'));
      const receipt = await voteTx.wait();
      
      showAlert('success', t('voteSuccess', { hash: receipt.hash.slice(0, 10) }));
      setVoteAmount('');
      
      await loadData();
    } catch (error) {
      console.error(error);
      if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
        showAlert('warning', t('txRejected'));
      } else {
        showAlert('danger', t('error', { error: error.reason || error.message }));
      }
    } finally {
      setLoading(false);
    }
  };

  // MetaMask event listenerlar
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        loadData();
      } else {
        setAccount('');
        showAlert('warning', t('walletDisconnected'));
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
  }, [account, language]);

  // Auto-refresh
  useEffect(() => {
    if (account && isCorrectNetwork) {
      const interval = setInterval(() => {
        loadData();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [account, isCorrectNetwork]);

  const totalVotes = votingOptions.reduce((sum, opt) => sum + parseFloat(opt.votes), 0);

  return (
    <div className="min-vh-100" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* Navbar */}
      <nav className="navbar navbar-dark bg-dark shadow">
        <div className="container">
          <span className="navbar-brand mb-0 h1">
            <i className="bi bi-box-ballot-fill me-2"></i>
            {t('appName')}
          </span>
          <div className="d-flex align-items-center gap-2">
            {/* Language Selector */}
            <div className="btn-group">
              <button 
                className={`btn btn-sm ${language === 'uz' ? 'btn-primary' : 'btn-outline-light'}`}
                onClick={() => setLanguage('uz')}
              >
                O'zbekcha
              </button>
              <button 
                className={`btn btn-sm ${language === 'ko' ? 'btn-primary' : 'btn-outline-light'}`}
                onClick={() => setLanguage('ko')}
              >
                한국어
              </button>
              <button 
                className={`btn btn-sm ${language === 'en' ? 'btn-primary' : 'btn-outline-light'}`}
                onClick={() => setLanguage('en')}
              >
                English
              </button>
            </div>
            
            {account ? (
              <>
               {/* GET TOKEN TUGMASI */}
    {!hasClaimed && (
      <button 
        className="btn btn-success btn-sm"
        onClick={claimTokens}
        disabled={isClaiming || !isCorrectNetwork}
      >
        {isClaiming ? (
          <>
            <span className="spinner-border spinner-border-sm me-2"></span>
            {t('claimingTokens')}
          </>
        ) : (
          <>
            <i className="bi bi-gift me-2"></i>
            {t('claimTokens')}
          </>
        )}
      </button>
    )}
                <span className="badge bg-success">{networkName}</span>
                {!isCorrectNetwork && (
                  <button className="btn btn-warning btn-sm" onClick={switchNetwork}>
                    {t('switchNetwork')}
                  </button>
                )}
                <span className="text-white">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
                <span className="badge bg-light text-dark">{parseFloat(balance).toFixed(2)} MTK</span>
              </>
            ) : (
              <button className="btn btn-primary" onClick={connectWallet}>
                <i className="bi bi-wallet2 me-2"></i>
                {t('connectWallet')}
              </button>
            )}
          </div>
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

      <div className="container py-5">
        {!account ? (
          <div className="row justify-content-center">
            <div className="col-md-6">
              <div className="card shadow-lg border-0">
                <div className="card-body text-center p-5">
                  <i className="bi bi-wallet2 display-1 text-primary mb-3"></i>
                  <h3 className="mb-3">{t('walletConnection')}</h3>
                  <p className="text-muted mb-4">
                    {t('connectDescription')}
                  </p>
                  <button className="btn btn-primary btn-lg" onClick={connectWallet}>
                    <i className="bi bi-wallet2 me-2"></i>
                    {t('connectWallet')}
                  </button>
                  <div className="mt-4">
                    <small className="text-muted">
                      <i className="bi bi-info-circle me-1"></i>
                      {t('chainId')}: {CONFIG.CHAIN_ID}
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="row g-4">
            {/* Balans */}
            <div className="col-md-4">
              <div className="card shadow-lg border-0 h-100">
                <div className="card-body">
                  <h5 className="card-title">
                    <i className="bi bi-coin text-warning me-2"></i>
                    {t('tokenBalance')}
                  </h5>
                  <hr />
                  <div className="mb-3">
                    <small className="text-muted">{t('availableTokens')}</small>
                    <h3 className="text-primary mb-0">{parseFloat(balance).toFixed(2)} MTK</h3>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted">{t('votesGiven')}</small>
                    <h5 className="text-success mb-0">{parseFloat(userTotalVotes).toFixed(2)} MTK</h5>
                  </div>
                  <div className={`alert ${isVotingActive ? 'alert-success' : 'alert-secondary'} mb-0`}>
                    <small>
                      <i className="bi bi-info-circle me-1"></i>
                      {t('voting')}: 
                      {isVotingActive ? (
                        <span className="badge bg-success ms-2">{t('active')} ✓</span>
                      ) : (
                        <span className="badge bg-secondary ms-2">{t('inactive')}</span>
                      )}
                    </small>
                  </div>
                </div>
              </div>
            </div>

            {/* Ovoz berish */}
            <div className="col-md-8">
              <div className="card shadow-lg border-0">
                <div className="card-body">
                  <h5 className="card-title">
                    <i className="bi bi-hand-thumbs-up text-primary me-2"></i>
                    {t('voteTitle')}
                  </h5>
                  <hr />
                  
                  {!isCorrectNetwork ? (
                    <div className="alert alert-warning">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      {t('wrongNetworkWarning')}
                    </div>
                  ) : votingOptions.length === 0 ? (
                    <div className="alert alert-info">
                      <i className="bi bi-info-circle me-2"></i>
                      {t('loadingOptions')}
                    </div>
                  ) : (
                    <>
                      <div className="mb-3">
                        <label className="form-label fw-bold">{t('selectOption')}</label>
                        <select 
                          className="form-select form-select-lg" 
                          value={selectedOption}
                          onChange={(e) => setSelectedOption(parseInt(e.target.value))}
                          disabled={!isVotingActive || loading}
                        >
                          {votingOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name} ({parseFloat(opt.votes).toFixed(2)} {t('votes')})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="mb-3">
                        <label className="form-label fw-bold">{t('tokenAmount')}</label>
                        <div className="input-group input-group-lg">
                          <input
                            type="number"
                            className="form-control"
                            placeholder={t('placeholder')}
                            value={voteAmount}
                            onChange={(e) => setVoteAmount(e.target.value)}
                            disabled={!isVotingActive || loading}
                            min="0"
                            step="0.01"
                          />
                          <span className="input-group-text">MTK</span>
                        </div>
                        <small className="text-muted">
                          {t('available')}: {parseFloat(balance).toFixed(2)} MTK
                        </small>
                      </div>

                      <button 
                        className="btn btn-primary btn-lg w-100"
                        onClick={handleVote}
                        disabled={loading || !isVotingActive}
                      >
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            {t('waitingMetaMask')}
                          </>
                        ) : (
                          <>
                            <i className="bi bi-check-circle me-2"></i>
                            {t('voteButton')}
                          </>
                        )}
                      </button>
                      
                      {loading && (
                        <div className="alert alert-info mt-3 mb-0">
                          <small>
                            <i className="bi bi-hourglass-split me-2"></i>
                            {t('checkMetaMask')}
                          </small>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Natijalar */}
            <div className="col-12">
              <div className="card shadow-lg border-0">
                <div className="card-body">
                  <h5 className="card-title">
                    <i className="bi bi-bar-chart text-success me-2"></i>
                    {t('results')}
                  </h5>
                  <hr />
                  
                  {votingOptions.length === 0 ? (
                    <p className="text-muted">{t('loadingResults')}</p>
                  ) : (
                    <div className="row g-3">
                      {votingOptions.map((option) => {
                        const percentage = totalVotes > 0 
                          ? ((parseFloat(option.votes) / totalVotes) * 100).toFixed(1)
                          : 0;
                        
                        return (
                          <div key={option.id} className="col-12">
                            <div className="d-flex justify-content-between mb-2">
                              <span className="fw-bold">{option.name}</span>
                              <span className="text-muted">
                                {parseFloat(option.votes).toFixed(2)} MTK ({percentage}%)
                              </span>
                            </div>
                            <div className="progress" style={{ height: '30px' }}>
                              <div 
                                className="progress-bar bg-primary progress-bar-striped progress-bar-animated"
                                style={{ width: `${percentage}%` }}
                              >
                                {percentage}%
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      <div className="col-12 mt-4">
                        <div className="alert alert-info mb-0">
                          <i className="bi bi-info-circle me-2"></i>
                          <strong>{t('totalVotes')}:</strong> {totalVotes.toFixed(2)} MTK
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="bg-dark text-white text-center py-3 mt-5"  style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999 }}>
        <div className="container">
          <p className="mb-0">
            <i className="bi bi-code-slash me-2"></i>
            {t('copyright')}
          </p>
        </div>
      </footer>

      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" />
    </div>
  );
}

export default VotingDApp;