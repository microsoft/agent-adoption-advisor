import { useEffect, useState } from 'react';
import type { Content } from '../engine/model.js';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; content: Content }
  | { status: 'error'; message: string };

/**
 * Load the compiled content.json once. The browser never parses YAML — the
 * build step compiles content/content.yaml to public/content.json, and this is
 * the only thing shipped to the client.
 */
export function useContent(): LoadState {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    fetch('content.json')
      .then((r) => {
        if (!r.ok) throw new Error(`content.json ${r.status}`);
        return r.json();
      })
      .then((content: Content) => {
        if (live) setState({ status: 'ready', content });
      })
      .catch((e: unknown) => {
        if (live) {
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : 'failed to load content',
          });
        }
      });
    return () => {
      live = false;
    };
  }, []);

  return state;
}
