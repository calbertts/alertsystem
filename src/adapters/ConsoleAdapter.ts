/**
 * ConsoleAdapter
 */

import {HealthStatus} from "../types/HealthStatusType";

export interface ConsoleAdapter {
  getHealthServiceStatus(serviceId:string) : HealthStatus;
  setAsHealthy(serviceId:string) : void;
}

