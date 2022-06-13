/**
 * MailAdapter
 */

import {Alert} from "../types/Alert";
import {Target} from "../types/Target";

export interface MailAdapter extends Target {
  sendAlert(alert:Alert) : Promise<any>;
}
