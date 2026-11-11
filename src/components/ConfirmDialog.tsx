import { useId, type ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Blocking confirmation for destructive actions. The cancel button receives
 * initial focus so an accidental Enter does not confirm.
 */
export function ConfirmDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  isBusy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onCancel, !isBusy);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-duo-charcoal/40 backdrop-blur-sm"
        onClick={isBusy ? undefined : onCancel}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="relative bg-white rounded-3xl border-2 border-duo-border shadow-duo-modal max-w-md w-full p-6 animate-scale-in"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-duo-red-subtle border-2 border-duo-red flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-duo-red" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-heading font-black text-duo-charcoal mb-2 break-words">
              {title}
            </h2>
            <div id={descriptionId} className="text-sm text-duo-pencil font-medium space-y-2">
              {children}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            data-autofocus
            onClick={onCancel}
            disabled={isBusy}
            className="px-5 py-2.5 text-sm font-extrabold text-duo-charcoal bg-white border-2 border-duo-border rounded-2xl hover:bg-duo-border/40 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-extrabold text-white bg-duo-red border-2 border-duo-red rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
