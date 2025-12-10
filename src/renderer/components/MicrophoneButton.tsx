import React from 'react';
import './MicrophoneButton.css';

interface MicrophoneButtonProps {
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export const MicrophoneButton: React.FC<MicrophoneButtonProps> = ({
  isActive,
  onClick,
  disabled = false
}) => {
  return (
    <button
      className={`microphone-button ${isActive ? 'active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={isActive ? 'Stop recording' : 'Start recording'}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {isActive ? (
          // Aktif durumda siyah mikrofon
          <path
            d="M12 14C13.1 14 14 13.1 14 12V6C14 4.9 13.1 4 12 4C10.9 4 10 4.9 10 6V12C10 13.1 10.9 14 12 14ZM19 12V11C19 8.24 16.76 6 14 6H13V4H15V2H9V4H11V6H10C7.24 6 5 8.24 5 11V12H7V11C7 9.34 8.34 8 10 8H14C15.66 8 17 9.34 17 11V12H19ZM12 16C9.79 16 8 14.21 8 12H6C6 14.76 8.24 17 11 17V19H13V17C15.76 17 18 14.76 18 12H16C16 14.21 14.21 16 12 16Z"
            fill="currentColor"
          />
        ) : (
          // Pasif durumda outline mikrofon
          <path
            d="M12 14C13.1 14 14 13.1 14 12V6C14 4.9 13.1 4 12 4C10.9 4 10 4.9 10 6V12C10 13.1 10.9 14 12 14ZM19 12V11C19 8.24 16.76 6 14 6H13V4H15V2H9V4H11V6H10C7.24 6 5 8.24 5 11V12H7V11C7 9.34 8.34 8 10 8H14C15.66 8 17 9.34 17 11V12H19ZM12 16C9.79 16 8 14.21 8 12H6C6 14.76 8.24 17 11 17V19H13V17C15.76 17 18 14.76 18 12H16C16 14.21 14.21 16 12 16Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  );
};

