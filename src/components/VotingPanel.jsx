import React, { useState, useEffect } from "react";
import { Button, Form, Card } from "react-bootstrap";
import { ethers } from "ethers";

const VotingPanel = ({ votingContract, tokenContract, account, fetchResults, setBalance }) => {
  const [options, setOptions] = useState([]);
  const [amounts, setAmounts] = useState([]);

  const fetchOptions = async () => {
    if (!votingContract) return;
    const res = await votingContract.getResults();
    setOptions(res.map(o => o.name));
    setAmounts(new Array(res.length).fill(0));
  };

  useEffect(() => { fetchOptions(); }, [votingContract]);

  const handleVote = async (optionId) => {
    if (!votingContract || !tokenContract) return;
    const amount = amounts[optionId];
    if (amount <= 0) return alert("Token miqdorini kiriting");

    const amountWei = ethers.parseUnits(amount.toString(), 18);
    await tokenContract.approve(votingContract.target, amountWei);
    await votingContract.vote(optionId, amountWei);
    fetchResults();

    const bal = await tokenContract.balanceOf(account);
    setBalance(ethers.formatUnits(bal, 18));
  };

  return (
    <div className="my-4">
      <h4>Vote for a Module</h4>
      {options.map((opt, idx) => (
        <Card key={idx} className="mb-2 p-2">
          <div className="d-flex align-items-center justify-content-between">
            <span>{opt}</span>
            <div>
              <Form.Control 
                type="number" 
                min="0" 
                value={amounts[idx]} 
                onChange={(e) => {
                  const newAmounts = [...amounts];
                  newAmounts[idx] = e.target.value;
                  setAmounts(newAmounts);
                }} 
                style={{ width: "100px", display: "inline", marginRight: "10px" }}
              />
              <Button onClick={() => handleVote(idx)}>Vote</Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default VotingPanel;
