'use client';

import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast, type ToasterToast } from '@/hooks/use-toast';

// ─── Toast Variants ─────────────────────────────────────────────

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-xl border p-4 shadow-soft transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[state=open]:animate-fade-in-right data-[state=closed]:animate-fade-out-right data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full',
  {
    variants: {
      variant: {
        default: 'border-slate-200 bg-white text-slate-900',
        destructive:
          'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
        success:
          'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
        warning:
          'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

// ─── Icon Map ───────────────────────────────────────────────────

const iconMap: Record<string, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-emerald-500" />,
  destructive: <AlertCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  default: <Info className="text-jeevandata-500 h-5 w-5" />,
};

// ─── Toast Component ────────────────────────────────────────────

interface ToastProps
  extends
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root>,
    VariantProps<typeof toastVariants> {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  onClose?: () => void;
}

const Toast = React.forwardRef<React.ElementRef<typeof ToastPrimitives.Root>, ToastProps>(
  ({ className, variant, title, description, action, onClose, ...props }, ref) => {
    return (
      <ToastPrimitives.Root
        ref={ref}
        className={cn(toastVariants({ variant }), className)}
        {...props}
      >
        {/* Icon */}
        <div className="flex-shrink-0">{iconMap[variant ?? 'default'] ?? iconMap.default}</div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {title && (
            <ToastPrimitives.Title className="text-sm font-semibold">{title}</ToastPrimitives.Title>
          )}
          {description && (
            <ToastPrimitives.Description className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {description}
            </ToastPrimitives.Description>
          )}
        </div>

        {/* Action */}
        {action && <div className="flex-shrink-0">{action}</div>}

        {/* Close */}
        <ToastPrimitives.Close
          onClick={onClose}
          className="focus:ring-ring flex-shrink-0 rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:text-slate-600 focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </ToastPrimitives.Close>
      </ToastPrimitives.Root>
    );
  },
);
Toast.displayName = 'Toast';

// ─── Toaster Viewport ───────────────────────────────────────────

interface ToasterProps {
  className?: string;
}

export function Toaster({ className }: ToasterProps) {
  const { toasts, dismiss } = useToast();

  return (
    <ToastPrimitives.Provider>
      {/* Toast list */}
      {toasts.map((toast: ToasterToast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          title={toast.title}
          description={toast.description}
          action={toast.action}
          onClose={() => dismiss(toast.id)}
        />
      ))}

      {/* Viewport — fixed position bottom-right */}
      <ToastPrimitives.Viewport
        className={cn(
          'fixed bottom-4 right-4 z-[100] flex max-h-screen w-full max-w-sm flex-col-reverse gap-2 p-4',
          className,
        )}
      />
    </ToastPrimitives.Provider>
  );
}
