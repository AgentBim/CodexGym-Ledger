import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require=createRequire(import.meta.resolve('vitest'));
const { createServer }=await import(pathToFileURL(require.resolve('vite')).href);
const root=process.cwd();
const server=await createServer({
  root:resolve(root,'scripts/ui-preview'),
  resolve:{alias:[
    {find:'@/actions/ledger',replacement:resolve(root,'scripts/ui-preview/actions.ts')},
    {find:'@/actions/ui-ledger',replacement:resolve(root,'scripts/ui-preview/actions.ts')},
    {find:'@/actions/auth',replacement:resolve(root,'scripts/ui-preview/actions.ts')},
    {find:'@',replacement:resolve(root,'src')},
  ]},
  esbuild:{jsx:'automatic'},
  server:{host:'127.0.0.1',port:4173,strictPort:true,fs:{allow:[root]}},
});
await server.listen(); server.printUrls();
