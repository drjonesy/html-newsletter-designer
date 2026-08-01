import React from 'react';
import { LifeBuoy } from 'lucide-react';

/**
 * The accent-coloured "How to use…" line that closes several panels.
 *
 * It is a `<button>`, not an `<a>`: the app is entirely offline and has no docs
 * site to point at, so this opens an in-app note. Rendering it as a link to
 * nowhere would promise something the app can't do.
 */
export const HelpLink: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-2 text-sm font-semibold text-accent-600 hover:text-accent-700 hover:underline"
  >
    <LifeBuoy className="h-4 w-4 shrink-0" />
    {children}
  </button>
);
