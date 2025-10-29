import React, { useEffect, useState } from "react";
import { ethers } from "ethers";

const Navbar = () => {
  const [account, setAccount] = useState(null);

  // MetaMask bilan ulanish funksiyasi
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("MetaMask topilmadi! Iltimos, uni o‘rnating.");
        return;
      }
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
    } catch (err) {
      console.error("MetaMask bilan ulanishda xatolik:", err);
    }
  };

  // Wallet allaqachon ulangan bo‘lsa, uni avtomatik olish
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) setAccount(accounts[0]);
      }
    };
    checkWalletConnection();
  }, []);

  return (
    <nav className="navbar navbar-expand-lg bg-dark navbar-dark shadow-sm px-4 py-3">
      <div className="container-fluid">
        <a className="navbar-brand fw-bold fs-4 text-info" href="#">
          🗳️ Tokenized Voting DApp
        </a>

        <div className="d-flex align-items-center ms-auto">
          {account ? (
            <button className="btn btn-outline-success fw-semibold">
              {account.slice(0, 6)}...{account.slice(-4)}
            </button>
          ) : (
            <button onClick={connectWallet} className="btn btn-warning fw-semibold">
              Connect MetaMask
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
