import React from 'react';
import { cn, formatNumber } from '@/lib/utils';

interface PriceDisplayProps {
  price: number;
  period?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function PriceDisplay({
  price,
  period = '/ jour',
  size = 'md',
  className,
}: PriceDisplayProps) {
  const sizeClasses = {
    sm: 'text-base font-semibold',
    md: 'text-xl font-bold',
    lg: 'text-2xl font-extrabold',
    xl: 'text-3xl font-extrabold tracking-tight',
  };

  return (
    <div className={cn('inline-flex items-baseline gap-1', className)}>
      <span className={cn('text-ink', sizeClasses[size])}>
        {formatNumber(price)} DH
      </span>
      {period && (
        <span className="text-xs text-slate-500 font-medium lowercase">
          {period}
        </span>
      )}
    </div>
  );
}
