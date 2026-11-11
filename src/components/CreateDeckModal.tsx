import { X } from 'lucide-react';
import { CreateDeck } from './CreateDeck';
import { FileUploadDeck } from './FileUploadDeck';
import type { Deck } from '../types/flashcard';
import { useCallback, useId, useState } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';

interface CreateDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeckCreated: (newDeck: Deck) => Promise<void>;
  className?: string;
}

type Tab = 'create' | 'upload';

export function CreateDeckModal({ isOpen, onClose, onDeckCreated }: CreateDeckModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [busyCount, setBusyCount] = useState(0);
  const isBusy = busyCount > 0;
  const titleId = useId();
  const createPanelId = useId();
  const uploadPanelId = useId();

  // Closing mid-generation would throw away a request that is already
  // spending AI quota, and its result would have nowhere to go.
  const requestClose = useCallback(() => {
    if (!isBusy) onClose();
  }, [isBusy, onClose]);

  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, requestClose, !isBusy);

  const trackBusy = useCallback((busy: boolean) => {
    setBusyCount((count) => Math.max(0, count + (busy ? 1 : -1)));
  }, []);

  if (!isOpen) return null;

  const handleDeckCreated = async (deck: Deck) => {
    await onDeckCreated(deck);
    onClose();
  };

  const tabClass = (tab: Tab, activeClass: string) =>
    `flex-1 py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 ${
      activeTab === tab ? activeClass : 'text-duo-pencil hover:text-duo-charcoal'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-duo-charcoal/40 backdrop-blur-sm transition-opacity"
        onClick={requestClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={isBusy}
        tabIndex={-1}
        className="relative bg-white rounded-3xl border-2 border-duo-border shadow-duo-modal max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-scale-in"
      >
        <button
          type="button"
          onClick={requestClose}
          disabled={isBusy}
          aria-label="Close"
          className="absolute top-5 right-5 p-2 text-duo-pencil hover:text-duo-charcoal hover:bg-duo-border/40 rounded-full border-2 border-transparent hover:border-duo-border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>
        <div className="p-6 md:p-10">
          <h2 id={titleId} className="text-2xl md:text-3xl font-heading font-black text-duo-charcoal mb-2">
            Create New Deck
          </h2>
          <p className="text-duo-pencil mb-8 font-medium">
            Choose how you want to build your new study set.
          </p>

          {/* Mobile tabs. On desktop both panels are visible side by side. */}
          <div
            role="tablist"
            aria-label="Deck source"
            className="md:hidden flex space-x-2 mb-6 bg-duo-paper p-1.5 rounded-2xl border-2 border-duo-border"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'create'}
              aria-controls={createPanelId}
              onClick={() => setActiveTab('create')}
              className={tabClass('create', 'bg-duo-green text-white shadow-duo-green')}
            >
              Generate AI
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'upload'}
              aria-controls={uploadPanelId}
              onClick={() => setActiveTab('upload')}
              className={tabClass('upload', 'bg-duo-blue text-white shadow-duo-blue')}
            >
              Upload File
            </button>
          </div>

          {/*
            Each form is mounted exactly once. The old markup rendered a desktop
            and a mobile copy of both, which duplicated element ids (labels
            pointed at the wrong input) and ran two independent form states.
          */}
          <div className="md:grid md:grid-cols-2 md:gap-8">
            <div
              id={createPanelId}
              className={`card-duo p-6 bg-white ${activeTab === 'create' ? 'block' : 'hidden'} md:block`}
            >
              <h3 className="hidden md:flex text-lg font-heading font-bold text-duo-charcoal mb-4 items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-duo-green-subtle border-2 border-duo-green flex items-center justify-center text-duo-green font-black text-xs">
                  AI
                </span>
                Generate with AI
              </h3>
              <CreateDeck onDeckCreated={handleDeckCreated} onBusyChange={trackBusy} />
            </div>
            <div
              id={uploadPanelId}
              className={`card-duo p-6 bg-white ${activeTab === 'upload' ? 'block' : 'hidden'} md:block`}
            >
              <h3 className="hidden md:flex text-lg font-heading font-bold text-duo-charcoal mb-4 items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-duo-blue-subtle border-2 border-duo-blue flex items-center justify-center text-duo-blue font-black text-xs">
                  PDF
                </span>
                Upload Document
              </h3>
              <FileUploadDeck onDeckCreated={handleDeckCreated} onBusyChange={trackBusy} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
