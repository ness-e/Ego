import { describe, it, expect, beforeEach } from "vitest";
import { CrmDomain } from "../src/crm/CrmDomain.js";

describe("CrmDomain (DOM-05)", () => {
  let crm: CrmDomain;

  beforeEach(() => {
    crm = new CrmDomain();
  });

  it("debe crear y listar contactos comerciales", async () => {
    const contact = await crm.createContact({
      name: "Alex Rivera",
      email: "alex@enterprise.com",
      company: "Enterprise AI Inc",
      phone: "+1 555-0199",
      tags: ["b2b", "decision-maker"],
    });

    expect(contact.id).toBeDefined();
    expect(contact.name).toBe("Alex Rivera");
    expect(contact.email).toBe("alex@enterprise.com");

    const contacts = await crm.listContacts();
    expect(contacts.length).toBe(1);
    expect(contacts[0].id).toBe(contact.id);
  });

  it("debe rechazar contactos con email inválido mediante Zod", async () => {
    await expect(
      crm.createContact({
        name: "Test Invalido",
        email: "email-no-valido",
      })
    ).rejects.toThrow();
  });

  it("debe crear deals y calcular el pipeline ponderado correctamente", async () => {
    const contact = await crm.createContact({
      name: "Laura Gómez",
      email: "laura@corp.tech",
    });

    const d1 = await crm.createDeal({
      title: "Licencia Anual Ego SOC Enterprise",
      valueUsd: 50000,
      contactId: contact.id,
      stage: "proposal",
      probabilityPct: 60,
    });

    const d2 = await crm.createDeal({
      title: "Servicios de Despliegue Local",
      valueUsd: 10000,
      contactId: contact.id,
      stage: "lead",
      probabilityPct: 20,
    });

    expect(d1.id).toBeDefined();
    expect(d2.id).toBeDefined();

    const summary = await crm.getPipelineSummary();
    expect(summary.dealsCount).toBe(2);
    expect(summary.totalPipelineUsd).toBe(60000);
    // Ponderado: 50000 * 0.6 + 10000 * 0.2 = 30000 + 2000 = 32000
    expect(summary.weightedPipelineUsd).toBe(32000);
    expect(summary.stagesCount.proposal).toBe(1);
    expect(summary.stagesCount.lead).toBe(1);
  });

  it("debe actualizar la etapa del deal a 'won' fijando probabilidad al 100%", async () => {
    const contact = await crm.createContact({
      name: "Carlos Mendez",
      email: "carlos@startup.io",
    });

    const deal = await crm.createDeal({
      title: "Plan Pro Anual",
      valueUsd: 12000,
      contactId: contact.id,
      stage: "qualified",
    });

    const updated = await crm.updateDealStage(deal.id, "won");
    expect(updated.stage).toBe("won");
    expect(updated.probabilityPct).toBe(100);

    const wonDeals = await crm.listDeals({ stage: "won" });
    expect(wonDeals.length).toBe(1);
  });

  it("debe registrar interacciones y obtener la cronología del contacto", async () => {
    const contact = await crm.createContact({
      name: "Elena Soto",
      email: "elena@agency.co",
    });

    await crm.recordInteraction({
      contactId: contact.id,
      kind: "meeting",
      summary: "Demo de capacidades cognitivas y Dynamic Workspace",
      timestamp: "2026-10-10T10:00:00Z",
    });

    await crm.recordInteraction({
      contactId: contact.id,
      kind: "email",
      summary: "Envío de cotización formal y propuesta técnica",
      timestamp: "2026-10-10T14:30:00Z",
    });

    const timeline = await crm.getTimelineForContact(contact.id);
    expect(timeline.length).toBe(2);
    // Orden descendente cronológico
    expect(timeline[0].kind).toBe("email");
    expect(timeline[1].kind).toBe("meeting");
  });
});
