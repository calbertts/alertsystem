/**
 * AlertingAdapter
 */

import {Alert} from "../types/Alert";


export interface AlertingAdapter {
  processAlert(alert:Alert) : void;
}
