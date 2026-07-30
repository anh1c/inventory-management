import { t } from '@lingui/core/macro';
import { Badge } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useCallback, useMemo } from 'react';

import {
  type RowAction,
  RowCancelAction
} from '@lib/components/RowActions';
import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import useTable from '@lib/hooks/UseTable';
import type { TableColumn } from '@lib/types/Tables';
import { api } from '../../App';
import { InvenTreeIcon } from '../../functions/icons';
import { useUserState } from '../../states/UserState';
import { DateColumn } from '../ColumnRenderers';
import { InvenTreeTable } from '../InvenTreeTable';

const statusColors: Record<string, string> = {
  scheduled: 'blue',
  in_transit: 'orange',
  completed: 'green',
  cancelled: 'gray',
  failed: 'red'
};

function transferStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    scheduled: t`Scheduled`,
    in_transit: t`In Transit`,
    completed: t`Completed`,
    cancelled: t`Cancelled`,
    failed: t`Failed`
  };

  return labels[status] ?? status;
}

export function StockTransferOrderTable({
  locationId
}: Readonly<{ locationId?: number }>) {
  const table = useTable('stock-transfer-order');
  const user = useUserState();

  const columns: TableColumn[] = useMemo(
    () => [
      {
        accessor: 'reference',
        title: t`Transfer Reference`,
        sortable: false,
        copyable: true,
        switchable: false
      },
      {
        accessor: 'source_location',
        title: t`Source Location`,
        sortable: false,
        render: (record: any) =>
          record.source_location_detail?.pathstring ??
          record.source_location_detail?.name
      },
      {
        accessor: 'destination_location',
        title: t`Destination Location`,
        sortable: false,
        render: (record: any) =>
          record.destination_location_detail?.pathstring ??
          record.destination_location_detail?.name
      },
      {
        accessor: 'lines',
        title: t`Item Count`,
        sortable: false,
        defaultVisible: false,
        render: (record: any) => record.lines?.length ?? 0
      },
      DateColumn({
        accessor: 'scheduled_departure',
        title: t`Scheduled Departure`,
        sortable: true,
        extra: { showTime: true }
      }),
      DateColumn({
        accessor: 'expected_arrival',
        title: t`Expected Arrival`,
        sortable: true,
        extra: { showTime: true }
      }),
      {
        accessor: 'alert_days',
        title: t`Warning Days`,
        sortable: false,
        defaultVisible: false
      },
      {
        accessor: 'status',
        title: t`Status`,
        sortable: true,
        render: (record: any) => (
          <Badge color={statusColors[record.status] ?? 'gray'} variant='light'>
            {transferStatusLabel(record.status)}
          </Badge>
        )
      },
      {
        accessor: 'created_by_detail.username',
        title: t`Created By`,
        sortable: false,
        defaultVisible: false
      },
      {
        accessor: 'error_message',
        title: t`Error Message`,
        sortable: false,
        defaultVisible: false
      }
    ],
    []
  );

  const runAction = useCallback(
    async (endpoint: ApiEndpoints, record: any, successMessage: string) => {
      try {
        await api.post(apiUrl(endpoint, record.pk), {});
        notifications.show({ color: 'green', message: successMessage });
        table.refreshTable();
      } catch {
        notifications.show({
          color: 'red',
          message: t`Could not update the stock transfer`
        });
      }
    },
    [table]
  );

  const rowActions = useCallback(
    (record: any): RowAction[] => [
      {
        title: t`Mark as Departed`,
        tooltip: t`Move reserved stock into transit`,
        icon: <InvenTreeIcon icon='transfer' />,
        hidden: record.status !== 'scheduled',
        onClick: () =>
          runAction(
            ApiEndpoints.stock_transfer_order_depart,
            record,
            t`Stock transfer marked as departed`
          )
      },
      {
        title: t`Receive at Destination`,
        tooltip: t`Receive in-transit stock into the destination location`,
        icon: <InvenTreeIcon icon='stock' />,
        hidden: record.status !== 'in_transit',
        onClick: () =>
          runAction(
            ApiEndpoints.stock_transfer_order_complete,
            record,
            t`Stock transfer completed`
          )
      },
      RowCancelAction({
        hidden: !['scheduled', 'in_transit', 'failed'].includes(record.status),
        tooltip: t`Cancel the transfer and release the reserved stock`,
        onClick: () =>
          runAction(
            ApiEndpoints.stock_transfer_order_cancel,
            record,
            t`Stock transfer cancelled`
          )
      })
    ],
    [runAction]
  );

  return (
    <InvenTreeTable
      url={apiUrl(ApiEndpoints.stock_transfer_order_list)}
      tableState={table}
      columns={columns}
      props={{
        enableDownload: true,
        params: {
          location: locationId
        },
        rowActions: user.hasChangeRole(UserRoles.stock)
          ? rowActions
          : undefined
      }}
    />
  );
}
