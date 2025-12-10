import React, { useRef, useEffect, useState } from 'react';
import './TextBox.css';

interface TextBoxProps {
  value: string;
  onChange: (value: string) => void;
  onRightClick: (e: React.MouseEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  fontSize?: number;
  fontFamily?: string;
}

export const TextBox: React.FC<TextBoxProps> = ({
  value,
  onChange,
  onRightClick,
  placeholder = 'Your speech will type here',
  disabled = false,
  children,
  fontSize = 14,
  fontFamily
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    // Resize sırasında otomatik ayarlamayı atla
    if (isResizing) return;
    
    // Textarea yüksekliğini içeriğe göre otomatik ayarla
    if (textareaRef.current && containerRef.current) {
      // Önce height'ı auto yap ki scrollHeight doğru hesaplansın
      textareaRef.current.style.height = 'auto';
      // Sonra içeriğe göre minimum yüksekliği hesapla
      const scrollHeight = textareaRef.current.scrollHeight;
      const minHeight = Math.max(40, scrollHeight);
      
      // Container'ın height'ını textarea'nın minimum yüksekliğine göre ayarla
      containerRef.current.style.height = `${minHeight}px`;
      
      // Textarea'nın height'ını container'ın height'ına eşitle
      // Bu sayede içerik uzun olduğunda scrollbar çıkacak (overflow-y: auto sayesinde)
      textareaRef.current.style.height = `${minHeight}px`;
    }
  }, [value, isResizing]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter ile gönder
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      // Parent component'te handleSend çağrılacak
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = containerRef.current?.offsetWidth || 0;
    const startHeight = containerRef.current?.offsetHeight || 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const newWidth = startWidth + (moveEvent.clientX - startX);
      const newHeight = startHeight + (moveEvent.clientY - startY);
      
      containerRef.current.style.width = `${Math.max(300, newWidth)}px`;
      containerRef.current.style.height = `${Math.max(40, newHeight)}px`;
      
      // Textarea boyutlarını container'a göre ayarla
      if (textareaRef.current) {
        textareaRef.current.style.width = `${containerRef.current.offsetWidth}px`;
        textareaRef.current.style.height = `${containerRef.current.offsetHeight}px`;
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div ref={containerRef} className="text-box-container">
      <textarea
        ref={textareaRef}
        className="text-box"
        value={value}
        onChange={handleChange}
        onContextMenu={onRightClick}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          resize: 'none',
          fontSize: `${fontSize}px`,
          fontFamily: fontFamily || 'inherit'
        }}
      />
      {children && (
        <div className="text-box-buttons">
          {children}
        </div>
      )}
      <div 
        className="text-box-resize-handle"
        onMouseDown={handleResizeStart}
      />
    </div>
  );
};

