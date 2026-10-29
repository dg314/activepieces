import { isNil, tryCatch } from '@activepieces/core-utils';
import {
  PlanName,
  SelfServeTrialState,
  PlatformAdminSurface,
} from '@activepieces/shared';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { t } from 'i18next';
import { Gem } from 'lucide-react';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { DataFetchErrorState } from '@/components/custom/data-fetch-error-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useIsPlatformAdmin } from '@/hooks/authorization-hooks';
import { platformHooks } from '@/hooks/platform-hooks';
import { AdminControl, adminControl } from '@/lib/admin-control';
import { cn } from '@/lib/utils';

import { platformBillingApi } from '../api/billing-plans-api';
import { billingDialogHooks } from '../hooks/billing-dialog-hooks';
import { billingQueries, refreshBillingCaches } from '../hooks/billing-hooks';
import {
  SeatGrace,
  SelfServeTrial,
  selfServeTrialHooks,
} from '../hooks/self-serve-trial-hooks';
import { useUpgradeClick } from '../hooks/use-upgrade-click';
import { selfServeTrialCopy } from '../utils/self-serve-trial-utils';

import { useSalesLink } from './current-subscription-card';
import { DeactivateUsersDialog } from './feature-usage/deactivate-users-dialog';

export function SelfServeTrialLine({ trial }: { trial: SelfServeTrial }) {
  const line = (
    <LineBody
      icon={
        <Gem
          className={cn(
            'size-3.5 shrink-0 -translate-y-px',
            trial.endsToday ? 'text-warning-11' : 'text-accent-11',
          )}
        />
      }
      title={t('Enterprise trial')}
      status={selfServeTrialCopy.cardStatus(trial)}
      warn={trial.endsToday}
    />
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {trial.isPlatformAdmin ? (
          <Link
            to="/platform/billing"
            className="max-w-full min-w-0 self-start hover:underline"
          >
            {line}
          </Link>
        ) : (
          <span tabIndex={0} className="max-w-full min-w-0 self-start">
            {line}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-64">
        {selfServeTrialCopy.details(trial)}
      </TooltipContent>
    </Tooltip>
  );
}

export function SeatGraceLine({ grace }: { grace: SeatGrace }) {
  const { openDialog } = billingDialogHooks.useTrialSeatDialogStore();
  const line = (
    <LineBody
      title={t('Enterprise trial ended')}
      status={selfServeTrialCopy.cardStatus(grace)}
      warn
    />
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {grace.isPlatformAdmin ? (
          <button
            {...adminControl(AdminControl.TRIAL_SEATS_OPEN)}
            type="button"
            onClick={openDialog}
            className="max-w-full min-w-0 self-start hover:underline"
          >
            {line}
          </button>
        ) : (
          <span tabIndex={0} className="max-w-full min-w-0 self-start">
            {line}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-64">
        {selfServeTrialCopy.seatGraceTooltip(grace)}
      </TooltipContent>
    </Tooltip>
  );
}

export function EnterprisePlanIndicator() {
  const trial = selfServeTrialHooks.useTrial();
  const grace = selfServeTrialHooks.useSeatGrace();
  const { platform } = platformHooks.useCurrentPlatform();
  const salesLink = useSalesLink({ surface: 'enterprise_plan_indicator' });
  const inTrial =
    trial.state === SelfServeTrialState.ACTIVE && !isNil(trial.endsAt);
  if (!trial.isPlatformAdmin) {
    return null;
  }
  if (inTrial) {
    return <TrialIndicator trial={trial} />;
  }
  if (!isNil(grace)) {
    return <SeatGraceIndicator grace={grace} />;
  }
  if (!platform.plan.plan?.startsWith(PlanName.ENTERPRISE)) {
    return null;
  }
  return (
    <a
      {...salesLink}
      data-slot="enterprise-plan-indicator"
      className={ROW_CLASS}
    >
      <IndicatorLabel
        title={t('Enterprise plan')}
        detail={t('Talk to sales')}
        warn={false}
      />
    </a>
  );
}

function TrialIndicator({ trial }: { trial: SelfServeTrial }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/platform/billing"
          data-slot="enterprise-plan-indicator"
          className={ROW_CLASS}
        >
          <IndicatorLabel
            title={t('Enterprise plan trial')}
            detail={selfServeTrialCopy.sidebarDetail(trial)}
            warn={trial.endsToday}
          />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-64">
        {selfServeTrialCopy.details(trial)}
      </TooltipContent>
    </Tooltip>
  );
}

function SeatGraceIndicator({ grace }: { grace: SeatGrace }) {
  const { openDialog } = billingDialogHooks.useTrialSeatDialogStore();
  return (
    <button
      {...adminControl(AdminControl.TRIAL_SEATS_OPEN)}
      type="button"
      data-slot="enterprise-plan-indicator"
      onClick={openDialog}
      className={cn(ROW_CLASS, 'w-full text-left')}
    >
      <IndicatorLabel
        title={t('Enterprise trial ended')}
        detail={selfServeTrialCopy.seatGraceSidebarDetail(grace)}
        warn
      />
    </button>
  );
}

function LineBody({ icon, title, status, warn }: LineBodyProps) {
  return (
    <span
      className={cn(
        'flex min-w-0 items-center gap-1.5 text-xs whitespace-nowrap',
        warn ? 'text-warning-11' : 'text-gray-11',
      )}
    >
      {icon}
      <span className="min-w-0 truncate font-medium">{title}</span>
      <span className="shrink-0">· {status}</span>
    </span>
  );
}

function IndicatorLabel({ title, detail, warn }: IndicatorLabelProps) {
  return (
    <>
      <Gem className="mt-0.5 size-4 shrink-0 text-accent-11" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-gray-12">{title}</span>
        <span
          className={cn('text-xs', warn ? 'text-warning-11' : 'text-gray-11')}
        >
          {detail}
        </span>
      </span>
    </>
  );
}

const ROW_CLASS =
  'flex min-w-0 items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-gray-4';

export function SelfServeTrialSeatDialog() {
  const queryClient = useQueryClient();
  const { platform } = platformHooks.useCurrentPlatform();
  const isPlatformAdmin = useIsPlatformAdmin();
  const grace = selfServeTrialHooks.useSeatGrace();
  const {
    data: info,
    isError,
    refetch,
  } = billingQueries.usePlatformSubscription(
    platform.id,
    isPlatformAdmin && !isNil(grace),
  );
  const { isOpen, closeDialog } = billingDialogHooks.useTrialSeatDialogStore();
  const upgradeClick = useUpgradeClick();

  const settleGrace = async () => {
    await tryCatch(() => platformBillingApi.refreshSubscriptionInfo());
    refreshBillingCaches(queryClient);
  };

  if (isNil(grace)) {
    return null;
  }
  if (isNil(info) && isError) {
    return (
      <Dialog open={isOpen} onOpenChange={(next) => !next && closeDialog()}>
        <DialogContent className="max-w-[480px] gap-4">
          <DialogHeader>
            <DialogTitle>{t('Manage seats')}</DialogTitle>
          </DialogHeader>
          <DataFetchErrorState entity={t('users')} onRetry={refetch} />
        </DialogContent>
      </Dialog>
    );
  }
  const seatGrace = info?.seatGrace;
  if (isNil(info) || isNil(seatGrace)) {
    return null;
  }
  const seatLimit = seatGrace.seatLimit;
  const date = dayjs(grace.endsAt).format('MMM D');

  return (
    <DeactivateUsersDialog
      open={isOpen}
      onOpenChange={(next) => !next && closeDialog()}
      targetSeats={seatLimit}
      currentUsers={seatGrace.usedSeats}
      description={t(
        'Your Enterprise trial has ended and the {plan} plan includes {target, plural, =1 {1 seat} other {# seats}}. The users ticked below will be deactivated on {date}. Change who goes, or upgrade to keep everyone.',
        {
          plan: info.autumnPlanName ?? t('Free'),
          target: seatLimit,
          date,
        },
      )}
      preselectedUserIds={seatGrace.userIds}
      preselectedLabel={t('Leaves {date}', { date })}
      hideEmbeddedUsers
      actions={
        <Button
          {...adminControl(AdminControl.TRIAL_PLANS_OPEN)}
          type="button"
          variant="link"
          className="sm:mr-auto"
          onClick={() => {
            closeDialog();
            upgradeClick({ surface: PlatformAdminSurface.DIALOG });
          }}
        >
          {t('Explore plans')}
        </Button>
      }
      onConfirmed={() => void settleGrace()}
    />
  );
}

type LineBodyProps = {
  icon?: ReactNode;
  title: string;
  status: string;
  warn: boolean;
};

type IndicatorLabelProps = {
  title: string;
  detail: string;
  warn: boolean;
};
