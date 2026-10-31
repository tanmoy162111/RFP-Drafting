'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Icon, type IconName } from './icons';

/**
 * A submit button for a server-action form. While the action runs, every button in the form is disabled
 * and the one that was pressed says what it is doing. Without JavaScript it is an ordinary submit button.
 */
export function SubmitButton({
  name,
  value,
  variant = 'primary',
  icon,
  pendingLabel = 'Saving…',
  children,
}: {
  name?: string;
  value?: string;
  variant?: 'primary' | 'secondary';
  icon?: IconName;
  pendingLabel?: string;
  children: ReactNode;
}) {
  const { pending, data } = useFormStatus();
  const pressed = pending && (name === undefined || data?.get(name) === value);
  return (
    <button type="submit" name={name} value={value} className={`btn btn-${variant}`} disabled={pending} aria-busy={pressed}>
      {pressed ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        <>
          {icon && <Icon name={icon} />}
          {children}
        </>
      )}
    </button>
  );
}
