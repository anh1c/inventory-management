import { t } from '@lingui/core/macro';
import { Text } from '@mantine/core';
import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { ActionButton } from '@lib/components/ActionButton';
import { AddItemButton } from '@lib/components/AddItemButton';
import {
  type RowAction,
  RowDeleteAction,
  RowDuplicateAction,
  RowEditAction
} from '@lib/components/RowActions';
import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import useTable from '@lib/hooks/UseTable';
import type { TableFilter } from '@lib/types/Filters';
import type { TableColumn } from '@lib/types/Tables';
import { IconPackageImport } from '@tabler/icons-react';
import ImportPartWizard from '../../components/wizards/ImportPartWizard';
import { useSupplierPartFields } from '../../forms/CompanyForms';
import {
  useCreateApiFormModal,
  useDeleteApiFormModal,
  useEditApiFormModal
} from '../../hooks/UseForm';
import { usePluginsWithMixin } from '../../hooks/UsePlugins';
import { useUserState } from '../../states/UserState';
import {
  BooleanColumn,
  CompanyColumn,
  DecimalColumn,
  DescriptionColumn,
  IPNColumn,
  LinkColumn,
  NoteColumn,
  PartColumn
} from '../ColumnRenderers';
import { InvenTreeTable } from '../InvenTreeTable';
import { TableHoverCard } from '../TableHoverCard';

/*
 * Construct a table listing supplier parts
 */

