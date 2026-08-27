import { t } from '@lingui/core/macro';
import { Badge } from '@mantine/core';
import {
  IconCircleCheck,
  IconEdit,
  IconReceipt,
  IconShoppingCart,
  IconUserPlus
} from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ActionButton } from '@lib/components/ActionButton';
import { type RowAction } from '@lib/components/RowActions';
import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import useTable from '@lib/hooks/UseTable';
import { useApi } from '../../contexts/ApiContext';
import { usePurchaseOrderFields } from '../../forms/PurchaseOrderForms';
import { useSalesOrderFields } from '../../forms/SalesOrderForms';
import { showApiErrorMessage } from '../../functions/notifications';
import { useCreateApiFormModal, useEditApiFormModal } from '../../hooks/UseForm';
import { useUserState } from '../../states/UserState';
import { InvenTreeTable } from '../InvenTreeTable';

export default function ProcurementSubtaskTable({
  ticket,
  onSelectSubtask,
  refresh
}: Readonly<{
  ticket: any;
  onSelectSubtask?: (subtask: any) => void;
  refresh?: () => void;
}>) {
  const api = useApi();
  const navigate = useNavigate();
  const user = useUserState();
  const table = useTable(`procurement-subtasks-${ticket.pk}`);
  const [selectedSubtask, setSelectedSubtask] = useState<any>();
  const isAssignmentManager =
    user.isStaff() || user.hasGroup('Assignment Manager');
  const isWarehouseManager =
    user.isStaff() || user.hasGroup('Warehouse Manager');
  const canAssign =
    isAssignmentManager && ['proposal', 'assignment'].includes(ticket.status);
  const canWarehouseApprove =
    isWarehouseManager && ticket.status === 'warehouse_review';
  const statusLabels: Record<string, string> = {
    waiting_approval: t`Waiting Approval`,
    pending: t`Not Started`,
    done: t`Completed`
  };
  const purchaseOrderFields = usePurchaseOrderFields({ create: true, projectCodeId: ticket.project_code });
  const salesOrderFields = useSalesOrderFields({ create: true, projectCodeId: ticket.project_code });
  const bulkAssign = useCreateApiFormModal({
    url: apiUrl(ApiEndpoints.procurement_assignment_upload, ticket.pk),
    title: t`Assign Selected Items`,
    submitText: t`Assign Selected Items`,
    successMessage: t`Selected items assigned`,
    ignorePermissionCheck: true,
    fields: {
      subtasks: { field_type: 'number', hidden: true, value: table.selectedIds },
      handler: {
        field_type: 'related field',
        api_url: apiUrl(ApiEndpoints.user_list),
        label: t`Procurement Handler`,
        required: true,
        filters: { is_active: true }
      }
    },
    table,
    onFormSuccess: refresh
  });
  const bulkApprove = useCreateApiFormModal({
    url: apiUrl(ApiEndpoints.procurement_subtasks_approve, ticket.pk),
    title: t`Approve Selected Items`,
    submitText: t`Approve Selected Items`,
    successMessage: t`Selected items approved`,
    ignorePermissionCheck: true,
    fields: {
      subtasks: { field_type: 'number', hidden: true, value: table.selectedIds }
    },
    table,
    onFormSuccess: refresh
  });
  const updateStatus = useEditApiFormModal({
    url: apiUrl(ApiEndpoints.procurement_subtask_detail, ticket.pk, { subtask_pk: selectedSubtask?.pk }),
    title: t`Update Item Status`,
    fields: {
      status: {
        field_type: 'choice',
        label: t`Status`,
        choices: [
          {
            value: selectedSubtask?.status,
            display_name: statusLabels[selectedSubtask?.status]
          },
          { value: 'done', display_name: statusLabels.done }
        ].filter((choice) => choice.value)
      }
    },
    onFormSuccess: refresh
  });
  const editSubtask = useEditApiFormModal({
    url: apiUrl(ApiEndpoints.procurement_subtask_detail, ticket.pk, { subtask_pk: selectedSubtask?.pk }),
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
    onFormSuccess: refresh
  });
  const newPurchaseOrder = useCreateApiFormModal({
    url: ApiEndpoints.purchase_order_list,
    title: t`Create Purchase Order`,
    fields: { ...purchaseOrderFields, procurement_subtask: { field_type: 'number', hidden: true, value: selectedSubtask?.pk } },
    initialData: { procurement_subtask: selectedSubtask?.pk, project_code: ticket.project_code },
    onFormSuccess: refresh
  });
  const newSalesOrder = useCreateApiFormModal({
    url: ApiEndpoints.sales_order_list,
    title: t`Create Sales Order`,
    fields: { ...salesOrderFields, procurement_subtask: { field_type: 'number', hidden: true, value: selectedSubtask?.pk } },
    initialData: { procurement_subtask: selectedSubtask?.pk, project_code: ticket.project_code },
    onFormSuccess: refresh
  });
  const approveSubtask = useCallback((record: any) => {
    api
      .patch(apiUrl(ApiEndpoints.procurement_subtask_detail, ticket.pk, { subtask_pk: record.pk }), { status: 'pending' })
      .then(() => refresh?.())
      .catch((error) => showApiErrorMessage({ error, title: t`Unable to approve item` }));
  }, [api, refresh, ticket.pk]);
  const rowActions = useCallback((record: any): RowAction[] => {
    const isHandler = user.userId() === record.handler;
    const canPurchase =
      ticket.status === 'purchasing' &&
      (user.isStaff() || isHandler) &&
      user.hasAddRole(UserRoles.purchase_order);
    const canSell =
      ticket.status === 'purchasing' &&
      ticket.commercial &&
      (user.isStaff() || isHandler) &&
      user.hasAddRole(UserRoles.sales_order);
    const canComplete =
      ticket.status === 'purchasing' &&
      record.status === 'pending' &&
      isHandler;
    const canApprove =
      canWarehouseApprove && record.status === 'waiting_approval';
    const canEdit = canAssign || canWarehouseApprove;
    return [
      {
        title: t`Approve Item`,
        icon: <IconCircleCheck />,
        hidden: !canApprove,
        onClick: () => approveSubtask(record)
      },
      {
        title: t`Edit Procurement Item`,
        icon: <IconEdit />,
        hidden: !canEdit,
        onClick: () => {
          setSelectedSubtask(record);
          editSubtask.open();
        }
      },
      {
        title: t`Complete Item`,
        icon: <IconCircleCheck />,
        hidden: !canComplete,
        onClick: () => {
          setSelectedSubtask(record);
          updateStatus.open();
        }
      },
      {
        title: t`Create Purchase Order`,
        icon: <IconShoppingCart />,
        hidden: !canPurchase,
        onClick: () => {
          setSelectedSubtask(record);
          newPurchaseOrder.open();
        }
      },
      {
        title: t`Create Sales Order`,
        icon: <IconReceipt />,
        hidden: !canSell,
        onClick: () => {
          setSelectedSubtask(record);
          newSalesOrder.open();
        }
      }
    ];
  }, [approveSubtask, canAssign, canWarehouseApprove, editSubtask, newPurchaseOrder, newSalesOrder, ticket.commercial, ticket.status, updateStatus, user]);

  return <>
    {bulkAssign.modal}{bulkApprove.modal}{updateStatus.modal}{editSubtask.modal}{newPurchaseOrder.modal}{newSalesOrder.modal}
    <InvenTreeTable
      tableData={ticket.procurement_subtasks ?? []}
      tableState={table}
      columns={[
        { accessor: 'pk', title: t`Item ID` },
        { accessor: 'title', title: t`Item` },
        { accessor: 'item_code', title: t`Item Code` },
        { accessor: 'manufacturer', title: t`Manufacturer / Origin` },
        { accessor: 'unit', title: t`Unit` },
        { accessor: 'requested_quantity', title: t`Requested Quantity` },
        {
          accessor: 'technical_contact_detail.username',
          title: t`Requester / Technical Contact`,
          render: (record: any) =>
            record.technical_contact_detail?.username ?? '-'
        },
        {
          accessor: 'handler_detail.username',
          title: t`Procurement Handler`,
          render: (record: any) => record.handler_detail?.username ?? '-'
        },
        {
          accessor: 'status',
          title: t`Status`,
          render: (record: any) => (
            <Badge
              color={
                record.status === 'done'
                  ? 'green'
                  : record.status === 'waiting_approval'
                    ? 'yellow'
                    : 'blue'
              }
              variant='light'
            >
              {statusLabels[record.status] ?? record.status}
            </Badge>
          )
        }
      ]}
      props={{
        rowActions,
        enableSelection: canAssign || canWarehouseApprove,
        isRecordSelectable: (record: any) =>
          !canWarehouseApprove || record.status === 'waiting_approval',
        enablePagination: false,
        onRowClick: (record: any) => onSelectSubtask?.(record),
        onRowDoubleClick: ({ record }: any) =>
          navigate(`/planning/tickets/${ticket.pk}/subtasks/${record.pk}/`),
        tableActions: [
          <ActionButton
            key='assign-procurement-items'
            text={t`Assign Selected Items`}
            icon={<IconUserPlus />}
            color='blue'
            variant='light'
            hidden={!canAssign}
            disabled={!table.hasSelectedRecords}
            onClick={bulkAssign.open}
          />,
          <ActionButton
            key='approve-procurement-items'
            text={t`Approve Selected Items`}
            icon={<IconCircleCheck />}
            color='green'
            variant='light'
            hidden={!canWarehouseApprove}
            disabled={!table.hasSelectedRecords}
            onClick={bulkApprove.open}
          />
        ]
      }}
    />
  </>;
}
