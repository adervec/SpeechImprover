// Minimal hash router. Routes look like #/page/param?query=value.

import { useCallback, useEffect, useState } from 'react';

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, queryStr] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const query = {};
  if (queryStr) {
    for (const pair of queryStr.split('&')) {
      const [k, v] = pair.split('=');
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  }
  return { page: parts[0] || '', param: parts[1] || '', query };
}

export function useRouter() {
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((page, { param, query } = {}) => {
    let hash = `#/${page}`;
    if (param) hash += `/${param}`;
    if (query) {
      const qs = Object.entries(query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      if (qs) hash += `?${qs}`;
    }
    window.location.hash = hash;
  }, []);

  return { route, navigate };
}
