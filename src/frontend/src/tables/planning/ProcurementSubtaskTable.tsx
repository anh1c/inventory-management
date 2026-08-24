import { t } from '@lingui/core/macro';
import { Badge } from '@mantine/core';
import { IconUserCheck } from '@tabler/icons-react';
import { useCallback, useState } from 'react';

import { ActionButton } from '@lib/components/ActionButton';
import { RowEditAction, type RowAction } from '@lib/components/RowActions';
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

const statusLabels: Record<string, string> = { waiting_approval: 'Chờ duyệt', pending: 'Chưa thực hiện', done: 'Hoàn thành' };

export default function ProcurementSubtaskTable({
  ticket,
  canBulkAssign,
  onSelectSubtask,
  refresh
}: Readonly<{
  ticket: any;
  canBulkAssign: boolean;
  onSelectSubtask?: (subtask: any) => void;
  refresh?: () => void;
}>) {
  const api = useApi();
  const user = useUserState();
  const table = useTable(`procurement-subtasks-${ticket.pk}`);
  const [selectedSubtask, setSelectedSubtask] = useState<any>();
  const canAssign = canBulkAssign && ['proposal', 'assignment'].includes(ticket.status);
  const purchaseOrderFields = usePurchaseOrderFields({ create: true, projectCodeId: ticket.project_code });
  const salesOrderFields = useSalesOrderFields({ create: true, projectCodeId: ticket.project_code });
  const bulkAssign = useCreateApiFormModal({
    url: apiUrl(ApiEndpoints.procurement_assignment_upload, ticket.pk),
    title: 'Phân công các mục đã chọn',
    ignorePermissionCheck: true,
    fields: {
      subtasks: { field_type: 'number', hidden: true, value: table.selectedIds },
      assigned_to: { field_type: 'related field', api_url: apiUrl(ApiEndpoints.user_list), label: 'Người thực hiện mua hàng', required: true, filters: { is_active: true } }
    },
    table,
    onFormSuccess: refresh
  });
  const updateStatus = useEditApiFormModal({
    url: apiUrl(ApiEndpoints.procurement_subtask_detail, ticket.pk, { subtask_pk: selectedSubtask?.pk }),
    title: 'Cập nhật trạng thái mặt hàng',
    fields: { status: { field_type: 'choice', label: 'Trạng thái', choices: [{ value: selectedSubtask?.status, display_name: statusLabels[selectedSubtask?.status] }, { value: 'done', display_name: statusLabels.done }].filter((choice) => choice.value) } },
    onFormSuccess: refresh
  });
  const newPurchaseOrder = useCreateApiFormModal({
    url: ApiEndpoints.purchase_order_list,
    title: t`Create Purchase Order`,
    fields: { ...purchaseOrderFields, procurement_subtask: { field_type: 'number', hidden: true, value: selectedSubtask?.pk } },
    initialData: { procurement_subtask: selectedSubtask?.pk, project_code: ticket.project_code }
  });
  const newSalesOrder = useCreateApiFormModal({
    url: ApiEndpoints.sales_order_list,
    title: t`Create Sales Order`,
    fields: { ...salesOrderFields, procurement_subtask: { field_type: 'number', hidden: true, value: selectedSubtask?.pk } },
    initialData: { procurement_subtask: selectedSubtask?.pk, project_code: ticket.project_code }
  });
  const approveSubtask = useCallback((record: any) => {
    api
      .patch(apiUrl(ApiEndpoints.procurement_subtask_detail, ticket.pk, { subtask_pk: record.pk }), { status: 'pending' })
      .then(() => refresh?.())
      .catch((error) => showApiErrorMessage({ error, title: 'Không thể duyệt mục' }));
  }, [api, refresh, ticket.pk]);
  const rowActions = useCallback((record: any): RowAction[] => {
    const canPurchase = ticket.status === 'purchasing' && user.hasAddRole(UserRoles.purchase_order);
    const canSell = canPurchase && ticket.commercial && user.hasAddRole(UserRoles.sales_order);
    const canComplete = ticket.status === 'purchasing' && record.status === 'pending' && (user.isStaff() || user.userId() === record.handler);
    const canApprove = ticket.status === 'warehouse_review' && record.status === 'waiting_approval' && (user.isStaff() || user.hasChangeRole(UserRoles.stock));
    return [
      { title: 'Duyệt mục', hidden: !canApprove, onClick: () => approveSubtask(record) },
      RowEditAction({ hidden: !canComplete, onClick: () => { setSelectedSubtask(record); updateStatus.open(); } }),
      { title: t`Create Purchase Order`, hidden: !canPurchase, onClick: () => { setSelectedSubtask(record); newPurchaseOrder.open(); } },
      { title: t`Create Sales Order`, hidden: !canSell, onClick: () => { setSelectedSubtask(record); newSalesOrder.open(); } }
    ];
  }, [approveSubtask, newPurchaseOrder, newSalesOrder, ticket.commercial, ticket.status, updateStatus, user]);

  return <>
    {bulkAssign.modal}{updateStatus.modal}{newPurchaseOrder.modal}{newSalesOrder.modal}
    <InvenTreeTable
      tableData={ticket.procurement_subtasks ?? []}
      tableState={table}
      columns={[
        { accessor: 'pk', title: 'Mã mục' },
        { accessor: 'title', title: 'Mặt hàng' },
        { accessor: 'item_code', title: 'Mã hàng' },
        { accessor: 'manufacturer', title: 'Hãng/Xuất xứ' },
        { accessor: 'unit', title: 'Đơn vị tính' },
        { accessor: 'requested_quantity', title: 'Số lượng cần' },
        { accessor: 'technical_contact_detail.username', title: 'Người đề xuất/Kỹ thuật', render: (record: any) => record.technical_contact_detail?.username ?? '-' },
        { accessor: 'handler_detail.username', title: 'Người thực hiện mua hàng', render: (record: any) => record.handler_detail?.username ?? '-' },
        { accessor: 'status', title: 'Trạng thái', render: (record: any) => <Badge color={record.status === 'done' ? 'green' : record.status === 'waiting_approval' ? 'yellow' : 'gray'}>{statusLabels[record.status] ?? record.status}</Badge> }
      ]}
      props={{
        rowActions,
        enableSelection: canAssign,
        enablePagination: false,
        onRowClick: (record: any) => onSelectSubtask?.(record),
        tableActions: [<ActionButton key='assign-procurement-items' text='Phân công mục đã chọn' icon={<IconUserCheck />} hidden={!canAssign} disabled={!table.hasSelectedRecords} onClick={bulkAssign.open} />]
      }}
    />
  </>;
}
