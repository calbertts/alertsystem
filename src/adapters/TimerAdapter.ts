/**
 * TimerAdapter
 */

import {Alert} from "../types/Alert";

export interface TimerAdapter {
  acknowledgeTimeout(): void;
  setAcknowledgeTimeout(alert:Alert): void;
}
