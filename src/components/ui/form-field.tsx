import React, { useId } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
  children: React.ReactElement;
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  labelClassName?: string;
  descriptionClassName?: string;
  errorClassName?: string;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  (
    {
      children,
      label,
      description,
      error,
      required,
      className,
      labelClassName,
      descriptionClassName,
      errorClassName,
    },
    ref
  ) => {
    const fieldId = useId();
    const descriptionId = useId();
    const errorId = useId();

    // Clone the child element with proper ARIA attributes
    const childWithProps = React.cloneElement(children, {
      id: children.props.id || fieldId,
      'aria-describedby': [
        description ? descriptionId : '',
        error ? errorId : '',
        children.props['aria-describedby'] || '',
      ]
        .filter(Boolean)
        .join(' ') || undefined,
      'aria-invalid': error ? 'true' : children.props['aria-invalid'],
      'aria-required': required ? 'true' : children.props['aria-required'],
    });

    return (
      <div ref={ref} className={cn('form-field-wrapper', className)}>
        {label && (
          <Label
            htmlFor={children.props.id || fieldId}
            className={cn(
              'text-default-aa font-medium mb-1.5 block',
              required && "after:content-['*'] after:ml-0.5 after:text-error-aa",
              labelClassName
            )}
          >
            {label}
          </Label>
        )}
        
        {description && (
          <p
            id={descriptionId}
            className={cn('text-muted-aa text-sm mb-2', descriptionClassName)}
          >
            {description}
          </p>
        )}
        
        {childWithProps}
        
        {error && (
          <p
            id={errorId}
            role="alert"
            className={cn(
              'text-error-aa text-sm mt-1.5 flex items-center gap-1',
              errorClassName
            )}
            aria-live="polite"
          >
            <svg 
              className="h-4 w-4 shrink-0" 
              viewBox="0 0 20 20" 
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5l-4 7A1 1 0 006 16h8a1 1 0 00.867-1.5l-4-7A1 1 0 0010 7z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

export { FormField };
export type { FormFieldProps };
