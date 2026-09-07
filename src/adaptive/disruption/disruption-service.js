/**
 * TIMORA - Disruption Service
 * Manages disruption lifecycle: record, list, retrieve, update status.
 */

import { Disruption, DISRUPTION_STATUS } from './disruption-model.js';

class DisruptionService {
  constructor() {
    this.disruptions = [];
  }

  recordDisruption(data) {
    const disruption = new Disruption(data);
    this.disruptions.push(disruption);
    return disruption;
  }

  getDisruptionById(id) {
    return this.disruptions.find(d => d.id === id);
  }

  getAllDisruptions() {
    return [...this.disruptions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  updateDisruptionStatus(id, newStatus) {
    const disruption = this.getDisruptionById(id);
    if (!disruption) {
      throw new Error(`Disruption with ID ${id} not found.`);
    }
    if (!Object.values(DISRUPTION_STATUS).includes(newStatus)) {
      throw new Error(`Invalid disruption status: ${newStatus}`);
    }
    disruption.status = newStatus;
    return disruption;
  }
}

export const disruptionService = new DisruptionService();
