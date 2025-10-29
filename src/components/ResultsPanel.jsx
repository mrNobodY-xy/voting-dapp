import React from "react";
import { ProgressBar, Card } from "react-bootstrap";

const ResultsPanel = ({ results }) => {
  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);

  return (
    <div className="my-4">
      <h4>Results</h4>
      {results.map((r, idx) => {
        const percent = totalVotes === 0 ? 0 : (r.votes / totalVotes) * 100;
        return (
          <Card key={idx} className="mb-2 p-2">
            <strong>{r.name}</strong>
            <ProgressBar now={percent} label={`${percent.toFixed(1)}%`} />
          </Card>
        );
      })}
    </div>
  );
};

export default ResultsPanel;
