export default {
  fetch(request: Request): Response {
    const target = new URL(request.url);
    target.protocol = 'https:';
    target.hostname = 'www.domainpulse.seanguillermo.com';
    target.port = '';
    return Response.redirect(target.href, 308);
  },
};
