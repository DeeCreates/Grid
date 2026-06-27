// src/components/ui/Currency.tsx
interface CurrencyProps {
  amount: number;
  compact?: boolean;
  className?: string;
}

export function Currency({ amount, compact = false, className }: CurrencyProps) {
  const formatAmount = (value: number) => {
    if (compact) {
      if (value >= 1_000_000) return `₵${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `₵${(value / 1_000).toFixed(0)}K`;
      return `₵${value.toFixed(0)}`;
    }
    return `₵${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return <span className={className}>{formatAmount(amount)}</span>;
}