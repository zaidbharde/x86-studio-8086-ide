import { cn } from '@/utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function Badge({ children, variant = 'default', size = 'sm', dot }: BadgeProps) {
  const variants = {
    default: 'bg-[#23302d] text-gray-300 border-[#2f3b37]',
    success: 'bg-[#2fbf71]/10 text-[#5de6a0] border-[#2fbf71]/30',
    warning: 'bg-[#f0b45b]/10 text-[#f3c37c] border-[#f0b45b]/30',
    error: 'bg-[#e05d5d]/10 text-[#f38b8b] border-[#e05d5d]/30',
    info: 'bg-[#4ba3ff]/10 text-[#7ab6ff] border-[#4ba3ff]/30',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  const dotColors = {
    default: 'bg-gray-300',
    success: 'bg-[#5de6a0]',
    warning: 'bg-[#f3c37c]',
    error: 'bg-[#f38b8b]',
    info: 'bg-[#7ab6ff]',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 font-medium border rounded-full',
      variants[variant],
      sizes[size]
    )}>
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
