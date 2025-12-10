import React from 'react';
import './SendButton.css';

interface SendButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const SendButton: React.FC<SendButtonProps> = ({
  onClick,
  disabled = false
}) => {
  return (
    <button
      className="send-button"
      onClick={onClick}
      disabled={disabled}
      title="Send to AI (Ctrl+Enter)"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2 21L23 12L2 3V10L17 12L2 14V21Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
};

