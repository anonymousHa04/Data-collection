const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    
    if (url.pathname === "/") {
      return new Response("Hello from Bun HTTP Server!");
    }
    
    if (url.pathname === "/api/data") {
      return Response.json({
        message: "Data Collection Server",
        status: "running",
      });
    }
    
    return new Response("404  scvdfbfbfNot Found", { status: 404 });
  },
  
});

console.log(`Server running at http://localhost:${server.port}`);
