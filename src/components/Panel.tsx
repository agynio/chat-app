import { type ReactNode } from 'react';

interface PanelProps {
  variant?: 'standard' | 'elevated' | 'subtle' | 'highlighted';
  children: ReactNode;
  className?: string;
}

export function Panel({ variant = 'standard', children, className = '' }: PanelProps) {
  const variants = {
    standard: 'bg-card border border-border',
    elevated: 'bg-card shadow-md',
    subtle: 'bg-muted border border-border',
    highlighted: 'bg-[var(--agyn-bg-accent)] border-2 border-primary',
  };
  
  return (
    <div className={`rounded-[10px] ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
}

interface PanelHeaderProps {
  children: ReactNode;
  className?: string;
}

export function PanelHeader({ children, className = '' }: PanelHeaderProps) {
  return (
    <div className={`p-6 border-b border-border ${className}`}>
      {children}
    </div>
  );
}

interface PanelBodyProps {
  children: ReactNode;
  className?: string;
}

export function PanelBody({ children, className = '' }: PanelBodyProps) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
}

interface PanelFooterProps {
  children: ReactNode;
  className?: string;
}

export function PanelFooter({ children, className = '' }: PanelFooterProps) {
  return (
    <div className={`p-6 border-t border-border ${className}`}>
      {children}
    </div>
  );
}
