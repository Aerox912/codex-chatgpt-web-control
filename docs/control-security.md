# Security model additions

The final project must preserve the upstream security model and add these
combined-runtime constraints:

- one process may open the persistent browser partition at a time;
- every page mutation requires exact lease ownership proof;
- the local service binds to `127.0.0.1` and requires a private bearer token;
- raw CDP, arbitrary JavaScript, cookies, and login storage are not exposed;
- prompt and response content is omitted from operational logs by default;
- uploads are preflighted before page allocation;
- downloads use operation-specific directories;
- login, logout, storage clearing, connector changes, smoke tests, and profile
  migration are globally exclusive;
- an uncertain submission is inspected rather than automatically retried;
- selector drift, lost ownership, rate limiting, and authentication failure are
  distinct fail-closed states.
