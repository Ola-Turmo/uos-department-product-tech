/**
 * Connectors Configuration
 * 
 * This module exports the connectors configuration as a TypeScript object
 * to avoid JSON import issues across different module resolution modes.
 */

export const connectorsConfig = {
  requiredToolkits: [
    "github",
    "googledrive",
    "googledocs",
    "slack"
  ],
  roleToolkits: [
    {
      roleKey: "technology",
      toolkits: ["github", "slack"]
    },
    {
      roleKey: "product-research-lead",
      toolkits: ["googledrive", "googledocs"]
    },
    {
      roleKey: "technology-platform-lead",
      toolkits: ["github", "slack"]
    },
    {
      roleKey: "technology-engineering-lead",
      toolkits: ["github"]
    }
  ]
} as const;

export type ConnectorsConfig = typeof connectorsConfig;
