import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";

export interface ModalProps {
  type: 'loading' | 'success' | 'error' | 'confirm';
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

const Modal: React.FC<ModalProps> = ({ 
  type, 
  isOpen, 
  onClose, 
  title, 
  message, 
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel"
}) => {
  if (!isOpen) return null;

  // Default content based on type
  const getDefaultContent = () => {
    switch (type) {
      case 'success':
        return {
          title: title || "Success!",
          message: message || "Transaction Submitted!",
          image: "/images/tick.png",
          buttonText: "Close"
        };
      case 'error':
        return {
          title: title || "Something went wrong...",
          message: message || "Please try again or seek help if needed",
          image: "/images/error.png",
          buttonText: "Back"
        };
      case 'loading':
        return {
          title: title || "Processing",
          message: message || "Please wait...",
          image: null,
          buttonText: null
        };
      case 'confirm':
        return {
          title: title || "Confirm Action",
          message: message || "Are you sure you want to proceed?",
          image: null,
          buttonText: confirmText
        };
    }
  };

  const content = getDefaultContent();

  return (
    <div className="bg-black/80 flex items-center justify-center min-h-screen w-full fixed z-[100] top-0 left-0" style={{ opacity: 1 }}>
      <div className="bg-background border border-border max-w-sm w-full h-[430px] rounded-2xl p-7 pb-14 w-11/12">
        <div className="text-right mb-9">
          <FontAwesomeIcon 
            icon={faXmark} 
            className="text-muted-foreground text-2xl cursor-pointer" 
            onClick={onClose} 
            role="button" 
          />
        </div>
        
        <div className="text-center">
          {/* Image or Loading Spinner */}
          {type === 'loading' ? (
            <div className="relative flex items-center justify-center w-40 h-40 mx-auto rounder-full mb-5">
              <svg viewBox="0 0 160 160" className="animate-spin">
                <g id="Group_6891" data-name="Group 6891" transform="translate(-3382 704)">
                  <g id="Ellipse_110" data-name="Ellipse 110" transform="translate(3382 -704)" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="5">
                    <circle cx="80" cy="80" r="80" stroke="none" />
                    <circle cx="80" cy="80" r="77.5" fill="none" />
                  </g>
                  <g id="Ellipse_111" data-name="Ellipse 111" transform="translate(3382 -704)" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="161 362">
                    <circle cx="80" cy="80" r="80" stroke="none" />
                    <circle cx="80" cy="80" r="77.5" fill="none" />
                  </g>
                </g>
              </svg>
            </div>
          ) : content.image ? (
            <div className="mb-5">
              <img src={content.image} className="m-auto" alt={type} />
            </div>
          ) : null}

          {/* Title */}
          <h4 className="text-foreground text-2xl font-medium mb-4">{content.title}</h4>
          
          {/* Message */}
          <p className="mb-4 text-muted-foreground text-base font-normal leading-6">
            {content.message}
          </p>

          {/* Buttons */}
          {type === 'confirm' ? (
            <div className="flex gap-3 justify-center">
              <button 
                className="h-14 min-w-32 rounded-[44px] px-7 bg-secondary text-secondary-foreground text-xl font-semibold" 
                onClick={onClose}
              >
                {cancelText}
              </button>
              <button 
                className="h-14 min-w-32 rounded-[44px] px-7 bg-primary text-primary-foreground text-xl font-semibold" 
                onClick={() => {
                  onConfirm?.();
                  onClose();
                }}
              >
                {content.buttonText}
              </button>
            </div>
          ) : content.buttonText ? (
            <button 
              className="h-14 min-w-72 rounded-[44px] px-7 bg-primary text-primary-foreground text-2xl font-semibold" 
              onClick={onClose}
            >
              {content.buttonText}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Modal;