import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ArrowLeft, Trash2, Plus, Save, Search, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';
import type { Deck, Flashcard } from '../types/flashcard';

interface EditDeckPageProps {
  deck: Deck;
  onSave: (updates: Partial<Deck>) => void;
  onCancel: () => void;
}

const FRONT_MAX = 2000;
const BACK_MAX = 4000;
const DESC_MAX = 160;

export function EditDeckPage({ deck, onSave, onCancel }: EditDeckPageProps) {
  const [title, setTitle] = useState(deck.title);
  const [description, setDescription] = useState(deck.description);
  const [cards, setCards] = useState<Flashcard[]>(deck.cards);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const sidebarRef = useRef<HTMLDivElement>(null);

  const activeCard = cards[activeIndex] || null;

  // Filter cards by search
  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return cards.map((c, i) => ({ card: c, originalIndex: i }));
    const q = searchQuery.toLowerCase();
    return cards
      .map((c, i) => ({ card: c, originalIndex: i }))
      .filter(({ card }) =>
        card.front.toLowerCase().includes(q) || card.back.toLowerCase().includes(q)
      );
  }, [cards, searchQuery]);

  // Scroll active card into view in sidebar
  useEffect(() => {
    const el = sidebarRef.current?.querySelector(`[data-card-index="${activeIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  const goPrev = useCallback(() => setActiveIndex(i => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setActiveIndex(i => Math.min(cards.length - 1, i + 1)), [cards.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Enter: go next
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext]);

  const handleSave = () => {
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required');
      return;
    }
    if (cards.length === 0) {
      setError('At least one card is required');
      return;
    }
    if (cards.some(card => !card.front.trim() || !card.back.trim())) {
      setError('All cards must have both front and back content');
      return;
    }
    setError(null);
    onSave({ title, description, cards });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const handleCardChange = useCallback((field: 'front' | 'back', value: string) => {
    setCards(prev => {
      const next = [...prev];
      next[activeIndex] = { ...next[activeIndex], [field]: value };
      return next;
    });
  }, [activeIndex]);

  const addCard = useCallback(() => {
    const newCard: Flashcard = { id: crypto.randomUUID(), front: '', back: '' };
    setCards(prev => [...prev, newCard]);
    setActiveIndex(cards.length);
    setSearchQuery('');
  }, [cards.length]);

  const removeCard = useCallback((index: number) => {
    if (cards.length <= 1) return;
    setCards(prev => prev.filter((_, i) => i !== index));
    if (activeIndex >= index && activeIndex > 0) {
      setActiveIndex(prev => prev - 1);
    }
  }, [cards.length, activeIndex]);

  const duplicateCard = useCallback(() => {
    if (!activeCard) return;
    const dup: Flashcard = { ...activeCard, id: crypto.randomUUID() };
    setCards(prev => {
      const next = [...prev];
      next.splice(activeIndex + 1, 0, dup);
      return next;
    });
    setActiveIndex(activeIndex + 1);
  }, [activeCard, activeIndex]);

  return (
    <div className="h-[calc(100vh-65px)] min-h-[500px] bg-white flex flex-col overflow-hidden">
      {/* ============================================================ */}
      {/*  TOP BAR                                                      */}
      {/* ============================================================ */}
      <div className="border-b-2 border-duo-border bg-white flex-shrink-0 z-20">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Left: back + title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onCancel}
              className="text-duo-pencil hover:text-duo-charcoal transition-colors flex items-center gap-1.5 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline text-sm font-bold">Back to Decks</span>
            </button>
            <span className="text-duo-border hidden sm:inline">|</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-heading font-black text-duo-charcoal text-sm sm:text-base truncate">
                Edit Deck
              </span>
              <span className="text-duo-pencil hidden md:inline">·</span>
              <span className="text-duo-pencil font-bold text-sm hidden md:inline truncate max-w-[200px]">
                {title || 'Untitled'}
              </span>
              <span className="text-xs font-extrabold text-duo-charcoal bg-duo-gold-subtle px-2.5 py-0.5 rounded-full border-2 border-duo-gold flex-shrink-0">
                {cards.length} cards
              </span>
            </div>
          </div>

          {/* Right: save status + actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {saveStatus === 'saved' && (
              <span className="text-duo-green font-bold text-xs flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            {error && (
              <span className="text-duo-red font-bold text-xs hidden sm:inline">{error}</span>
            )}
            <button
              onClick={handleSave}
              className="btn-duo-green duo-label px-5 py-2 text-xs tracking-wider shadow-duo-green flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Save</span>
            </button>
            <button
              onClick={addCard}
              className="btn-duo-blue duo-label px-4 py-2 text-xs tracking-wider shadow-duo-blue flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden sm:inline">Add card</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  MAIN CONTENT: Sidebar + Editor                              */}
      {/* ============================================================ */}
      <div className="flex-1 flex max-w-[1400px] mx-auto w-full min-h-0 overflow-hidden">
        {/* ---------------------------------------------------------- */}
        {/*  LEFT SIDEBAR (Cards list scrolls internally)               */}
        {/* ---------------------------------------------------------- */}
        <aside className="w-80 flex-shrink-0 border-r-2 border-duo-border bg-white hidden lg:flex flex-col h-full min-h-0 overflow-hidden">
          {/* Deck Details */}
          <div className="p-5 border-b-2 border-duo-border space-y-4 flex-shrink-0">
            <h3 className="text-sm font-heading font-extrabold text-duo-charcoal">Deck details</h3>
            <div>
              <label className="block text-xs font-bold text-duo-pencil uppercase tracking-wider mb-1.5">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-duo-border rounded-xl focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green transition-all bg-white text-duo-charcoal font-bold text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-duo-pencil uppercase tracking-wider mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                className="w-full px-3 py-2.5 border-2 border-duo-border rounded-xl focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green transition-all bg-white text-duo-charcoal font-medium text-sm leading-relaxed resize-none"
                rows={2}
                required
              />
              <div className="text-right text-xs text-duo-pencil font-semibold mt-1">
                {description.length}/{DESC_MAX}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="px-5 pt-4 pb-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-duo-pencil" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cards..."
                className="w-full pl-9 pr-3 py-2.5 border-2 border-duo-border rounded-xl focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green transition-all bg-white text-duo-charcoal font-bold text-sm"
              />
            </div>
          </div>

          {/* Card List (Scrolls internally when there are many cards) */}
          <div ref={sidebarRef} className="flex-1 overflow-y-auto px-3 py-2 scrollbar-hide min-h-0">
            {filteredCards.map(({ card, originalIndex }) => (
              <button
                key={card.id}
                data-card-index={originalIndex}
                onClick={() => setActiveIndex(originalIndex)}
                className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 flex items-start gap-3 transition-all group ${
                  originalIndex === activeIndex
                    ? 'bg-duo-gold-subtle border-l-4 border-duo-gold'
                    : 'hover:bg-duo-blue-subtle/50 border-l-4 border-transparent'
                }`}
              >
                <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold ${
                  originalIndex === activeIndex
                    ? 'bg-duo-gold text-duo-charcoal'
                    : 'bg-duo-border text-duo-pencil'
                }`}>
                  {originalIndex + 1}
                </span>
                <span className="text-sm font-medium text-duo-charcoal truncate leading-snug pt-0.5">
                  {card.front || <span className="text-duo-pencil italic">Empty card</span>}
                </span>
              </button>
            ))}
          </div>

          {/* Add card button at bottom */}
          <div className="p-4 border-t-2 border-duo-border flex-shrink-0">
            <button
              onClick={addCard}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-duo-border text-duo-pencil hover:border-duo-green hover:text-duo-green font-bold text-sm transition-colors"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Add card
            </button>
          </div>
        </aside>

        {/* ---------------------------------------------------------- */}
        {/*  MAIN EDITOR PANEL                                          */}
        {/* ---------------------------------------------------------- */}
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {activeCard ? (
            <>
              {/* Card header */}
              <div className="px-6 sm:px-8 py-4 border-b-2 border-duo-border flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="font-heading font-black text-duo-charcoal text-lg">
                    Card {activeIndex + 1}
                  </span>
                  <span className="text-duo-pencil font-semibold text-sm">
                    of {cards.length}
                  </span>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={goPrev}
                      disabled={activeIndex === 0}
                      className="w-8 h-8 rounded-lg border-2 border-duo-border flex items-center justify-center text-duo-pencil hover:border-duo-green hover:text-duo-green disabled:opacity-30 disabled:hover:border-duo-border disabled:hover:text-duo-pencil transition-all"
                      aria-label="Previous card"
                    >
                      <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                    </button>
                    <button
                      onClick={goNext}
                      disabled={activeIndex === cards.length - 1}
                      className="w-8 h-8 rounded-lg border-2 border-duo-border flex items-center justify-center text-duo-pencil hover:border-duo-green hover:text-duo-green disabled:opacity-30 disabled:hover:border-duo-border disabled:hover:text-duo-pencil transition-all"
                      aria-label="Next card"
                    >
                      <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => removeCard(activeIndex)}
                    disabled={cards.length <= 1}
                    className="p-2 rounded-lg border-2 border-duo-border text-duo-pencil hover:text-duo-red hover:border-duo-red/50 hover:bg-duo-red-subtle/30 disabled:opacity-30 transition-all"
                    aria-label="Delete card"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={duplicateCard}
                    className="p-2 rounded-lg border-2 border-duo-border text-duo-pencil hover:text-duo-blue hover:border-duo-blue/50 hover:bg-duo-blue-subtle/30 transition-all"
                    aria-label="Duplicate card"
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Card editor fields */}
              <div className="flex-1 px-6 sm:px-8 py-6 space-y-6 overflow-y-auto min-h-0">
                {/* FRONT */}
                <div>
                  <label className="block text-xs font-bold text-duo-charcoal uppercase tracking-wider mb-2">
                    Front <span className="text-duo-pencil font-semibold normal-case">(Question)</span>
                  </label>
                  <textarea
                    value={activeCard.front}
                    onChange={(e) => handleCardChange('front', e.target.value.slice(0, FRONT_MAX))}
                    className="w-full px-4 py-4 border-2 border-duo-border rounded-2xl focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green transition-all bg-white text-duo-charcoal font-bold text-base min-h-[140px] resize-none leading-relaxed"
                    placeholder="Question or term..."
                  />
                  <div className="text-right text-xs text-duo-pencil font-semibold mt-1.5">
                    {activeCard.front.length}/{FRONT_MAX}
                  </div>
                </div>

                {/* BACK */}
                <div>
                  <label className="block text-xs font-bold text-duo-charcoal uppercase tracking-wider mb-2">
                    Back <span className="text-duo-pencil font-semibold normal-case">(Answer)</span>
                  </label>
                  <textarea
                    value={activeCard.back}
                    onChange={(e) => handleCardChange('back', e.target.value.slice(0, BACK_MAX))}
                    className="w-full px-4 py-4 border-2 border-duo-border rounded-2xl focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green transition-all bg-white text-duo-charcoal font-bold text-base min-h-[180px] resize-none leading-relaxed"
                    placeholder="Answer or definition..."
                  />
                  <div className="text-right text-xs text-duo-pencil font-semibold mt-1.5">
                    {activeCard.back.length}/{BACK_MAX}
                  </div>
                </div>
              </div>

              {/* Card actions footer (Preview button removed) */}
              <div className="px-6 sm:px-8 py-4 border-t-2 border-duo-border bg-white flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={duplicateCard}
                    className="btn-duo-white px-4 py-2 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" /> Duplicate
                  </button>
                  <button
                    onClick={() => removeCard(activeIndex)}
                    disabled={cards.length <= 1}
                    className="btn-duo-white px-4 py-2 text-xs font-bold flex items-center gap-1.5 hover:!text-duo-red hover:!border-duo-red disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={goPrev}
                    disabled={activeIndex === 0}
                    className="btn-duo-white px-4 py-2 text-xs font-bold flex items-center gap-1.5 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" /> Previous
                  </button>
                  <button
                    onClick={goNext}
                    disabled={activeIndex === cards.length - 1}
                    className="btn-duo-green px-5 py-2 text-xs font-bold flex items-center gap-1.5 shadow-duo-green disabled:opacity-30"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>
              </div>

              {/* Tip bar */}
              <div className="px-6 sm:px-8 py-2.5 bg-duo-blue-subtle/30 border-t border-duo-border text-xs text-duo-pencil font-medium text-center flex-shrink-0">
                Tip: You can use <kbd className="px-1.5 py-0.5 bg-white border border-duo-border rounded font-bold text-duo-charcoal">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-white border border-duo-border rounded font-bold text-duo-charcoal">Enter</kbd> to move to the next card
              </div>
            </>
          ) : (
            <div className="flex-grow flex items-center justify-center text-duo-pencil font-bold">
              No cards yet. Add your first card to get started.
            </div>
          )}
        </main>
      </div>

      {/* ============================================================ */}
      {/*  MOBILE: Bottom actions (visible on small screens)            */}
      {/* ============================================================ */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-duo-border px-4 py-3 z-20">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-grow px-3 py-2 border-2 border-duo-border rounded-xl text-sm font-bold text-duo-charcoal focus:border-duo-green transition-all min-w-0"
            placeholder="Deck title..."
          />
          <button
            onClick={handleSave}
            className="btn-duo-green px-4 py-2 text-xs font-bold shadow-duo-green flex-shrink-0"
          >
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}