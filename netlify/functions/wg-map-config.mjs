export default async () => new Response(JSON.stringify({ ok: true, configured: false }), {
  status: 200,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
