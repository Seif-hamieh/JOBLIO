// Finding links in member-written text (posts, comments): http(s):// links and bare www. ones; trailing punctuation
// ("see example.com.") is left out of the link. The app uses the same rule.
export const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]])/gi;

/** The link's address: bare www. links open over https. */
export const hrefFor = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
