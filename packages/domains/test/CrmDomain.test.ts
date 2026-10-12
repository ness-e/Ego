import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter } from "@ego/memory";
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

  describe("F2T4 cold-reboot (H07)", () => {
    let dir: string;
    let adapter: EgoMemoryAdapter | undefined;

    afterEach(async () => {
      if (adapter?.ready) await adapter.close();
      adapter = undefined;
      if (dir) {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch {
          // Ignorar bloqueos de Windows
        }
      }
    });

    it("rehidrata contactos, deals e interacciones tras reinicio", async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), "ego-f2t4-crm-"));
      adapter = new EgoMemoryAdapter(dir);
      await adapter.init();

      const d1 = new CrmDomain(adapter);
      const contact = await d1.createContact({ name: "Reboot User", email: "reboot@corp.io" });
      const deal = await d1.createDeal({ title: "Deal reboot", valueUsd: 5000, contactId: contact.id });
      await d1.recordInteraction({ contactId: contact.id, kind: "note", summary: "Nota reboot" });
      await adapter.flush();
      await adapter.close();

      adapter = new EgoMemoryAdapter(dir);
      await adapter.init();
      const d2 = await CrmDomain.open(adapter);

      const contacts = await d2.listContacts();
      expect(contacts.length).toBe(1);
      expect(contacts[0].email).toBe("reboot@corp.io");

      const deals = await d2.listDeals();
      expect(deals.length).toBe(1);
      expect(deals[0].id).toBe(deal.id);

      const timeline = await d2.getTimelineForContact(contact.id);
      expect(timeline.length).toBe(1);
      expect(timeline[0].summary).toBe("Nota reboot");

      // get por clave también lee VantaDB si el snapshot no lo tiene
      const d3 = new CrmDomain(adapter);
      expect(await d3.getContact(contact.id)).toBeDefined();
    });
  });
});
