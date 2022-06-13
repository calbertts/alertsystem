/**
 * Target
 */

import {Alert} from "./Alert";


export type Target = {
  value: string;
  sendAlert(alert:Alert) : Promise<any>;
}
