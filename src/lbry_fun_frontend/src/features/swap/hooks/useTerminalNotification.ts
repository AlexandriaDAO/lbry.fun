import { useState, useCallback } from 'react';

interface NotificationState {
  type: 'loading' | 'success' | 'error' | 'confirm';
  isOpen: boolean;
  title?: string;
  message?: string;
  onConfirm?: () => void;
}

export const useTerminalNotification = () => {
  const [notification, setNotification] = useState<NotificationState>({
    type: 'success',
    isOpen: false,
  });

  const showLoading = useCallback((title?: string, message?: string) => {
    setNotification({
      type: 'loading',
      isOpen: true,
      title,
      message,
    });
  }, []);

  const showSuccess = useCallback((title?: string, message?: string) => {
    setNotification({
      type: 'success',
      isOpen: true,
      title,
      message,
    });
  }, []);

  const showError = useCallback((title?: string, message?: string) => {
    setNotification({
      type: 'error',
      isOpen: true,
      title,
      message,
    });
  }, []);

  const showConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      setNotification({
        type: 'confirm',
        isOpen: true,
        title,
        message,
        onConfirm,
      });
    },
    []
  );

  const hide = useCallback(() => {
    setNotification((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    notification,
    showLoading,
    showSuccess,
    showError,
    showConfirm,
    hide,
  };
};