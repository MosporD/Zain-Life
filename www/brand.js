/* Which app this is. One codebase builds two apps (brands/<id>/brand.json): Zain Life and a personal
   app with nothing Zain in it. tools/brand.js rewrites this file in every build with the brand's own
   values; this copy is the default for previewing www/ as it is (the Zain brand).
   Gate a brand-only feature with  if (BRAND.features.challenge) { ... }  or list its file under "drop". */
window.BRAND = { id: 'zain', name: 'Zain Life', nameAr: 'زين لايف', folder: 'ZainLife', features: { challenge: true } };
document.documentElement.setAttribute('data-brand', window.BRAND.id);
