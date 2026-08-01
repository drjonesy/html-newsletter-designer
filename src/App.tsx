import React from 'react';
import { DesignerProvider } from './state/DesignerContext';
import { EditingSessionProvider } from './state/EditingSession';
import { AppShell } from './components/shell/AppShell';

/**
 * Composition only.
 *
 * v1 kept the whole application state in this file and drilled it down as
 * props. v2 nests too deep for that — shell, panel, inspector, tab, field — so
 * ownership moved into `DesignerProvider`, which is still the one place the
 * template is mutated. `EditingSessionProvider` sits outside the shell because
 * the docked formatting toolbar and the field being typed in live in different
 * subtrees and both need the live selection.
 */
export default function App() {
  return (
    <DesignerProvider>
      <EditingSessionProvider>
        <AppShell />
      </EditingSessionProvider>
    </DesignerProvider>
  );
}
