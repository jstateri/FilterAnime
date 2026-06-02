import assert from "node:assert";
import { setTimeout } from "node:timers/promises";

Deno.test("Anime Tracker Integration Test Suite", async (t) => {
  // 1. Setup Server Subprocess
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net", "--allow-read", "server.ts"],
    stdout: "piped",
    stderr: "piped",
  });
  const serverProcess = command.spawn();
  
  // Wait for server to start binding to port 8000
  await setTimeout(2000); 

  try {
    // 2. Security & Static Routing Tests
    await t.step("Static Files: Should serve index.html with CORS headers", async () => {
      const res = await fetch("http://localhost:8000/");
      assert.strictEqual(res.status, 200);
      const contentType = res.headers.get("Content-Type") || "";
      assert.ok(contentType.includes("text/html"));
      assert.strictEqual(res.headers.get("Access-Control-Allow-Origin"), "*");
      const body = await res.text();
      assert.ok(body.includes("<html"));
    });

    await t.step("Security: Should block directory path traversal attacks (../)", async () => {
      const res = await fetch("http://localhost:8000/../server.ts");
      assert.strictEqual(res.status, 404);
    });

    await t.step("Routing: Should return custom 404.html for nonexistent routes", async () => {
      const res = await fetch("http://localhost:8000/something_invalid_route");
      assert.strictEqual(res.status, 404);
      const body = await res.text();
      // Verify our custom 404 HTML is returned
      assert.ok(body.includes("Page Not Found"));
    });

    // 3. Jikan (MAL) REST Proxy Tests
    await t.step("API Proxy: MAL search endpoint (/api/mal)", async () => {
      const res = await fetch("http://localhost:8000/api/mal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params: "q=Naruto&limit=1" })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(Array.isArray(data.data), true);
    });

    await t.step("API Proxy: MAL import endpoint (/api/import-mal)", async () => {
      const res = await fetch("http://localhost:8000/api/import-mal?username=xinil");
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(Array.isArray(data), true);
    });

    // 4. AniList GraphQL Proxy Tests
    await t.step("API Proxy: AniList search endpoint with voice actor fields", async () => {
      const res = await fetch("http://localhost:8000/api/anilist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params: "q=Monster" })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(typeof data.data, "object");
      
      const firstMedia = data.data.Page.media[0];
      assert.strictEqual(typeof firstMedia.characters, "object");
      assert.strictEqual(Array.isArray(firstMedia.characters.edges), true);
    });

    await t.step("API Proxy: MAL recommendations endpoint", async () => {
      // 16498 is Attack on Titan
      const res = await fetch("http://localhost:8000/api/recommendations/mal/16498");
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(Array.isArray(data.data), true);
    });

    await t.step("API Proxy: AniList tags endpoint correctly filters adult tags", async () => {
      const res = await fetch("http://localhost:8000/api/tags", { method: "POST" });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(Array.isArray(data.tags), true);
      
      // Ensure the backend successfully scrubbed adult tags
      const adultTags = data.tags.filter((t: any) => t.isAdult === true);
      assert.strictEqual(adultTags.length, 0);
    });

  } finally {
    // 5. Teardown
    try {
      serverProcess.kill();
    } catch (e) {
      // Process might already be dead
    }
    await serverProcess.status; // wait for process to fully exit
  }
});
