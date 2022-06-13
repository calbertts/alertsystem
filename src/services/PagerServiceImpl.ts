/**
 * PagerServiceImpl
 */

import {Alert} from "../types/Alert";
import {PagerService} from "./PagerService";
import {EscalationPolicyAdapter} from "../adapters/EscalationPolicyAdapter";
import {PersistenceAdapter} from "../adapters/PersistenceAdapter";
import {TimerAdapter} from "../adapters/TimerAdapter";
import {MailAdapter} from "../adapters/MailAdapter";
import {SMSAdapter} from "../adapters/SMSAdapter";
import {EscalationPolicyTarget} from "../types/EscalationPolicy";
import {EscalationPolicy} from "../types/EscalationPolicy";
import {Target} from "../types/Target";
import {AlertStatus} from "../types/AlertStatus";
import {HealthStatus} from "../types/HealthStatusType";


export default class PagerServiceImpl implements PagerService {
  escalationPolicyAdapter: EscalationPolicyAdapter;
  persistenceAdapter: PersistenceAdapter;
  timerAdapter: TimerAdapter;
  mailAdapter: MailAdapter;
  smsAdapter: SMSAdapter;

  constructor(
    escalationPolicyAdapter:EscalationPolicyAdapter, 
    persistenceAdapter:PersistenceAdapter,
    timerAdapter:TimerAdapter,
    mailAdapter:MailAdapter,
    smsAdapter:SMSAdapter
  ) {
    this.escalationPolicyAdapter = escalationPolicyAdapter;
    this.persistenceAdapter = persistenceAdapter;
    this.mailAdapter = mailAdapter;
    this.smsAdapter = smsAdapter;
    this.timerAdapter = timerAdapter;
  }

  
  /**
   * Process an alert reported by an external service or when an escalation occurs
   *
   * @param {Alert} alert
   * @returns Promise<any>
   *
   */
  public async processAlert(alert:Alert) : Promise<void> {
    let alertStatus:AlertStatus = await this.persistenceAdapter.getAlertStatus(alert);
    const escalationPolicyConfig:EscalationPolicy = this.escalationPolicyAdapter.getEscalationPolicyConfig(alert.serviceId);
    const nextEscalationPolicyLevel:number = await this.getNextEscalationPolicyLevel(alertStatus);
    const escalationPolicyTarget:EscalationPolicyTarget = escalationPolicyConfig.getEscalationPolicyTarget(nextEscalationPolicyLevel);

    if (!escalationPolicyTarget) {
      return; // no more escalation policies available
    }

    if (!alertStatus) {
      alertStatus = await this.persistenceAdapter.createServiceAlertStatus({
        alertId: alert.id,
        serviceId: alert.serviceId,
        status: HealthStatus.HEALTHY,
        currentLevel: 1,
        acknowledged: false,
      });
    }

    if (alertStatus.getStatus() === HealthStatus.HEALTHY) {
      alertStatus.setAsUnhealthy();
      return this.notify(escalationPolicyTarget, alert);
    } 

    else if (alertStatus.getStatus() === HealthStatus.UNHEALTHY) {
      if (!alertStatus.isAcknowledged() && alertStatus.hasTimeout())
        return this.notify(escalationPolicyTarget, alert);
    }
  }


  private async notify(escalationPolicyTarget:EscalationPolicyTarget, alert:Alert) {
    const targets:Array<Target> = escalationPolicyTarget.getTargets();

    for(const target of targets) {
      await target.sendAlert(alert);
      this.timerAdapter.setAcknowledgeTimeout(alert);
    }
  }


  /**
   * Event fired when passed 15 minutes after an alert hasn't been acknowledged by the target
   *
   * @param {Alert} alert
   * @return Promise<void>
   *
   */
  public async acknowledgeTimeout(alert:Alert): Promise<void> {
    const alertStatus:AlertStatus = await this.persistenceAdapter.getAlertStatus(alert);

    if (!alertStatus.isAcknowledged() || alertStatus.getStatus() === HealthStatus.UNHEALTHY) {
      alertStatus.setAsTimeout();
      return this.processAlert(alert); // escalates to next target level
    }
  }


  /**
   * Event fired when an alert has been acknowledged by the target
   *
   * @param {Alert} alert
   * @returns Promise<void>
   */
  public async alertAcknowledged(alert:Alert): Promise<void> {
    const alertStatus:AlertStatus = await this.persistenceAdapter.getAlertStatus(alert);
    alertStatus.setAsAcknowledged();
  }


  /**
   * Marks a service as HEALTHY and disables the associated alert
   *
   * @param {alert} alert
   * @returns Promise<void>
   *
   */
  public async setAsHealthy(alert:Alert) : Promise<void> {
    const alertStatus:AlertStatus = await this.persistenceAdapter.getAlertStatus(alert);
    alertStatus.setAsHealthy();
  }


  /**
   * Returns the next escalation policy level for a previously registered alert
   *
   * @param {Alert} alertStatus
   * @returns Promise<number>
   *
   */
  private async getNextEscalationPolicyLevel(alertStatus:AlertStatus) : Promise<number> {
    if (!alertStatus) {
      return 1;
    } else {
      return (alertStatus.currentLevel || 0) + 1
    }
  }
}
