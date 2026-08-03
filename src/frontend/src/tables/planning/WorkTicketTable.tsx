import { t } from '@lingui/core/macro';
import { Anchor, Badge } from '@mantine/core';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AddItemButton } from '@lib/components/AddItemButton';
import { RowEditAction, type RowAction } from '@lib/components/RowActions';
import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import { getDetailUrl, navigateToLink } from '@lib/functions/Navigation';
import useTable from '@lib/hooks/UseTable';
import type { TableFilter } from '@lib/types/Filters';
import type { ApiFormFieldSet } from '@lib/types/Forms';
import { InvenTreeTable } from '../InvenTreeTable';
import { useCreateApiFormModal, useEditApiFormModal } from '../../hooks/UseForm';
import { usePurchaseOrderFields } from '../../forms/PurchaseOrderForms';
import { useSalesOrderFields } from '../../forms/SalesOrderForms';
import { useContractFields } from '../../forms/ContractForms';
import { useBuildOrderFields } from '../../forms/BuildForms';
import { useUserState } from '../../states/UserState';

export const ticketFields = ({
  planId,
  projectCodeId,
  parentId
}: {
  planId?: number;
  projectCodeId?: number;
  parentId?: number;
} = {}): ApiFormFieldSet => ({
  code: { field_type: 'string', label: t`Work Code`, read_only: true },
  title: { field_type: 'string', label: t`Work Content`, required: true },
  description: { field_type: 'string', label: t`Description` },
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
  start_date: { field_type: 'date', label: t`Start Date` },
  target_date: { field_type: 'date', label: t`Target Completion Date` },
  estimated_hours: { field_type: 'number', label: t`Estimated Hours` },
  actual_hours: { field_type: 'number', label: t`Actual Hours` },
  project_code: {
    field_type: 'related field',
    api_url: apiUrl(ApiEndpoints.project_code_list),
    label: t`Project Code`,
    required: true,
    value: projectCodeId,
    disabled: !!projectCodeId
  },
  plan: {
    field_type: 'related field',
    api_url: apiUrl(ApiEndpoints.work_plan_list),
    label: t`Work Plan`,
    value: planId,
    disabled: !!planId
  },
  parent: {
    field_type: 'related field',
    api_url: apiUrl(ApiEndpoints.work_ticket_list),
    label: t`Parent Work Ticket`,
    value: parentId,
    disabled: !!parentId,
    filters: {
      project_code: projectCodeId,
      plan: planId
    }
  },
  dependencies: {
    field_type: 'related field',
    api_url: apiUrl(ApiEndpoints.work_ticket_list),
    label: t`Dependencies`,
    multiple: true,
    filters: {
      project_code: projectCodeId,
      plan: planId
    }
  },
  assigned_to: {
    field_type: 'related field',
    api_url: apiUrl(ApiEndpoints.user_list),
    label: t`Assigned To`,
    required: true
  }
});

const statusLabels: Record<string, string> = {
  open: t`Open`,
  processing: t`Processing`,
  review: t`Review`,
  done: t`Done`
};

export const nextWorkTicketStatus = (
  record: any,
  userId: number | undefined,
  isStaff: boolean
) => {
  if (!record) return undefined;
  if (['on_hold', 'done', 'cancelled'].includes(record.plan_detail?.status)) {
    return undefined;
  }
  const managesPlan =
    userId === record.plan_detail?.manager_detail?.pk ||
    userId === record.plan_detail?.created_by_detail?.pk;
  const dependenciesComplete =
    record.dependency_details?.every((item: any) => item.status === 'done') ?? true;
  if (
    record.status === 'open' &&
    dependenciesComplete &&
    (isStaff || userId === record.assigned_to)
  ) {
    return 'processing';
  }
  if (record.status === 'processing' && (isStaff || userId === record.assigned_to)) {
    return 'review';
  }
  if (
    record.status === 'review' &&
    (record.open_subtask_count ?? 0) === 0 &&
    (isStaff || userId === record.assigned_by || managesPlan)
  ) {
    return 'done';
  }
  return undefined;
};

export const workTicketStatusFields = (
  record?: any,
  userId?: number,
  isStaff = false
): ApiFormFieldSet => {
  const next = nextWorkTicketStatus(record, userId, isStaff);
  const values = [record?.status, next].filter(Boolean) as string[];
  return {
  status: {
    field_type: 'choice',
    label: t`Status`,
      choices: values.map((value) => ({
        value,
        display_name: statusLabels[value] ?? value
      }))
    }
  };
};

