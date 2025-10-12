import { useState, useEffect, useRef } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean; // Skip lazy loading for above-the-fold images
  quality?: 'low' | 'medium' | 'high' | 'original';
  type?: 'poster' | 'backdrop' | 'profile';
}

// TMDB image size mapping
const TMDB_SIZES = {
  poster: {
    low: 'w342',
    medium: 'w500',
    high: 'w780',
    original: 'original'
  },
  backdrop: {
    low: 'w780',
    medium: 'w1280',
    high: 'w1280',
    original: 'original'
  },
  profile: {
    low: 'w185',
    medium: 'w342',
    high: 'w632',
    original: 'original'
  }
};

export default function OptimizedImage({
  src,
  alt,
  className = '',
  width,
  height,
  priority = false,
  quality = 'high',
  type = 'backdrop'
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority) return; // Skip lazy loading for priority images

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px' // Start loading 50px before entering viewport
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  // Generate srcset for responsive images
  function generateSrcSet(imageSrc: string): string {
    // Check if it's a TMDB URL
    if (!imageSrc.includes('image.tmdb.org')) {
      return ''; // Not a TMDB image, no srcset
    }

    const sizes = TMDB_SIZES[type];
    const basePath = imageSrc.substring(0, imageSrc.lastIndexOf('/') + 1);
    const filename = imageSrc.substring(imageSrc.lastIndexOf('/') + 1);

    // Generate srcset with different sizes
    return Object.entries(sizes)
      .filter(([key]) => key !== 'original')
      .map(([_, size]) => {
        const width = parseInt(size.substring(1)); // Extract width from "w780"
        return `${basePath}${size}/${filename} ${width}w`;
      })
      .join(', ');
  }

  // Get optimized src based on quality
  function getOptimizedSrc(imageSrc: string): string {
    if (!imageSrc.includes('image.tmdb.org')) {
      return imageSrc;
    }

    const sizes = TMDB_SIZES[type];
    const targetSize = sizes[quality];
    const basePath = imageSrc.substring(0, imageSrc.lastIndexOf('/') + 1);
    const filename = imageSrc.substring(imageSrc.lastIndexOf('/') + 1);

    return `${basePath}${targetSize}/${filename}`;
  }

  // Blur placeholder (tiny base64 image)
  const blurPlaceholder =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"%3E%3Cfilter id="b"%3E%3CfeGaussianBlur stdDeviation="12"%3E%3C/feGaussianBlur%3E%3C/filter%3E%3Crect width="100%25" height="100%25" fill="%23222" filter="url(%23b)"%3E%3C/rect%3E%3C/svg%3E';

  const optimizedSrc = getOptimizedSrc(src);
  const srcSet = generateSrcSet(src);

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {/* Blur placeholder */}
      <img
        src={blurPlaceholder}
        alt=""
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-0' : 'opacity-100'
        }`}
        aria-hidden="true"
      />

      {/* Actual image */}
      {isInView && (
        <img
          src={optimizedSrc}
          srcSet={srcSet || undefined}
          sizes={
            type === 'poster'
              ? '(max-width: 640px) 342px, (max-width: 1024px) 500px, 780px'
              : type === 'backdrop'
              ? '(max-width: 640px) 780px, 1280px'
              : '(max-width: 640px) 185px, (max-width: 1024px) 342px, 632px'
          }
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          onLoad={() => setIsLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
}