export function SupplierPartTable({
  manufacturerId,
  manufacturerPartId,
  partId,
  supplierId
}: Readonly<{
  manufacturerId?: number;
  manufacturerPartId?: number;
  partId?: number;
  supplierId?: number;
}>): ReactNode {
  const initialFilters = useMemo(() => {
    const filters: TableFilter[] = [
      {
        name: 'active',
        value: 'true'
      }
    ];

    if (!supplierId) {
      filters.push({
        name: 'supplier_active',
        value: 'true'
      });
    }

    if (!partId) {
      filters.push({
        name: 'part_active',
        value: 'true'
      });
    }

    return filters;
  }, [supplierId, partId]);

  const table = useTable('supplierparts', {
    initialFilters: initialFilters
  });

  const user = useUserState();

  // Construct table columns for this table
  const tableColumns: TableColumn[] = useMemo(() => {
    return [
      PartColumn({
        switchable: !!partId,
        part: 'part_detail'
      }),
      IPNColumn({}),
      {
        accessor: 'supplier',
        sortable: true,
        render: (record: any) => (
          <CompanyColumn company={record?.supplier_detail} />
        )
      },
      {
        accessor: 'SKU',
        title: 'Mã hàng nhà cung cấp',
        sortable: true,
        copyable: true
      },
      DescriptionColumn({}),
      {
        accessor: 'manufacturer',
        title: 'Nhà sản xuất',
        sortable: true,
        render: (record: any) => (
          <CompanyColumn company={record?.manufacturer_detail} />
        )
      },
      {
        accessor: 'MPN',
        sortable: true,
        title: t`MPN`,
        render: (record: any) => record?.manufacturer_part_detail?.MPN,
        copyable: true,
        copyAccessor: 'manufacturer_part_detail.MPN'
      },
      BooleanColumn({
        accessor: 'primary',
        title: 'Ưu tiên',
        sortable: true,
        switchable: true,
        defaultVisible: false
      }),
      BooleanColumn({
        accessor: 'active',
        title: 'Hoạt động',
        sortable: true,
        switchable: true,
        defaultVisible: false
      }),
      DecimalColumn({
        accessor: 'in_stock',
        sortable: true
      }),
      {
        accessor: 'packaging',
        sortable: true,
        defaultVisible: false
      },
      {
        accessor: 'pack_quantity',
        sortable: true,
        render: (record: any) => {
          const part = record?.part_detail ?? {};

          const extra = [];

          if (part.units) {
            extra.push(
              <Text key='base' size='sm'>
                Đơn vị cơ sở : {part.units}
              </Text>
            );
          }

          return (
            <TableHoverCard
              value={record.pack_quantity}
              extra={extra}
              title='Số lượng mỗi kiện'
            />
          );
        }
      },
      LinkColumn({}),
      NoteColumn({}),
      {
        accessor: 'available',
        sortable: true,
        defaultVisible: false,
        render: (record: any) => {
          const extra = [];

          if (record.availablility_updated) {
            extra.push(
              <Text>
                Cập nhật : {record.availablility_updated}
              </Text>
            );
          }

          return <TableHoverCard value={record.available} extra={extra} />;
        }
      }
    ];
  }, [partId]);

  const supplierPartFields = useSupplierPartFields({
    partId: partId
  });

  const addSupplierPart = useCreateApiFormModal({
    url: ApiEndpoints.supplier_part_list,
    title: 'Thêm mã hàng nhà cung cấp',
    fields: supplierPartFields,
    initialData: {
      part: partId,
      supplier: supplierId,
      manufacturer_part: manufacturerPartId
    },
    onFormSuccess: (response: any) => {
      table.refreshTable();
    },
    successMessage: 'Đã tạo mã hàng nhà cung cấp',
    keepOpenOption: true
  });

  const supplierPlugins = usePluginsWithMixin('supplier');
  const importPartWizard = ImportPartWizard({
    partId: partId
  });

  const tableActions = useMemo(() => {
    return [
      <AddItemButton
        key='add-supplier-part'
        tooltip='Thêm mã hàng nhà cung cấp'
        onClick={() => addSupplierPart.open()}
        hidden={!user.hasAddRole(UserRoles.purchase_order)}
      />,
      <ActionButton
        key='import-part'
        icon={<IconPackageImport />}
        color='green'
        tooltip='Nhập mã hàng nhà cung cấp'
        onClick={() => importPartWizard.openWizard()}
        hidden={
          supplierPlugins.length === 0 ||
          !user.hasAddRole(UserRoles.part) ||
          !partId
        }
      />
    ];
  }, [user, partId, supplierPlugins]);

  const tableFilters: TableFilter[] = useMemo(() => {
    return [
      {
        name: 'active',
        label: 'Hoạt động',
        description: 'Hiển thị mã hàng nhà cung cấp còn hiệu lực'
      },
      {
        name: 'primary',
        label: 'Ưu tiên',
        description: 'Hiển thị mã hàng nhà cung cấp ưu tiên'
      },
      {
        name: 'part_active',
        label: 'Vật tư hoạt động',
        description: 'Hiển thị vật tư nội bộ còn hiệu lực'
      },
      {
        name: 'supplier_active',
        label: 'Nhà cung cấp hoạt động',
        description: 'Hiển thị nhà cung cấp còn hiệu lực'
      },
      {
        name: 'has_stock',
        label: 'Có tồn kho',
        description: 'Hiển thị mã hàng nhà cung cấp có tồn kho'
      }
    ];
  }, []);

  const editSupplierPartFields = useSupplierPartFields({});

  const [selectedSupplierPart, setSelectedSupplierPart] =
    useState<any>(undefined);

  const editSupplierPart = useEditApiFormModal({
    url: ApiEndpoints.supplier_part_list,
    pk: selectedSupplierPart?.pk,
    title: 'Sửa mã hàng nhà cung cấp',
    fields: useMemo(() => editSupplierPartFields, [editSupplierPartFields]),
    onFormSuccess: (response: any) => {
      table.refreshTable();
    }
  });

  const duplicateSupplierPart = useCreateApiFormModal({
    url: ApiEndpoints.supplier_part_list,
    title: 'Thêm mã hàng nhà cung cấp',
    fields: useMemo(() => editSupplierPartFields, [editSupplierPartFields]),
    initialData: {
      ...selectedSupplierPart,
      primary: false,
      active: true
    },
    onFormSuccess: (response: any) => {
      table.refreshTable();
    },
    successMessage: 'Đã tạo mã hàng nhà cung cấp'
  });

  const deleteSupplierPart = useDeleteApiFormModal({
    url: ApiEndpoints.supplier_part_list,
    pk: selectedSupplierPart?.pk,
    title: 'Xóa mã hàng nhà cung cấp',
    table: table
  });

  // Row action callback
  const rowActions = useCallback(
    (record: any): RowAction[] => {
      return [
        RowEditAction({
          hidden: !user.hasChangeRole(UserRoles.purchase_order),
          onClick: () => {
            setSelectedSupplierPart(record);
            editSupplierPart.open();
          }
        }),
        RowDuplicateAction({
          hidden: !user.hasAddRole(UserRoles.purchase_order),
          onClick: () => {
            setSelectedSupplierPart(record);
            duplicateSupplierPart.open();
          }
        }),
        RowDeleteAction({
          hidden: !user.hasDeleteRole(UserRoles.purchase_order),
          onClick: () => {
            setSelectedSupplierPart(record);
            deleteSupplierPart.open();
          }
        })
      ];
    },
    [user, editSupplierPartFields]
  );

  return (
    <>
      {addSupplierPart.modal}
      {editSupplierPart.modal}
      {duplicateSupplierPart.modal}
      {deleteSupplierPart.modal}
      {importPartWizard.wizard}
      <InvenTreeTable
        url={apiUrl(ApiEndpoints.supplier_part_list)}
        tableState={table}
        columns={tableColumns}
        props={{
          params: {
            manufacturer: manufacturerId,
            manufacturer_part: manufacturerPartId,
            supplier: supplierId,
            part: partId,
            part_detail: true,
            supplier_detail: true,
            manufacturer_detail: true,
            manufacturer_part_detail: true
          },
          rowActions: rowActions,
          enableDownload: true,
          tableActions: tableActions,
          tableFilters: tableFilters,
          modelType: ModelType.supplierpart
        }}
      />
    </>
  );
}
