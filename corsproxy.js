async function handleRequest(request) {
  const url = new URL(request.url)
  const apiurl = url.searchParams.get('apiurl')
  // Rewrite request to point to API url. This also makes the request mutable
  // so we can add the correct Origin header to make the API server think
  // that this request isn't cross-site.
  request = new Request(apiurl, request)
  request.headers.set('Origin', new URL(apiurl).origin)
  let response = await fetch(request, {redirect: 'follow'})
  // Recreate the response so we can modify the headers
  response = new Response(response.body, response)
  // Set CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*')
  // Append to/Add Vary header so browser will cache response correctly
  response.headers.append('Vary', 'Origin')
  return response
}
function handleOptions(request) {
  // Make sure the necesssary headers are present
  // for this to be a valid pre-flight request
  if (
    request.headers.get('Origin') !== null &&
    request.headers.get('Access-Control-Request-Method') !== null &&
    request.headers.get('Access-Control-Request-Headers') !== null
  ) {
    // Handle CORS pre-flight request.
    // If you want to check the requested method + headers
    // you can do that here.
    return new Response(null, {
      headers: corsHeaders,
    })
  } else {
    // Handle standard OPTIONS request.
    // If you want to allow other HTTP Methods, you can do that here.
    return new Response(null, {
      headers: {
        Allow: 'GET, HEAD, PUT, POST, OPTIONS',
      },
    })
  }
}
addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (url.pathname.startsWith(proxyEndpoint)) {
    if (request.method === 'OPTIONS') {
      // Handle CORS preflight requests
      event.respondWith(handleOptions(request))
    } else if (
      request.method === 'GET' ||
      request.method === 'HEAD' ||
      request.method === 'POST' || 
      request.method === 'PUT'
    ) {
      // Handle requests to the API server
      event.respondWith(handleRequest(request))
    } else {
      event.respondWith(async () => {
        return new Response(null, {
          status: 405,
          statusText: 'Method Not Allowed',
        })
      })
    }
  } else {
    // Serve demo page
    event.respondWith(rawHtmlResponse(demoPage))
  }
})
// We support the GET, POST, HEAD, and OPTIONS methods from any origin,
// and accept the Content-Type header on requests. These headers must be
// present on all responses to all CORS requests. In practice, this means
// all responses to OPTIONS requests.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  "Access-Control-Allow-Credentials": "*",
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': '*',
}
// The URL for the remote third party API you want to fetch from
// but does not implement CORS
const apiurl = 'https://workers-tooling.cf/demos/demoapi'
// The endpoint you want the CORS reverse proxy to be on
const proxyEndpoint = '/corsproxy/'
// The rest of this snippet for the demo page
async function rawHtmlResponse(html) {
  return new Response(html, {
    headers: {
      'content-type': 'text/html;charset=UTF-8',
    },
  })
}
const demoPage = `
<!DOCTYPE html>
<html>
<body>
  <h1>API GET without CORS Proxy</h1>
  <a target='_blank' href='https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#Checking_that_the_fetch_was_successful'>Shows TypeError: Failed to fetch since CORS is misconfigured</a>
  <p id='noproxy-status'/>
  <code id='noproxy'>Waiting</code>
  <h1>API GET with CORS Proxy</h1>
  <p id='proxy-status'/>
  <code id='proxy'>Waiting</code>
  <h1>API POST with CORS Proxy + Preflight</h1>
  <p id='proxypreflight-status'/>
  <code id='proxypreflight'>Waiting</code>
  <script>
  let reqs = {};
  reqs.noproxy = async () => {
    let response = await fetch('${apiurl}')
    return await response.text()
  }
  reqs.proxy = async () => {
    let response = await fetch(window.location.origin + '${proxyEndpoint}?apiurl=${apiurl}')
    return await response.text()
  }
  reqs.proxypreflight = async () => {
    const reqBody = {
      msg: "Hello world!"
    }
    let response = await fetch(window.location.origin + '${proxyEndpoint}?apiurl=${apiurl}', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(reqBody),
    })
    return await response.json()
  }
  (async () => {
    for (const [reqName, req] of Object.entries(reqs)) {
      try {
        let data = await req()
        document.getElementById(reqName).innerHTML = JSON.stringify(data)
      } catch (e) {
        document.getElementById(reqName).innerHTML = e
      }
    }
  })()
  </script>
</body>
</html>`
