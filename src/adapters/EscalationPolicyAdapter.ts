/**
 * EscalationPolicyAdapter
 */

import {EscalationPolicy} from "../types/EscalationPolicy";


export interface EscalationPolicyAdapter {
  getEscalationPolicyConfig(serviceId:string): EscalationPolicy;
  updateEscalationPolicyConfig(escalationPolicy:EscalationPolicy) : void;
}
