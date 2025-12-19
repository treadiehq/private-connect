interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
  duration?: number;
}

const toasts = ref<Toast[]>([]);

export const useToast = () => {
  const show = (options: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2);
    const toast: Toast = { id, ...options };
    toasts.value.push(toast);
    
    if (options.duration !== 0) {
      setTimeout(() => {
        remove(id);
      }, options.duration || 4000);
    }
    
    return id;
  };

  const success = (message: string, title?: string) => {
    return show({ type: 'success', message, title });
  };

  const error = (message: string, title?: string) => {
    return show({ type: 'error', message, title });
  };

  const info = (message: string, title?: string) => {
    return show({ type: 'info', message, title });
  };

  const remove = (id: string) => {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index > -1) {
      toasts.value.splice(index, 1);
    }
  };

  return {
    toasts: readonly(toasts),
    show,
    success,
    error,
    info,
    remove,
  };
};

