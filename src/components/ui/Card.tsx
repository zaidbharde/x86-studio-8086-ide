import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export function Card({ children, className, hover = false, glow = false }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'bg-[#13201e] border border-[#1f2b29] rounded-xl overflow-hidden',
        hover && 'hover:border-[#45d1a3]/30 transition-all duration-300',
        glow && 'shadow-lg shadow-[#45d1a3]/10',
        className
      )}
    >
      {children}
    </motion.div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, icon, action, className }: CardHeaderProps) {
  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-3 border-b border-[#1f2b29] bg-[#152320]',
      className
    )}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-[#45d1a3]/15 flex items-center justify-center text-[#45d1a3]">
            {icon}
          </div>
        )}
        <div>
          <h3 className="font-semibold text-white text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function CardContent({ children, className, noPadding }: CardContentProps) {
  return (
    <div className={cn(!noPadding && 'p-4', className)}>
      {children}
    </div>
  );
}
