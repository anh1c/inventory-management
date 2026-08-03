import { t } from '@lingui/core/macro';
import { Badge, Progress, Skeleton, Stack, Text } from '@mantine/core';
import { IconInfoCircle, IconListCheck } from '@tabler/icons-react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import PrimaryActionButton from '../../components/buttons/PrimaryActionButton';
import { type DetailsField, DetailsTable } from '../../components/details/Details';
import { ItemDetailsGrid } from '../../components/details/ItemDetails';
import InstanceDetail from '../../components/nav/InstanceDetail';
import { PageDetail } from '../../components/nav/PageDetail';
import type { PanelType } from '../../components/panels/Panel';
import { PanelGroup } from '../../components/panels/PanelGroup';
import { useEditApiFormModal } from '../../hooks/UseForm';
import { useInstance } from '../../hooks/UseInstance';
import { useUserState } from '../../states/UserState';
import WorkTicketTable from '../../tables/planning/WorkTicketTable';
import { workPlanFields } from '../../tables/planning/WorkPlanTable';

const statusLabels: Record<string, string> = {
  draft: t`Draft`,
  active: t`Active`,
  on_hold: t`On Hold`,
  done: t`Done`,
  cancelled: t`Cancelled`
};

const priorityLabels: Record<string, string> = {
  low: t`Low`,
  normal: t`Normal`,
  high: t`High`,
  urgent: t`Urgent`
};

export default function WorkPlanDetail() {
  const { id } = useParams();
  const user = useUserState();
  const { instance: plan, instanceQuery, refreshInstance } = useInstance({
    endpoint: ApiEndpoints.work_plan_list,
    pk: id,
    refetchOnMount: true
  });
  const editPlan = useEditApiFormModal({
    url: ApiEndpoints.work_plan_list,
    pk: id,
    title: t`Edit Work Plan`,
    fields: workPlanFields(),
    onFormSuccess: refreshInstance
  });

  const canEdit =
    user.isStaff() ||
    user.userId() === plan.created_by_detail?.pk ||
    user.userId() === plan.manager_detail?.pk;
  const total = plan.ticket_count ?? 0;
  const completed = plan.completed_ticket_count ?? 0;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const detailsPanel = useMemo(() => {
    if (instanceQuery.isFetching) return <Skeleton />;

    const fields: DetailsField[] = [
      { type: 'text', name: 'code', label: t`Plan Code`, icon: 'reference', copy: true },
      { type: 'text', name: 'name', label: t`Plan Name`, icon: 'name', copy: true },
      { type: 'text', name: 'description', label: t`Description`, icon: 'description' },
      {
        type: 'text',
        name: 'project_code_detail.code',
        label: t`Project Code`,
        icon: 'sitemap',
        copy: true
      },
      {
        type: 'text',
        name: 'manager_detail.username',
        label: t`Plan Manager`,
        icon: 'user'
      },
      {
        type: 'text',
        name: 'status',
        label: t`Status`,
        icon: 'status',
        value_formatter: () => <Badge>{statusLabels[plan.status] ?? plan.status}</Badge>
      },
      {
        type: 'text',
        name: 'priority',
        label: t`Priority`,
        icon: 'priority',
        value_formatter: () => priorityLabels[plan.priority] ?? plan.priority
      },
      { type: 'date', name: 'start_date', label: t`Start Date`, icon: 'calendar' },
      {
        type: 'date',
        name: 'target_date',
        label: t`Target Completion Date`,
        icon: 'target_date'
      },
      { type: 'date', name: 'created', label: t`Creation Date`, icon: 'creation_date', showTime: true },
      { type: 'date', name: 'updated', label: t`Updated`, icon: 'calendar', showTime: true }
    ];

    return (
      <Stack gap='md'>
        <ItemDetailsGrid>
          <DetailsTable fields={fields} item={plan} />
        </ItemDetailsGrid>
        <Stack gap={4}>
          <Text fw={600}>{t`Overall Progress`}: {progress}%</Text>
          <Progress value={progress} size='lg' />
          <Text size='sm' c='dimmed'>
            {completed}/{total} {t`tasks completed`}
          </Text>
        </Stack>
      </Stack>
    );
  }, [completed, instanceQuery.isFetching, plan, progress, total]);

  const panels: PanelType[] = [
    {
      name: 'details',
      label: t`Plan Details`,
      icon: <IconInfoCircle />,
      content: detailsPanel
    },
    {
      name: 'tickets',
      label: t`Work Tickets`,
      icon: <IconListCheck />,
      content: (
        <WorkTicketTable
          planId={plan.pk}
          projectCodeId={plan.project_code}
          canCreate={canEdit && ['draft', 'active'].includes(plan.status)}
        />
      )
    }
  ];

  return (
    <>
      {editPlan.modal}
      <InstanceDetail query={instanceQuery}>
        <Stack gap='xs'>
          <PageDetail
            title={plan.code}
            subtitle={plan.name}
            badges={[<Badge key='status'>{statusLabels[plan.status] ?? plan.status}</Badge>]}
            actions={[
              <PrimaryActionButton
                key='edit-plan'
                title={t`Edit Work Plan`}
                icon='edit'
                hidden={!canEdit}
                onClick={editPlan.open}
              />
            ]}
            breadcrumbs={[{ name: t`Work Plans`, url: '/planning/plans/index/' }]}
          />
          <PanelGroup
            pageKey='work-plan'
            panels={panels}
            model={ModelType.workplan}
            instance={plan}
            id={plan.pk}
            reloadInstance={refreshInstance}
          />
        </Stack>
      </InstanceDetail>
    </>
  );
}
