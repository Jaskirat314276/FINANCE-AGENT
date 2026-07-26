import { create } from 'zustand';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/outline';

type ToastTone = 'success' | 'error' | 'warning';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (tone: ToastTone, message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (tone, message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, tone, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToastStore.getState().push('success', m),
  error: (m: string) => useToastStore.getState().push('error', m),
  warning: (m: string) => useToastStore.getState().push('warning', m),
};

const icons: Record<ToastTone, typeof CheckCircleIcon> = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: ExclamationTriangleIcon,
};

const toneClass: Record<ToastTone, string> = {
  success: 'border-status-good/40 text-emerald-200',
  error: 'border-status-critical/40 text-red-200',
  warning: 'border-status-warning/40 text-amber-200',
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-80 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              onClick={() => dismiss(t.id)}
              className={`glass pointer-events-auto flex items-start gap-2.5 border p-3.5 text-left text-sm ${toneClass[t.tone]}`}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="text-slate-200">{t.message}</span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
