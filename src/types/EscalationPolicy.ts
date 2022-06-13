/**
 *  EscalationPolicy
 *  Example:
    {
      "serviceId": 1,
      "levels": [
        {
          "id": 1,
          "targets": [
            {
              "type": "mail",
              "value": "e@email.com"
            }
          ]
        },
        {
          "id": 2,
          "targets": [
            {
              "type": "mail",
              "value": "e@email.com"
            },
            {
              "type": "sms",
              "value": "+34111222333"
            }
          ]
        }
      ]
    }
 */

import {Target} from "../types/Target";

export type EscalationPolicyTarget = {
  id: number;
  targets: Array<Target>;

  getTargets(): Array<Target>;
}

export type EscalationPolicy = {
  serviceId: string;
  levels: Array<EscalationPolicyTarget>;

  getEscalationPolicyTarget(level:number) : EscalationPolicyTarget;
}

