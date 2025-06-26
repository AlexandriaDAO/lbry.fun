import { useState, useCallback } from 'react';
import { ModalProps } from '../components/Modal';

type ModalState = Pick<ModalProps, 'type' | 'title' | 'message' | 'onConfirm'> & {
  isOpen: boolean;
};

export const useModal = () => {
  const [modal, setModal] = useState<ModalState>({
    type: 'loading',
    isOpen: false,
    title: undefined,
    message: undefined,
    onConfirm: undefined
  });

  const showError = useCallback((title?: string, message?: string) => {
    setModal({
      type: 'error',
      isOpen: true,
      title,
      message,
      onConfirm: undefined
    });
  }, []);

  const showSuccess = useCallback((title?: string, message?: string) => {
    setModal({
      type: 'success',
      isOpen: true,
      title,
      message,
      onConfirm: undefined
    });
  }, []);

  const showLoading = useCallback((title?: string, message?: string) => {
    setModal({
      type: 'loading',
      isOpen: true,
      title,
      message,
      onConfirm: undefined
    });
  }, []);

  const showConfirm = useCallback((
    title: string, 
    message: string, 
    onConfirm: () => void
  ) => {
    setModal({
      type: 'confirm',
      isOpen: true,
      title,
      message,
      onConfirm
    });
  }, []);

  const hide = useCallback(() => {
    setModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    modal,
    showError,
    showSuccess,
    showLoading,
    showConfirm,
    hide
  };
};