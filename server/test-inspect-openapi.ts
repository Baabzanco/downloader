async function inspectApi() {
  try {
    const res = await fetch('https://api.fxtwitter.com/2/openapi.json');
    console.log('OpenAPI status:', res.status);
    if (res.ok) {
      const spec: any = await res.json();
      console.log('Paths:', Object.keys(spec.paths || {}));
      console.log('Schemas:', Object.keys(spec.components?.schemas || {}));
    }
  } catch (e: any) {
    console.error('Error fetching openapi:', e.message);
  }
}

inspectApi();
