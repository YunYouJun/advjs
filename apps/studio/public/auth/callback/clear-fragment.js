// The iOS system authentication session consumes this callback. A browser
// fallback must not exchange, persist, forward or display the one-time code.
history.replaceState(null, '', '/auth/callback')