const priorityLabels: Record<string, string> = {
  low: t`Low`,
  normal: t`Normal`,
  high: t`High`,
  urgent: t`Urgent`
};

const ticketStatusLabels: Record<string, string> = {
  open: t`Open`,
  processing: t`Processing`,
  review: t`Review`,
  done: t`Done`
};

export default function WorkTicketTable({
  planId,
  projectCodeId,
  parentId,
  canCreate
}: Readonly<{
  planId?: number;
  projectCodeId?: number;
  parentId?: number;
  canCreate?: boolean;
}>) {
  const navigate = useNavigate();
  const user = useUserState();
  const table = useTable(
    parentId
      ? `work-tickets-parent-${parentId}`
      : planId
        ? `work-tickets-plan-${planId}`
        : 'work-tickets'
  );
  const [selectedTicket, setSelectedTicket] = useState<any>();
  const purchaseOrderFields = usePurchaseOrderFields({ create: true });
  const salesOrderFields = useSalesOrderFields({ create: true });
  const contractFields = useContractFields({});
  const buildOrderFields = useBuildOrderFields({
    create: true,
    modalId: 'create-ticket-build-order'
  });
  const tableFilters: TableFilter[] = [
    {
      name: 'status',
      label: t`Status`,
      type: 'choice',
      choices: [
        { value: 'open', label: t`Open` },
        { value: 'processing', label: t`Processing` },
        { value: 'review', label: t`Review` },
        { value: 'done', label: t`Done` }
      ]
    },
    {
      name: 'priority',
      label: t`Priority`,
      type: 'choice',
      choices: Object.entries(priorityLabels).map(([value, label]) => ({ value, label }))
    },
    { name: 'overdue', label: t`Overdue`, type: 'boolean' },
    {
      name: 'project_code',
      label: t`Project Code`,
      type: 'api',
      apiUrl: apiUrl(ApiEndpoints.project_code_list)
    },
    {
      name: 'assigned_to',
      label: t`Assigned To`,
      type: 'api',
      apiUrl: apiUrl(ApiEndpoints.user_list)
    }
  ];
  const newTicket = useCreateApiFormModal({
    url: ApiEndpoints.work_ticket_list,
    title: t`Add Work Ticket`,
    fields: ticketFields({ planId, projectCodeId, parentId }),
    initialData: {
      plan: planId,
      project_code: projectCodeId,
      parent: parentId,
      priority: 'normal'
    },
    table
  });
  const updateStatus = useEditApiFormModal({
    url: ApiEndpoints.work_ticket_list,
    pk: selectedTicket?.pk,
    title: t`Update Work Status`,
    fields: workTicketStatusFields(selectedTicket, user.userId(), user.isStaff()),
    table
  });
  const newPurchaseOrder = useCreateApiFormModal({
    url: ApiEndpoints.purchase_order_list,
    title: t`Create Purchase Order from Work Ticket`,
    fields: {
      ...purchaseOrderFields,
      work_ticket: { field_type: 'number', hidden: true, value: selectedTicket?.pk }
    },
    initialData: { work_ticket: selectedTicket?.pk },
    table
  });
  const newSalesOrder = useCreateApiFormModal({
    url: ApiEndpoints.sales_order_list,
    title: t`Create Sales Order from Work Ticket`,
    fields: {
      ...salesOrderFields,
      work_ticket: { field_type: 'number', hidden: true, value: selectedTicket?.pk }
    },
    initialData: { work_ticket: selectedTicket?.pk },
    table
  });
  const newContract = useCreateApiFormModal({
    url: ApiEndpoints.contract_list,
    title: t`Create Contract from Work Ticket`,
    fields: {
      ...contractFields,
      work_ticket: { field_type: 'number', hidden: true, value: selectedTicket?.pk }
    },
    initialData: {
      work_ticket: selectedTicket?.pk,
      project_code: selectedTicket?.project_code ?? projectCodeId
    },
    table
  });
  const newBuildOrder = useCreateApiFormModal({
    url: ApiEndpoints.build_order_list,
    title: t`Add Build Order`,
    modalId: 'create-ticket-build-order',
    fields: {
      ...buildOrderFields,
      work_ticket: { field_type: 'number', hidden: true, value: selectedTicket?.pk },
      project_code: {
        ...buildOrderFields.project_code,
        value: selectedTicket?.project_code ?? projectCodeId,
        disabled: !!(selectedTicket?.project_code ?? projectCodeId)
      }
    },
    initialData: {
      work_ticket: selectedTicket?.pk,
      project_code: selectedTicket?.project_code ?? projectCodeId
    },
    table
  });

  const columns = useMemo(
    () => [
      {
        accessor: 'code',
        title: t`Work Code`,
        sortable: true,
        render: (record: any) => (
          <Anchor
            href={getDetailUrl(ModelType.workticket, record.pk, true)}
            onClick={(event) =>
              navigateToLink(getDetailUrl(ModelType.workticket, record.pk), navigate, event)
            }
          >
            {record.code}
          </Anchor>
        )
      },
      { accessor: 'title', title: t`Work Content`, sortable: true },
      {
        accessor: 'plan_detail.code',
        title: t`Work Plan`,
        hidden: !!planId,
        render: (record: any) => record.plan_detail?.code ?? '-'
      },
      {
        accessor: 'project_code',
        title: t`Project Code`,
        sortable: true,
        render: (record: any) => record.project_code_detail?.code ?? '-'
      },
      {
        accessor: 'priority',
        title: t`Priority`,
        render: (record: any) => priorityLabels[record.priority] ?? record.priority
      },
      { accessor: 'start_date', title: t`Start Date`, sortable: true },
      { accessor: 'target_date', title: t`Target Completion Date`, sortable: true },
      { accessor: 'completion_date', title: t`Completion Date`, sortable: true },
      {
        accessor: 'assigned_to__username',
        title: t`Assigned To`,
        render: (record: any) => record.assigned_to_detail?.username
      },
      {
        accessor: 'assigned_by__username',
        title: t`Assigned By`,
        render: (record: any) => record.assigned_by_detail?.username
      },
      {
        accessor: 'status',
        title: t`Status`,
        render: (record: any) => (
          <Badge color={record.overdue ? 'red' : undefined}>
            {record.overdue ? t`Overdue` : (ticketStatusLabels[record.status] ?? record.status)}
          </Badge>
        )
      }
    ],
    [navigate]
  );

  const rowActions = useCallback(
    (record: any): RowAction[] => {
      const uid = user.userId();
      const isStaff = user.isStaff();
      const canLink =
        isStaff ||
        uid === record.assigned_to ||
        uid === record.assigned_by ||
        uid === record.plan_detail?.manager_detail?.pk ||
        uid === record.plan_detail?.created_by_detail?.pk;
      const canCreatePurchaseOrder = user.hasAddRole(UserRoles.purchase_order);
      const canCreateSalesOrder = user.hasAddRole(UserRoles.sales_order);
      const canCreateContract = canCreatePurchaseOrder || canCreateSalesOrder;
      const canCreateBuildOrder = user.hasAddRole(UserRoles.build);
      return [
      RowEditAction({
        hidden: !nextWorkTicketStatus(record, uid, isStaff),
        onClick: () => {
          setSelectedTicket(record);
          updateStatus.open();
        }
      }),
      {
        title: t`Create Purchase Order`,
        hidden: !canLink || !canCreatePurchaseOrder,
        onClick: () => {
          setSelectedTicket(record);
          newPurchaseOrder.open();
        }
      },
      {
        title: t`Create Sales Order`,
        hidden: !canLink || !canCreateSalesOrder,
        onClick: () => {
          setSelectedTicket(record);
          newSalesOrder.open();
        }
      },
      {
        title: t`Create Contract`,
        hidden: !canLink || !canCreateContract,
        onClick: () => {
          setSelectedTicket(record);
          newContract.open();
        }
      },
      {
        title: t`Add Build Order`,
        hidden: !canLink || !canCreateBuildOrder,
        onClick: () => {
          setSelectedTicket(record);
          newBuildOrder.open();
        }
      }
      ];
    },
    [newBuildOrder, newContract, newPurchaseOrder, newSalesOrder, updateStatus, user]
  );

  return (
    <>
      {newTicket.modal}
      {updateStatus.modal}
      {newPurchaseOrder.modal}
      {newSalesOrder.modal}
      {newContract.modal}
      {newBuildOrder.modal}
      <InvenTreeTable
        url={apiUrl(ApiEndpoints.work_ticket_list)}
        tableState={table}
        columns={columns}
        props={{
          rowActions,
          params: { plan: planId, parent: parentId },
          tableFilters,
          enableDownload: true,
          tableActions: [
            <AddItemButton
              key='add-ticket'
              tooltip={t`Add Work Ticket`}
              hidden={canCreate === false || (canCreate === undefined && !user.isStaff())}
              onClick={() => newTicket.open()}
            />
          ]
        }}
      />
    </>
  );
}
