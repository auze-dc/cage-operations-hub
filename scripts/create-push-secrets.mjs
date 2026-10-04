import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const file=resolve(process.argv[2]||'../cage-push-secrets.env');
const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});const jwk=privateKey.export({format:'jwk'});
const pub=Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')]).toString('base64url');
writeFileSync(file,`VAPID_PUBLIC_KEY=${pub}\nVAPID_PRIVATE_KEY=${jwk.d}\nVAPID_SUBJECT=mailto:alexander@cagemw.com\nPUSH_CRON_SECRET=${randomBytes(32).toString('hex')}\n`,{flag:'wx',mode:0o600});
console.log(`Created ${file}. Keep private; do not commit. Use the same keys for future deployments.`);
