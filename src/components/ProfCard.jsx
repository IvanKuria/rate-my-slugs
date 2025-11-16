import React from "react";

function ProfCard({ professorName, professorUID }) {
  return (
    <div className="prof-card-content">
      <h4 className="prof-card-title">Professor Information</h4>
      <div className="prof-card-details">
        <div className="prof-card-row">
          <span className="prof-card-label">Professor Name:</span>
          <span className="prof-card-value">{professorName}</span>
        </div>
        <div className="prof-card-row">
          <span className="prof-card-label">UCSC UID:</span>
          <span className="prof-card-value">{professorUID}</span>
        </div>
      </div>
    </div>
  );
}

export default ProfCard;
