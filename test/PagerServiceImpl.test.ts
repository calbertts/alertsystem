import { createMock } from 'ts-auto-mock';

import PagerServiceImpl from "../src/services/PagerServiceImpl";
import {PersistenceAdapter} from "../src/adapters/PersistenceAdapter";
import {EscalationPolicyAdapter} from "../src/adapters/EscalationPolicyAdapter";
import {MailAdapter} from "../src/adapters/MailAdapter";
import {SMSAdapter} from "../src/adapters/SMSAdapter";
import {TimerAdapter} from "../src/adapters/TimerAdapter";

import {AlertStatus} from "../src/types/AlertStatus";
import {EscalationPolicy} from "../src/types/EscalationPolicy";
import {HealthStatus} from "../src/types/HealthStatusType";

describe("Pager Service", () => {
  function createPagerInstance({
      escalationPolicyAdapterMock,
      persistenceAdapterMock,
      timerAdapterMock,
      mailAdapterMock,
      smsAdapterMock
    }: {
      escalationPolicyAdapterMock?:EscalationPolicyAdapter,
      persistenceAdapterMock?:PersistenceAdapter,
      timerAdapterMock?:TimerAdapter,
      mailAdapterMock?:MailAdapter,
      smsAdapterMock?:SMSAdapter
    }
  ) {
    return new PagerServiceImpl(
      escalationPolicyAdapterMock ?? createMock<EscalationPolicyAdapter>(),
      persistenceAdapterMock ?? createMock<PersistenceAdapter>(),
      timerAdapterMock ?? createMock<TimerAdapter>(),
      mailAdapterMock ?? createMock<MailAdapter>(),
      smsAdapterMock ?? createMock<SMSAdapter>()
    );
  }

  /**
   * Given a Monitored Service in a Healthy State,
   * when the Pager receives an Alert related to this Monitored Service,
   * then the Monitored Service becomes Unhealthy,
   * the Pager notifies all targets of the first level of the escalation policy,
   * and sets a 15-minutes acknowledgement delay
   */
  describe("Scenario 1", () => {
    test("should process an alert for a healty service notifying the first level", async () => {
      const alertStatus:AlertStatus = createMock<AlertStatus>({
        setAsUnhealthy: jest.fn(),
        getStatus: jest.fn()
          .mockReturnValueOnce(HealthStatus.HEALTHY)
          .mockReturnValue(HealthStatus.UNHEALTHY),
        isAcknowledged: jest.fn().mockReturnValue(false),
        hasTimeout: jest.fn().mockReturnValue(false),
      });

      const persistenceAdapterMock:PersistenceAdapter = {
        getAlertStatus: jest.fn().mockResolvedValue(Promise.resolve(null)),
        createServiceAlertStatus: jest.fn().mockResolvedValue(Promise.resolve(alertStatus)),
      } as unknown as PersistenceAdapter;

      const timerAdapterMock:TimerAdapter = createMock<TimerAdapter>({
        setAcknowledgeTimeout: jest.fn()
      });

      const mailSendAlertMock = jest.fn();
      const smsSendAlertMock = jest.fn();
      const escalationPolicyMock:EscalationPolicy = {
        serviceId: "serviceId",
        levels: [
          {
            id: 1,
            getTargets: jest.fn().mockReturnValue([{
              value: "e@email.com",
              sendAlert: mailSendAlertMock
            } as MailAdapter])
          },
          {
            id: 2,
            getTargets: jest.fn().mockReturnValue([{
              value: "+34111222333",
              sendAlert: smsSendAlertMock
            } as SMSAdapter])
          }
        ],
      } as unknown as EscalationPolicy;
      escalationPolicyMock.getEscalationPolicyTarget = jest.fn().mockReturnValue(escalationPolicyMock.levels.find(l => l.id === 1));

      const escalationPolicyAdapterMock:EscalationPolicyAdapter = {
        getEscalationPolicyConfig: jest.fn().mockReturnValue(escalationPolicyMock),
      } as unknown as EscalationPolicyAdapter;

      const pagerService = createPagerInstance({
        timerAdapterMock,
        escalationPolicyAdapterMock, 
        persistenceAdapterMock
      });

      await pagerService.processAlert({
        id: "alert1",
        serviceId: "service1",
        message: "I'm in trouble"
      });

      expect(alertStatus.setAsUnhealthy).toBeCalled();
      expect(escalationPolicyAdapterMock.getEscalationPolicyConfig).toBeCalled();
      expect(escalationPolicyMock.getEscalationPolicyTarget).toBeCalledWith(1);
      expect(mailSendAlertMock).toBeCalled();
      expect(smsSendAlertMock).not.toBeCalled();
      expect(timerAdapterMock.setAcknowledgeTimeout).toBeCalled();
    });

    test("should pass when there's no escalation config available", async () => {
      const alertStatus:AlertStatus = createMock<AlertStatus>({
        setAsUnhealthy: jest.fn(),
      });

      const persistenceAdapterMock:PersistenceAdapter = {
        getAlertStatus: jest.fn().mockResolvedValue(Promise.resolve(null)),
        createServiceAlertStatus: jest.fn().mockResolvedValue(Promise.resolve(alertStatus)),
      } as unknown as PersistenceAdapter;

      const escalationPolicyMock:EscalationPolicy = createMock<EscalationPolicy>({
        getEscalationPolicyTarget: jest.fn().mockReturnValue(null)
      });

      const escalationPolicyAdapterMock:EscalationPolicyAdapter = {
        getEscalationPolicyConfig: jest.fn().mockReturnValue(escalationPolicyMock),
      } as unknown as EscalationPolicyAdapter;

      const pagerService = createPagerInstance({
        escalationPolicyAdapterMock,
        persistenceAdapterMock
      });

      await pagerService.processAlert({
        id: "alert1",
        serviceId: "service1",
        message: "I'm in trouble"
      });

      expect(escalationPolicyMock.getEscalationPolicyTarget).toBeCalled();
      expect(escalationPolicyAdapterMock.getEscalationPolicyConfig).toBeCalled();
      expect(alertStatus.setAsUnhealthy).not.toBeCalled();
    });
  });


  /**
   * Given a Monitored Service in an Unhealthy State,
   * the corresponding Alert is not Acknowledged
   * and the last level has not been notified,
   * when the Pager receives the Acknowledgement Timeout,
   * then the Pager notifies all targets of the next level of the escalation policy
   * and sets a 15-minutes acknowledgement delay.
   */
  describe("Scenario 2", () => {
    test("should process an alert for an unhealty service and after the acknowledge timeout, it notifies the next level", async () => {
      const alertStatus:AlertStatus = createMock<AlertStatus>({
        currentLevel: 1,
        setAsUnhealthy: jest.fn(),
        getStatus: jest.fn().mockReturnValue(HealthStatus.UNHEALTHY),
        isAcknowledged: jest.fn().mockReturnValue(false),
        hasTimeout: jest.fn().mockReturnValue(true),
      });

      const persistenceAdapterMock:PersistenceAdapter = {
        getAlertStatus: jest.fn().mockResolvedValue(Promise.resolve(alertStatus)),
        createServiceAlertStatus: jest.fn(),
      } as unknown as PersistenceAdapter;

      const timerAdapterMock:TimerAdapter = createMock<TimerAdapter>({
        setAcknowledgeTimeout: jest.fn()
      });

      const mailSendAlertMock = jest.fn();
      const smsSendAlertMock = jest.fn();
      const escalationPolicyMock:EscalationPolicy = {
        serviceId: "serviceId",
        levels: [
          {
            id: 1,
            getTargets: jest.fn().mockReturnValue([{
              value: "e@email.com",
              sendAlert: mailSendAlertMock
            } as MailAdapter])
          },
          {
            id: 2,
            getTargets: jest.fn().mockReturnValue([{
              value: "+34111222333",
              sendAlert: smsSendAlertMock
            } as SMSAdapter])
          }
        ],
      } as unknown as EscalationPolicy;
      escalationPolicyMock.getEscalationPolicyTarget = jest.fn().mockReturnValue(escalationPolicyMock.levels.find(l => l.id === 2));

      const escalationPolicyAdapterMock:EscalationPolicyAdapter = {
        getEscalationPolicyConfig: jest.fn().mockReturnValue(escalationPolicyMock),
      } as unknown as EscalationPolicyAdapter;

      const pagerService = createPagerInstance({
        persistenceAdapterMock,
        timerAdapterMock,
        escalationPolicyAdapterMock,
      });
      const processAlertSpy = jest.spyOn(pagerService, "processAlert");

      await pagerService.acknowledgeTimeout({
        id: "alert2",
        serviceId: "service2",
        message: "I'm in trouble"
      });

      expect(processAlertSpy).toBeCalled();
      expect(persistenceAdapterMock.createServiceAlertStatus).not.toBeCalled();
      expect(alertStatus.setAsUnhealthy).not.toBeCalled();
      expect(escalationPolicyAdapterMock.getEscalationPolicyConfig).toBeCalled();
      expect(escalationPolicyMock.getEscalationPolicyTarget).toBeCalledWith(2);
      expect(mailSendAlertMock).not.toBeCalled();
      expect(smsSendAlertMock).toBeCalled();
      expect(timerAdapterMock.setAcknowledgeTimeout).toBeCalled();
    });
  });


  /**
   * Given a Monitored Service in an Unhealthy State
   * when the Pager receives the Acknowledgement
   * and later receives the Acknowledgement Timeout,
   * then the Pager doesn't notify any Target
   * and doesn't set an acknowledgement delay.
   */
  describe("Scenario 3", () => {
    test("should process an alert for an unhealty service with acknowledged alert and after the acknowledge timeout, it doesn't notify any target", async () => {
      const alertStatus:AlertStatus = createMock<AlertStatus>({
        isAcknowledged: jest.fn().mockReturnValue(true),
        hasTimeout: jest.fn().mockReturnValue(true),
        setAsAcknowledged: jest.fn()
      });

      const persistenceAdapterMock:PersistenceAdapter = {
        getAlertStatus: jest.fn().mockResolvedValue(Promise.resolve(alertStatus)),
        createServiceAlertStatus: jest.fn(),
      } as unknown as PersistenceAdapter;

      const timerAdapterMock:TimerAdapter = createMock<TimerAdapter>({
        setAcknowledgeTimeout: jest.fn()
      });

      const pagerService = createPagerInstance({
        persistenceAdapterMock,
        timerAdapterMock,
      });
      const processAlertSpy = jest.spyOn(pagerService, "processAlert");

      const alert = {
        id: "alert2",
        serviceId: "service2",
        message: "I'm in trouble"
      };
      await pagerService.alertAcknowledged(alert);
      await pagerService.acknowledgeTimeout(alert);

      expect(alertStatus.setAsAcknowledged).toBeCalled();
      expect(processAlertSpy).not.toBeCalled();
      expect(timerAdapterMock.setAcknowledgeTimeout).not.toBeCalled();
    });
  });


  /**
   * Given a Monitored Service in an Unhealthy State,
   * when the Pager receives an Alert related to this Monitored Service,
   * then the Pager doesn’t notify any Target
   * and doesn’t set an acknowledgement delay
   */
  describe("Scenario 4", () => {
    test("should process an alert for an unhealty service, with no acknowledgement and no timeout, it doesn't notify any target", async () => {
      const alertStatus:AlertStatus = createMock<AlertStatus>({
        getStatus: jest.fn().mockReturnValue(HealthStatus.UNHEALTHY),
        hasTimeout: jest.fn().mockReturnValue(false),
        isAcknowledged: jest.fn().mockReturnValue(false)
      });

      const persistenceAdapterMock:PersistenceAdapter = {
        getAlertStatus: jest.fn().mockResolvedValue(Promise.resolve(alertStatus)),
        createServiceAlertStatus: jest.fn(),
      } as unknown as PersistenceAdapter;

      const timerAdapterMock:TimerAdapter = createMock<TimerAdapter>({
        setAcknowledgeTimeout: jest.fn()
      });

      const pagerService = createPagerInstance({
        persistenceAdapterMock,
        timerAdapterMock,
      });

      await pagerService.processAlert({
        id: "alert2",
        serviceId: "service2",
        message: "I'm in trouble"
      });

      expect(alertStatus.getStatus).toBeCalled();
      expect(alertStatus.isAcknowledged).toBeCalled();
      expect(timerAdapterMock.setAcknowledgeTimeout).not.toBeCalled();
    });
  });


  /**
   * Given a Monitored Service in an Unhealthy State,
   * when the Pager receives a Healthy event related to this Monitored Service
   * and later receives the Acknowledgement Timeout,
   * then the Monitored Service becomes Healthy,
   * the Pager doesn’t notify any Target
   * and doesn’t set an acknowledgement delay
   */
  describe("Scenario 5", () => {
    test("should process an alert for an unhealty service with acknowledged alert and after the acknowledge timeout, it doesn't notify any target", async () => {
      const alertStatus:AlertStatus = createMock<AlertStatus>({
        isAcknowledged: jest.fn().mockReturnValue(true),
        setAsHealthy: jest.fn(),
        hasTimeout: jest.fn().mockReturnValue(true),
        setAsAcknowledged: jest.fn().mockReturnValue(false),
        getStatus: jest.fn().mockReturnValue(HealthStatus.HEALTHY),
      });

      const persistenceAdapterMock:PersistenceAdapter = {
        getAlertStatus: jest.fn().mockResolvedValue(Promise.resolve(alertStatus)),
        createServiceAlertStatus: jest.fn(),
      } as unknown as PersistenceAdapter;

      const timerAdapterMock:TimerAdapter = createMock<TimerAdapter>({
        setAcknowledgeTimeout: jest.fn()
      });

      const pagerService = createPagerInstance({
        persistenceAdapterMock,
        timerAdapterMock,
      });
      const processAlertSpy = jest.spyOn(pagerService, "processAlert");

      const alert = {
        id: "alert2",
        serviceId: "service2",
        message: "I'm in trouble"
      };

      await pagerService.setAsHealthy(alert);
      await pagerService.acknowledgeTimeout(alert);

      expect(alertStatus.getStatus).toBeCalled();
      expect(alertStatus.setAsHealthy).toBeCalled();
      expect(alertStatus.setAsAcknowledged).not.toBeCalled();
      expect(processAlertSpy).not.toBeCalled();
      expect(timerAdapterMock.setAcknowledgeTimeout).not.toBeCalled();
    });
  });
});
