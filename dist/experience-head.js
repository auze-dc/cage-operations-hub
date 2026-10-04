// Apply saved appearance before the page is painted.
(()=>{let theme='system';try{theme=localStorage.getItem('cage-appearance')||'system';}catch{}document.documentElement.dataset.cageTheme=theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;})();
