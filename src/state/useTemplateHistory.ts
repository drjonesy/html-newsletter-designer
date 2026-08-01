import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NewsletterTemplate } from '../types';

/**
 * How many past states to keep.
 *
 * Every entry is a whole `NewsletterTemplate`, and uploaded images live in it
 * as data URIs — a newsletter with a few photos is megabytes per snapshot. Fifty
 * is deep enough that nobody reaches the end by accident and shallow enough that
 * the tab doesn't grow without bound.
 */
const HISTORY_LIMIT = 50;

/** Commits sharing a `coalesceKey` inside this window fold into one undo step. */
const COALESCE_MS = 600;

export interface CommitOptions {
  /**
   * Marks a run of rapid changes that should undo as one.
   *
   * A colour picker fires per pixel dragged and a text field per keystroke;
   * without this, undo would walk back through forty shades of blue. Use
   * something stable and specific — `` `color:${element.id}` `` — so two
   * different fields never merge into each other.
   */
  coalesceKey?: string;
}

export type TemplateUpdate =
  | NewsletterTemplate
  | ((previous: NewsletterTemplate) => NewsletterTemplate);

interface HistoryState {
  past: NewsletterTemplate[];
  present: NewsletterTemplate;
  future: NewsletterTemplate[];
}

export interface TemplateHistory {
  template: NewsletterTemplate;
  /** The single mutation point. Replaces `setTemplate`. */
  commit: (update: TemplateUpdate, opts?: CommitOptions) => void;
  /** Loads a different newsletter — new, opened, preset. Clears the history. */
  reset: (template: NewsletterTemplate) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Undo/redo over the whole template.
 *
 * A snapshot stack rather than a command log: every mutation in the app already
 * funnels through one place and produces a fresh immutable template, so keeping
 * the old object *is* the undo entry — there is nothing to invert and no way for
 * an inverse to drift out of step with the operation it undoes.
 */
export function useTemplateHistory(
  initial: NewsletterTemplate
): TemplateHistory {
  const [state, setState] = useState<HistoryState>({
    past: [],
    present: initial,
    future: [],
  });

  const lastCommit = useRef<{ key: string; at: number } | null>(null);

  const commit = useCallback(
    (update: TemplateUpdate, opts?: CommitOptions) => {
      const key = opts?.coalesceKey;
      const now = Date.now();
      const merge =
        !!key &&
        lastCommit.current?.key === key &&
        now - lastCommit.current.at < COALESCE_MS;

      // An unkeyed commit breaks the chain, so a colour drag followed by a
      // delete doesn't fold the delete into the drag.
      lastCommit.current = key ? { key, at: now } : null;

      setState((prev) => {
        const next =
          typeof update === 'function' ? update(prev.present) : update;
        if (next === prev.present) return prev;
        return {
          past: merge
            ? prev.past
            : [...prev.past, prev.present].slice(-HISTORY_LIMIT),
          present: next,
          // Any new edit abandons the redo branch — the standard model, and the
          // only one that doesn't need a tree UI to explain itself.
          future: [],
        };
      });
    },
    []
  );

  const reset = useCallback((template: NewsletterTemplate) => {
    lastCommit.current = null;
    setState({ past: [], present: template, future: [] });
  }, []);

  const undo = useCallback(() => {
    lastCommit.current = null;
    setState((prev) => {
      if (prev.past.length === 0) return prev;
      return {
        past: prev.past.slice(0, -1),
        present: prev.past[prev.past.length - 1],
        future: [prev.present, ...prev.future].slice(0, HISTORY_LIMIT),
      };
    });
  }, []);

  const redo = useCallback(() => {
    lastCommit.current = null;
    setState((prev) => {
      if (prev.future.length === 0) return prev;
      return {
        past: [...prev.past, prev.present].slice(-HISTORY_LIMIT),
        present: prev.future[0],
        future: prev.future.slice(1),
      };
    });
  }, []);

  return useMemo(
    () => ({
      template: state.present,
      commit,
      reset,
      undo,
      redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
    }),
    [state, commit, reset, undo, redo]
  );
}

/** True when the keystroke belongs to whatever the user is typing in. */
function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  return !!el.closest('input, textarea, select, [contenteditable="true"]');
}

/**
 * Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z (plus Ctrl+Y on Windows).
 *
 * Deliberately inert while the user is in a field: inside a contenteditable the
 * browser's own undo owns the caret and the half-typed text, and replacing that
 * with a whole-template rollback would throw away the sentence being written.
 * The field commits on blur, so its content becomes undoable the moment it is
 * actually part of the template.
 */
export function useUndoRedoShortcuts(actions: {
  undo: () => void;
  redo: () => void;
}): void {
  const { undo, redo } = actions;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      if (isTextEntry(e.target)) return;

      e.preventDefault();
      if (key === 'y' || e.shiftKey) redo();
      else undo();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);
}
