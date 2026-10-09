const readline = require("node:readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on("line", (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    if (msg.method === "initialize") {
      const resp = {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: "mock-github-mcp", version: "1.0.0" }
        }
      };
      console.log(JSON.stringify(resp));
    } else if (msg.method === "notifications/initialized") {
      // Notificación unidireccional, no requiere respuesta
    } else if (msg.method === "tools/list") {
      const resp = {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          tools: [
            {
              name: "get_issue",
              description: "Obtiene un issue de GitHub por número",
              inputSchema: {
                type: "object",
                properties: {
                  owner: { type: "string" },
                  repo: { type: "string" },
                  issue_number: { type: "number" }
                },
                required: ["owner", "repo", "issue_number"]
              }
            },
            {
              name: "delete_repository",
              description: "Elimina un repositorio permanentemente",
              inputSchema: {
                type: "object",
                properties: {
                  repo_name: { type: "string" }
                },
                required: ["repo_name"]
              }
            }
          ]
        }
      };
      console.log(JSON.stringify(resp));
    } else if (msg.method === "tools/call") {
      const { name, arguments: args } = msg.params;
      if (name === "get_issue") {
        const resp = {
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  id: 101,
                  title: `Issue en ${args.owner}/${args.repo}`,
                  state: "open"
                })
              }
            ],
            isError: false
          }
        };
        console.log(JSON.stringify(resp));
      } else if (name === "delete_repository") {
        const resp = {
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            content: [{ type: "text", text: `Repo ${args.repo_name} eliminado.` }],
            isError: false
          }
        };
        console.log(JSON.stringify(resp));
      } else {
        const resp = {
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            content: [{ type: "text", text: `Herramienta desconocida "${name}"` }],
            isError: true
          }
        };
        console.log(JSON.stringify(resp));
      }
    }
  } catch {
    // Ignorar líneas corruptas
  }
});
