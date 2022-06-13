/**
 * PagerService
 */

import {Alert} from "../types/Alert"

export interface PagerService {
  processAlert(alert:Alert) : Promise<void>;
  setAsHealthy(alert:Alert) : Promise<void>;
  alertAcknowledged(alert:Alert) : Promise<void>;
  acknowledgeTimeout(alert:Alert): Promise<any>;
}
