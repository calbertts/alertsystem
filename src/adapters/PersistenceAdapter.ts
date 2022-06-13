/**
 * PersistenceAdapter
 */

import {AlertStatus} from "../types/AlertStatus";
import {Alert} from "../types/Alert";

export interface PersistenceAdapter {
  updateAlertStatus(alertStatus:AlertStatus) : Promise<void>;
  getAlertStatus(alert:Alert) : Promise<AlertStatus>;
  updateServiceStatus(alertStatus:AlertStatus) : Promise<void>;
  createServiceAlertStatus(alertStatus:object) : Promise<AlertStatus>;
}
