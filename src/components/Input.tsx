import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  size?: 'sm' | 'default';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    size = 'default',
    className = '',
    ...props
  },
  ref,
) {
  const paddingClasses = size === 'sm' ? 'px-3 py-2' : 'px-4 py-3';
  const heightClasses = size === 'sm' ? 'h-10' : 'h-auto';
  const iconLeftPadding = size === 'sm' ? 'pl-9' : 'pl-12';
  const iconRightPadding = size === 'sm' ? 'pr-9' : 'pr-12';
  const iconLeftPosition = size === 'sm' ? 'left-3' : 'left-4';
  const iconRightPosition = size === 'sm' ? 'right-3' : 'right-4';

  return (
    <div className="w-full">
      {label && (
        <label className="block mb-2 text-foreground">
          {label}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className={`absolute ${iconLeftPosition} top-1/2 -translate-y-1/2 text-muted-foreground`}>
            {leftIcon}
          </div>
        )}
        
        <input
          ref={ref}
          className={`
            w-full ${paddingClasses} ${heightClasses}
            bg-background 
            border border-border 
            rounded-[10px] 
            text-foreground
            placeholder:text-muted-foreground
            focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
            disabled:bg-muted disabled:cursor-not-allowed
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
            ${leftIcon ? iconLeftPadding : ''}
            ${rightIcon ? iconRightPadding : ''}
            ${className}
          `}
          {...props}
        />
        
        {rightIcon && (
          <div className={`absolute ${iconRightPosition} top-1/2 -translate-y-1/2 text-muted-foreground`}>
            {rightIcon}
          </div>
        )}
      </div>
      
      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="mt-2 text-sm text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
});
