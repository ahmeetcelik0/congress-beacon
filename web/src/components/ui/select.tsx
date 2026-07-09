'use client';

import * as React from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import './select.css';

const ChevronIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" className="ui-select-chevron">
    <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" className="ui-select-check">
    <path d="M2.5 6.2 5 8.5 9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Select = RadixSelect.Root;
export const SelectGroup = RadixSelect.Group;
export const SelectValue = RadixSelect.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Trigger> & { placeholder?: string }
>(({ className, children, ...props }, ref) => (
  <RadixSelect.Trigger ref={ref} className={`ui-select-trigger ${className ?? ''}`} {...props}>
    <span className="ui-select-trigger-text">{children}</span>
    <RadixSelect.Icon asChild>
      <ChevronIcon />
    </RadixSelect.Icon>
  </RadixSelect.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Content>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Content>
>(({ className, children, position = 'popper', sideOffset = 6, ...props }, ref) => (
  <RadixSelect.Portal>
    <RadixSelect.Content
      ref={ref}
      className={`ui-select-content ${className ?? ''}`}
      position={position}
      sideOffset={sideOffset}
      {...props}
    >
      <RadixSelect.ScrollUpButton className="ui-select-scroll">
        <ChevronIcon />
      </RadixSelect.ScrollUpButton>
      <RadixSelect.Viewport className="ui-select-viewport">{children}</RadixSelect.Viewport>
      <RadixSelect.ScrollDownButton className="ui-select-scroll">
        <ChevronIcon />
      </RadixSelect.ScrollDownButton>
    </RadixSelect.Content>
  </RadixSelect.Portal>
));
SelectContent.displayName = 'SelectContent';

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Item>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Item>
>(({ className, children, ...props }, ref) => (
  <RadixSelect.Item ref={ref} className={`ui-select-item ${className ?? ''}`} {...props}>
    <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    <RadixSelect.ItemIndicator className="ui-select-item-indicator">
      <CheckIcon />
    </RadixSelect.ItemIndicator>
  </RadixSelect.Item>
));
SelectItem.displayName = 'SelectItem';

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Separator>
>(({ className, ...props }, ref) => (
  <RadixSelect.Separator ref={ref} className={`ui-select-separator ${className ?? ''}`} {...props} />
));
SelectSeparator.displayName = 'SelectSeparator';
