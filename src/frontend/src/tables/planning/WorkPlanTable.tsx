import { t } from '@lingui/core/macro';
import { Anchor, Badge, Progress, Stack, Text } from '@mantine/core';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AddItemButton } from '@lib/components/AddItemButton';
import {
  RowDeleteAction,
  RowEditAction,
  type RowAction
} from '@lib/components/RowActions';
import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { apiUrl } from '@lib/functions/Api';
import { getDetailUrl, navigateToLink } from '@lib/functions/Navigation';
import useTable from '@lib/hooks/UseTable';
import type { ApiFormFieldSet } from '@lib/types/Forms';
import {
  useCreateApiFormModal,
  useDeleteApiFormModal,
  useEditApiFormModal
} from '../../hooks/UseForm';
import { InvenTreeTable } from '../InvenTreeTable';
import { useUserState } from '../../states/UserState';

export const workPlanFields = (): ApiFormFieldSet => ({
  code: { field_type: 'string', label: t`Plan Code`, read_only: true },
  name: { field_type: 'string', label: t`Plan Name`, required: true },
  description: { field_type: 'string', label: t`Description` },
  project_code: {
    field_type: 'related field',
    api_url: apiUrl(ApiEndpoints.project_code_list),
    label: t`Project Code`,
    required: true
  },
  manager: {
    field_type: 'related field',
    api_url: apiUrl(ApiEndpoints.user_list),
    label: t`Plan Manager`,
    required: true,
    filters: { is_active: true }
  },
  priority: {
    field_type: 'choice',
    label: t`Priority`,
    choices: [
      { value: 'low', display_name: t`Low` },
      { value: 'normal', display_name: t`Normal` },
      { value: 'high', display_name: t`High` },
      { value: 'urgent', display_name: t`Urgent` }
    ]
  },
  status: {
    field_type: 'choice',
    label: t`Status`,
    choices: [
      { value: 'draft', display_name: t`Draft` },
      { value: 'active', display_name: t`Active` },
      { value: 'on_hold', display_name: t`On Hold` },
      { value: 'done', display_name: t`Done` },
      { value: 'cancelled', display_name: t`Cancelled` }
    ]
  },
  start_date: { field_type: 'date', label: t`Start Date` },
  target_date: { field_type: 'date', label: t`Target Completion Date` }
});

const statusLabels: Record<string, string> = {
  draft: t`Draft`,
  active: t`Active`,
  on_hold: t`On Hold`,
  done: t`Done`,
  cancelled: t`Cancelled`
};

export default function WorkPlanTable({
  onSelectPlan
}: Readonly<{
  onSelectPlan?: (plan: any) => void;
}>) {
  const navigate = useNavigate();
  const user = useUserState();
  const table = useTable('work-plans');
  const [selectedPlan, setSelectedPlan] = useState<number>();

  const createPlan = useCreateApiFormModal({
    url: ApiEndpoints.work_plan_list,
    title: t`Create Work Plan`,
    fields: workPlanFields(),
    initialData: { status: 'draft', priority: 'normal' },
    table
  });
  const editPlan = useEditApiFormModal({
    url: ApiEndpoints.work_plan_list,
    pk: selectedPlan,
    title: t`Edit Work Plan`,
    fields: workPlanFields(),
    table
  });
  const deletePlan = useDeleteApiFormModal({
    url: ApiEndpoints.work_plan_list,
    pk: selectedPlan,
    title: t`Delete Work Plan`,
    table
  });

  const columns = useMemo(
    () => [
      {
        accessor: 'code',
        title: t`Plan Code`,
        sortable: true,
        render: (record: any) => {
          const url = getDetailUrl(ModelType.workplan, record.pk);
          return (
            <Anchor
              href={url}
              onClick={(event) => navigateToLink(url, navigate, event)}
            >
              {record.code}
            </Anchor>
          );
        }
      },
      { accessor: 'name', title: t`Plan Name`, sortable: true },
      {
        accessor: 'project_code_detail.code',
        title: t`Project Code`,
        render: (record: any) => record.project_code_detail?.code ?? '-'
      },
      {
        accessor: 'manager_detail.username',
        title: t`Plan Manager`,
        render: (record: any) => record.manager_detail?.username ?? '-'
      },
      {
        accessor: 'status',
        title: t`Status`,
        render: (record: any) => <Badge>{statusLabels[record.status] ?? record.status}</Badge>
      },
      {
        accessor: 'progress',
        title: t`Progress`,
        render: (record: any) => {
          const total = record.ticket_count ?? 0;
          const completed = record.completed_ticket_count ?? 0;
          const value = total > 0 ? Math.round((completed / total) * 100) : 0;
          return (
            <Stack gap={2} miw={140}>
              <Progress value={value} size='sm' />
              <Text size='xs' c='dimmed'>
                {completed}/{total} {t`tasks`} ({value}%)
              </Text>
            </Stack>
          );
        }
      },
      { accessor: 'start_date', title: t`Start Date`, sortable: true },
      { accessor: 'target_date', title: t`Target Completion Date`, sortable: true }
    ],
    [navigate]
  );

  const rowActions = useCallback(
    (record: any): RowAction[] => [
      RowEditAction({
        hidden:
          !user.isStaff() &&
          user.userId() !== record.created_by_detail?.pk &&
          user.userId() !== record.manager_detail?.pk,
        onClick: () => {
          setSelectedPlan(record.pk);
          editPlan.open();
        }
      }),
      RowDeleteAction({
        hidden:
          (record.ticket_count ?? 0) > 0 ||
          !user.isStaff() &&
          user.userId() !== record.created_by_detail?.pk &&
          user.userId() !== record.manager_detail?.pk,
        onClick: () => {
          setSelectedPlan(record.pk);
          deletePlan.open();
        }
      })
    ],
    [deletePlan, editPlan, user]
  );

  return (
    <>
      {createPlan.modal}
      {editPlan.modal}
      {deletePlan.modal}
      <InvenTreeTable
        url={apiUrl(ApiEndpoints.work_plan_list)}
        tableState={table}
        columns={columns}
        props={{
          onRowClick: onSelectPlan
            ? (record: any) => onSelectPlan(record)
            : undefined,
          rowActions,
          tableFilters: [
            {
              name: 'status',
              label: t`Status`,
              type: 'choice',
              choices: Object.entries(statusLabels).map(([value, label]) => ({ value, label }))
            },
            {
              name: 'project_code',
              label: t`Project Code`,
              type: 'api',
              apiUrl: apiUrl(ApiEndpoints.project_code_list)
            },
            {
              name: 'manager',
              label: t`Plan Manager`,
              type: 'api',
              apiUrl: apiUrl(ApiEndpoints.user_list)
            }
          ],
          enableDownload: true,
          tableActions: [
            <AddItemButton
              key='add-plan'
              tooltip={t`Create Work Plan`}
              hidden={!user.isStaff()}
              onClick={createPlan.open}
            />
          ]
        }}
      />
    </>
  );
}
