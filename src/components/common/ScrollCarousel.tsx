import { useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScrollCarouselProps {
  children: ReactNode;
  id: string; // Unique ID for scroll position persistence
  className?: string;
  itemClassName?: string;
}

export default function ScrollCarousel({ 
  children, 
  id, 
  className = '', 
  itemClassName = '' 
}: ScrollCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Check scroll boundaries
  const updateScrollButtons = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 10
    );
  }, []);

  // Restore scroll position from state
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const savedPosition = sessionStorage.getItem(`carousel-scroll-${id}`);
    if (savedPosition) {
      container.scrollLeft = parseInt(savedPosition, 10);
    }

    updateScrollButtons();
  }, [id, updateScrollButtons]);

  // Save scroll position on scroll
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    sessionStorage.setItem(`carousel-scroll-${id}`, String(container.scrollLeft));
    updateScrollButtons();
  }, [id, updateScrollButtons]);

  // Scroll by one page (container width)
  const scrollByPage = useCallback((direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.9; // Scroll 90% of visible width
    const targetScroll = direction === 'left' 
      ? container.scrollLeft - scrollAmount
      : container.scrollLeft + scrollAmount;

    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  }, []);

  // Mouse drag support
  const handleMouseDown = (e: React.MouseEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setIsDragging(true);
    setStartX(e.pageX - container.offsetLeft);
    setScrollLeft(container.scrollLeft);
    container.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed multiplier
    container.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    const container = scrollContainerRef.current;
    if (container) {
      container.style.cursor = 'grab';
    }
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    const container = scrollContainerRef.current;
    if (container) {
      container.style.cursor = 'grab';
    }
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollByPage('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        scrollByPage('right');
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => container.removeEventListener('keydown', handleKeyDown);
    }
  }, [scrollByPage]);

  return (
    <div className={`relative group ${className}`}>
      {/* Left Arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scrollByPage('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/70 hover:bg-black/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 focus:opacity-100"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className={`flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth cursor-grab active:cursor-grabbing ${itemClassName}`}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
        tabIndex={0}
        role="region"
        aria-label="Scrollable carousel"
      >
        {children}
      </div>

      {/* Right Arrow */}
      {canScrollRight && (
        <button
          onClick={() => scrollByPage('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/70 hover:bg-black/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 focus:opacity-100"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

