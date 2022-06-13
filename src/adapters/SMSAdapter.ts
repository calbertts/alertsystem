/**
 * SMSAdapter
 */

import {Alert} from "../types/Alert";
import {Target} from "../types/Target";

export interface SMSAdapter extends Target {
  sendAlert(alert:Alert) : Promise<any>;
}
