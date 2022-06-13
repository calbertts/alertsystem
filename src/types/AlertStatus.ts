/**
 *  AlertStatus
 */

import {HealthStatus} from "../types/HealthStatusType";


export interface AlertStatus {
  alertId?: string;
  serviceId: string;
  status: HealthStatus;
  currentLevel?: number;
  acknowledged?: boolean;
  timeout: boolean;

  setAsHealthy(): void;
  setAsUnhealthy(): void;
  setAsAcknowledged(): void;
  setEscalationPolicyLevel(level:number): void;
  getStatus(): HealthStatus;
  isAcknowledged(): boolean;
  hasTimeout(): boolean;
  setAsTimeout(): void;
}

