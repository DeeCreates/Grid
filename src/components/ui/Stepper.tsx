// src/components/ui/Stepper.tsx
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <div className="w-full">
      <div className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          
          return (
            <div key={index} className="flex-1 relative">
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'absolute top-4 left-1/2 w-full h-0.5',
                    isCompleted ? 'bg-blue-600' : 'bg-gray-200'
                  )}
                  style={{ transform: 'translateX(-50%)' }}
                />
              )}
              
              {/* Step Circle */}
              <div className="relative flex flex-col items-center">
                <button
                  onClick={() => onStepClick?.(index)}
                  disabled={!isCompleted && !isCurrent}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition',
                    isCompleted
                      ? 'bg-blue-600 text-white'
                      : isCurrent
                      ? 'bg-white border-2 border-blue-600 text-blue-600'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  )}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
                </button>
                
                <div className="mt-2 text-center">
                  <p className={cn(
                    'text-sm font-medium',
                    isCurrent ? 'text-blue-600' : isCompleted ? 'text-gray-900' : 'text-gray-400'
                  )}>
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}