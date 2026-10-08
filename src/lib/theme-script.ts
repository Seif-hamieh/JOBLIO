// Runs before first paint (inlined in <head>) so the correct theme class is
// present immediately. Static string — contains no user data.
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('joblio-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
