// Fail closed before publishing browser credentials or preserving a broken configuration.
export function validateBrowserConfig(config) {
  if (!config || config.mode !== 'production') throw new Error('Runtime configuration must be in production mode.');
  const required = ['supabaseUrl','supabaseAnonKey','organizationId','appUrl'];
  for (const field of required) if (typeof config[field] !== 'string' || !config[field].trim()) throw new Error(`Missing browser configuration: ${field}`);
  const url = new URL(config.supabaseUrl), app = new URL(config.appUrl);
  if (url.protocol !== 'https:' || app.protocol !== 'https:' || url.username || url.password || app.username || app.password) throw new Error('Use HTTPS Supabase and application URLs without embedded credentials.');
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(config.organizationId)) throw new Error('CAGE_ORGANIZATION_ID must be a UUID.');
  const key = config.supabaseAnonKey;
  if (key.startsWith('sb_publishable_')) return config;
  let claims;
  try { claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')); } catch { throw new Error('SUPABASE_ANON_KEY must be a public anon JWT or publishable key.'); }
  if (claims.role !== 'anon') throw new Error('Browser configuration requires the anon key, never a service-role or secret key.');
  if (typeof claims.exp === 'number' && claims.exp <= Date.now()/1000) throw new Error('The browser anon key has expired.');
  if (claims.ref && url.hostname.endsWith('.supabase.co') && claims.ref !== url.hostname.split('.')[0]) throw new Error('The anon key belongs to a different Supabase project.');
  return config;
}
export function readBrowserConfig(source) {
  const match = source.trim().match(/^window\.CAGE_CONFIG\s*=\s*Object\.freeze\((\{[\s\S]*\})\);?$/);
  if (!match) throw new Error('Existing runtime-config.js has an unrecognised format; supply complete deployment settings.');
  return validateBrowserConfig(JSON.parse(match[1]));
}
