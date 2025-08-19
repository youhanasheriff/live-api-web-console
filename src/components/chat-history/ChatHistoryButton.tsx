import React, { useState } from 'react';
import { RiHistoryLine } from 'react-icons/ri';
import ChatHistoryModal from './ChatHistoryModal';

interface ChatHistoryButtonProps {
  className?: string;
}

const ChatHistoryButton: React.FC<ChatHistoryButtonProps> = ({ className }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <button 
        className={`action-button ${className || ''}`}
        onClick={handleOpenModal}
        title="Chat History"
        aria-label="Open chat history"
      >
        <RiHistoryLine size={20} />
      </button>
      
      {isModalOpen && (
        <ChatHistoryModal
          open={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default ChatHistoryButton;