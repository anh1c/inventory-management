import { t } from '@lingui/core/macro';
import { Badge, Skeleton, Stack } from '@mantine/core';
import { IconInfoCircle, IconReceipt, IconShoppingCart } from '@tabler/icons-react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';
import { type DetailsField, DetailsTable } from '../../components/details/Details';
import { ItemDetailsGrid } from '../../components/details/ItemDetails';
import PrimaryActionButton from '../../components/buttons/PrimaryActionButton';
import InstanceDetail from '../../components/nav/InstanceDetail';
import { PageDetail } from '../../components/nav/PageDetail';
import type { PanelType } from '../../components/panels/Panel';
import { PanelGroup } from '../../components/panels/PanelGroup';
import { useInstance } from '../../hooks/UseInstance';
import { useEditApiFormModal } from '../../hooks/UseForm';
import { useUserState } from '../../states/UserState';
import { PurchaseOrderTable } from '../../tables/purchasing/PurchaseOrderTable';
import { SalesOrderTable } from '../../tables/sales/SalesOrderTable';

export default function ProcurementSubtaskDetail() {
  const { ticketId, subtaskId } = useParams();
  const user = useUserState();
  const { instance: ticket } = useInstance({
    endpoint: ApiEndpoints.work_ticket_list,
    pk: ticketId,
    refetchOnMount: true
  });
  const { instance: subtask, instanceQuery, refreshInstance } = useInstance({
    endpoint: ApiEndpoints.procurement_subtask_detail,
    pk: ticketId,
    pathParams: { subtask_pk: subtaskId ?? '' },
    refetchOnMount: true
  });
  const statusLabels: Record<string, string> = {
    waiting_approval: t`Waiting Approval`,
    pending: t`Not Started`,
    done: t`Completed`
  };
  const isAssignmentManager =
    user.isStaff() || user.hasGroup('Assignment Manager');
  const isWarehouseManager =
    user.isStaff() || user.hasGroup('Warehouse Manager');
  const canEditAssignment =
    isAssignmentManager && ['proposal', 'assignment'].includes(ticket.status);
  const canEditWarehouse =
    isWarehouseManager && ticket.status === 'warehouse_review';
  const canApprove =
    isWarehouseManager &&
    ticket.status === 'warehouse_review' &&
    subtask.status === 'waiting_approval';
  const canComplete =
    ticket.status === 'purchasing' &&
    subtask.status === 'pending' &&
    user.userId() === subtask.handler;
  const nextStatus = canApprove ? 'pending' : canComplete ? 'done' : undefined;
  const updateStatus = useEditApiFormModal({
    url: apiUrl(ApiEndpoints.procurement_subtask_detail, ticketId, {
      subtask_pk: subtaskId ?? ''
    }),
    title: t`Update Item Status`,
    fields: {
      status: {
        field_type: 'choice',
        label: t`Status`,
        choices: [
          { value: subtask.status, display_name: statusLabels[subtask.status] ?? subtask.status },
          ...(nextStatus ? [{ value: nextStatus, display_name: statusLabels[nextStatus] }] : [])
        ]
      }
    },
    onFormSuccess: refreshInstance
  });
  const editSubtask = useEditApiFormModal({
    url: apiUrl(ApiEndpoints.procurement_subtask_detail, ticketId, {
      subtask_pk: subtaskId ?? ''
    }),
    title: t`Edit Procurement Item`,
    successMessage: t`Procurement item updated`,
    ignorePermissionCheck: true,
    fields: ['proposal', 'assignment'].includes(ticket.status)
      ? {
          handler: {
            field_type: 'related field',
            api_url: apiUrl(ApiEndpoints.user_list),
            label: t`Procurement Handler`,
            filters: { is_active: true }
          },
          technical_contact: {
            field_type: 'related field',
            api_url: apiUrl(ApiEndpoints.user_list),
            label: t`Requester / Technical Contact`,
            filters: { is_active: true }
          }
        }
      : {
          title: { field_type: 'string', label: t`Item`, required: true },
          item_code: { field_type: 'string', label: t`Item Code` },
          manufacturer: { field_type: 'string', label: t`Manufacturer / Origin` },
          unit: { field_type: 'string', label: t`Unit` },
          requested_quantity: {
            field_type: 'decimal',
            label: t`Requested Quantity`
          },
          note: { field_type: 'string', label: t`Note` }
        },
    onFormSuccess: refreshInstance
  });

  const detailsPanel = useMemo(() => {
    if (instanceQuery.isFetching) return <Skeleton />;

    const fields: DetailsField[] = [
      { type: 'text', name: 'title', label: t`Item`, icon: 'name', copy: true },
      { type: 'text', name: 'item_code', label: t`Item Code`, icon: 'reference', copy: true },
      { type: 'text', name: 'manufacturer', label: t`Manufacturer / Origin`, icon: 'details' },
      { type: 'text', name: 'unit', label: t`Unit`, icon: 'details' },
      { type: 'text', name: 'requested_quantity', label: t`Requested Quantity`, icon: 'details' },
      { type: 'text', name: 'note', label: t`Note`, icon: 'description' },
      {
        type: 'text',
        name: 'technical_contact_detail.username',
        label: t`Requester / Technical Contact`,
        icon: 'user'
      },
      {
        type: 'text',
        name: 'handler_detail.username',
        label: t`Procurement Handler`,
        icon: 'user'
      },
      {
        type: 'text',
        name: 'status',
        label: t`Status`,
        icon: 'status',
        value_formatter: () => (
          <Badge
            color={
              subtask.status === 'done'
                ? 'green'
                : subtask.status === 'waiting_approval'
                  ? 'yellow'
                  : 'blue'
            }
            variant='light'
          >
            {statusLabels[subtask.status] ?? subtask.status}
          </Badge>
        )
      },
      {
        type: 'text',
        name: 'warehouse_approved_by_detail.username',
        label: t`Warehouse Approver`,
        icon: 'user'
      },
      {
        type: 'date',
        name: 'warehouse_approved_at',
        label: t`Warehouse Approval Time`,
        icon: 'calendar',
        showTime: true
      }
    ];

    return (
      <ItemDetailsGrid>
        <DetailsTable fields={fields} item={subtask} />
      </ItemDetailsGrid>
    );
  }, [instanceQuery.isFetching, subtask]);

  const panels: PanelType[] = useMemo(
    () => [
      { name: 'detail', label: t`Item Details`, icon: <IconInfoCircle />, content: detailsPanel },
      {
        name: 'purchase-orders',
        label: t`Purchase Orders`,
        icon: <IconShoppingCart />,
        content: (
          <PurchaseOrderTable
            procurementSubtaskId={subtask.pk}
            workTicketProjectCodeId={ticket.project_code}
            defaultOutstanding={false}
          />
        )
      },
      ...(ticket.commercial ? [{
        name: 'sales-orders',
        label: t`Sales Orders`,
        icon: <IconReceipt />,
        content: (
          <SalesOrderTable
            procurementSubtaskId={subtask.pk}
            workTicketProjectCodeId={ticket.project_code}
            defaultOutstanding={false}
          />
        )
      }] : [])
    ],
    [detailsPanel, subtask.pk, ticket.commercial, ticket.project_code]
  );

  return (
    <InstanceDetail query={instanceQuery}>
      <Stack gap='xs'>
        {updateStatus.modal}
        {editSubtask.modal}
        <PageDetail
          title={subtask.title || t`Item Details`}
          subtitle={subtask.item_code}
          badges={[<Badge key='status'>{statusLabels[subtask.status] ?? subtask.status}</Badge>]}
          breadcrumbs={[
            { name: t`Work Tickets`, url: '/planning/tickets/index/' },
            { name: ticket.code || t`Parent Work Ticket`, url: `/planning/tickets/${ticketId}/` }
          ]}
          actions={[
            <PrimaryActionButton
              key='edit-subtask'
              title={t`Edit Procurement Item`}
              icon='edit'
              color='blue'
              hidden={!canEditAssignment && !canEditWarehouse}
              onClick={editSubtask.open}
            />,
            <PrimaryActionButton
              key='update-subtask-status'
              title={canApprove ? t`Approve Item` : t`Complete Item`}
              icon='status'
              color='green'
              variant='filled'
              hidden={!nextStatus}
              onClick={updateStatus.open}
            />
          ]}
        />
        <PanelGroup
          pageKey='procurement-subtask'
          panels={panels}
          instance={subtask}
          id={subtask.pk}
          reloadInstance={refreshInstance}
        />
      </Stack>
    </InstanceDetail>
  );
}
