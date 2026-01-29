import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

addEventListener('fetch', event => {
    event.respondWith(handleEvent(event));
});

async function handleEvent(event) {
    try {
        // Serve static assets from KV
        return await getAssetFromKV(event, {
            mapRequestToAsset: req => {
                // Support SPA routing: serve index.html for non-asset paths
                let url = new URL(req.url);
                if (!url.pathname.includes('.')) {
                    return new Request(`${url.origin}/index.html`, req);
                }
                return req;
            },
        });
    } catch (e) {
        let pathname = new URL(event.request.url).pathname;
        return new Response(`"${pathname}" not found`, {
            status: 404,
            statusText: 'not found',
        });
    }
}
