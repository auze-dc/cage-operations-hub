// Keep the configured verified email address; client-facing display name is CAGE.
export function cageSender(configured){
 const value=String(configured||'operations@cagemw.com').trim();
 const match=value.match(/<([^<>]+)>$/);const address=(match?match[1]:value).trim();
 if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address))throw new Error('The configured sender email address is invalid.');
 return `CAGE <${address}>`;
}
