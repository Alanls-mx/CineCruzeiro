import { Flow } from './flow-engine.types.js';
import { MainMenuFlow } from './cinema/main-menu.flow.js';
import { ProgrammingFlow } from './cinema/programming.flow.js';
import { BuyTicketFlow } from './cinema/buy-ticket.flow.js';
import { SnackBarFlow } from './cinema/snack-bar.flow.js';
import { HumanSupportFlow } from './cinema/human-support.flow.js';

export class FlowRegistry {
  private static flows = new Map<string, Flow>();

  static initialize() {
    if (this.flows.size > 0) return;

    const flowList: Flow[] = [
      new MainMenuFlow(),
      new ProgrammingFlow(),
      new BuyTicketFlow(),
      new SnackBarFlow(),
      new HumanSupportFlow(),
    ];

    for (const flow of flowList) {
      this.flows.set(flow.id, flow);
    }
  }

  static getFlow(flowId: string): Flow | undefined {
    this.initialize();
    return this.flows.get(flowId);
  }
}
