import React from 'react';

/** The title block every rail panel opens with. */
export const PanelHeader: React.FC<{
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <div className="px-5 pb-4 pt-5">
    {children}
    <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
    {subtitle && (
      <p className="mt-1 text-sm leading-relaxed text-slate-500">{subtitle}</p>
    )}
  </div>
);

/** Scroll container shared by every panel, so they scroll identically. */
export const PanelBody: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>;
