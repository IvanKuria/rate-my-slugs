import React, { useState } from "react";
import Modal from "./Modal.jsx";
import ProfCard from "./ProfCard.jsx";

function ShowProfInfo({ professorName, professorUID }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      <button className="show-prof-info-btn" onClick={openModal}>
        Show Prof Info
      </button>
      
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <ProfCard professorName={professorName} professorUID={professorUID} />
      </Modal>
    </>
  );
}

export default ShowProfInfo;
