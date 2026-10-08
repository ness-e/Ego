import { describe, it, expect } from "vitest";
import {
  MemoryOpSchema,
  CreateSubEgoSchema,
  ApproveActionSchema,
  ChatStreamSchema,
} from "../src/ipc/schema.js";

describe("@ego/desktop — IPC Validation Schema Suite", () => {
  it("Valida operaciones MemoryOpSchema autorizadas", () => {
    const validPut = MemoryOpSchema.safeParse({
      op: "put",
      args: [{ namespace: "kb/test", key: "doc:1", payload: "Hello world" }],
    });
    expect(validPut.success).toBe(true);

    const validRecall = MemoryOpSchema.safeParse({
      op: "recall",
      args: ["VantaDB architecture"],
    });
    expect(validRecall.success).toBe(true);
  });

  it("Rechaza operaciones arbitrarias o argumentos no conformes", () => {
    const invalidOp = MemoryOpSchema.safeParse({
      op: "dropDatabase",
      args: [],
    });
    expect(invalidOp.success).toBe(false);

    const emptyNamespace = MemoryOpSchema.safeParse({
      op: "get",
      args: ["", "key1"],
    });
    expect(emptyNamespace.success).toBe(false);
  });

  it("Valida manifest para creación de Sub-Egos", () => {
    const validSubEgo = CreateSubEgoSchema.safeParse({
      name: "ResearchEgo",
      role: "Knowledge Specialist",
      instructions: "Investigar temas en profundidad usando memoria local.",
      tools: ["fs.readFile"],
    });
    expect(validSubEgo.success).toBe(true);

    const shortInstructions = CreateSubEgoSchema.safeParse({
      name: "Fail",
      role: "Fail",
      instructions: "Short",
    });
    expect(shortInstructions.success).toBe(false);
  });

  it("Valida esquema de aprobación HITL", () => {
    const validApproval = ApproveActionSchema.safeParse({
      actionId: "act_12345",
      confirmed: true,
      notes: "Aprobado por el usuario",
    });
    expect(validApproval.success).toBe(true);
  });

  it("Valida esquema de streaming de chat (ChatStreamSchema - CORE-14 / SEC-02)", () => {
    const validChat = ChatStreamSchema.safeParse({
      prompt: "Explica la arquitectura de memoria",
      sessionId: "session_123",
      systemPrompt: "Eres Ego",
    });
    expect(validChat.success).toBe(true);

    const emptyPrompt = ChatStreamSchema.safeParse({
      prompt: "",
    });
    expect(emptyPrompt.success).toBe(false);

    const missingPrompt = ChatStreamSchema.safeParse({});
    expect(missingPrompt.success).toBe(false);
  });
});
