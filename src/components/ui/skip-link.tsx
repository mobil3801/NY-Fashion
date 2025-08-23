import React from 'react';
import { cn } from '@/lib/utils';

interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

const SkipLink = React.forwardRef<HTMLAnchorElement, SkipLinkProps>(
  ({ href, children, className, ...props }, ref) => {
    return (
      <a
        ref={ref}
        href={href}
        className={cn(
          'skip-link sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0',
          'bg-white text-black p-2 z-50 border border-gray-300',
          'text-default-aa focus-visible-aa',
          className
        )}
        {...props}
      >
        {children}
      </a>
    );
  }
);

SkipLink.displayName = 'SkipLink';

export { SkipLink };
