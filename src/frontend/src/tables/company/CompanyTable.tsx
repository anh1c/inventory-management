import { Text } from '@mantine/core';
import { t } from '@lingui/core/macro';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AddItemButton } from '@lib/components/AddItemButton';
import { type RowAction, RowEditAction } from '@lib/components/RowActions';
import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import { navigateToLink } from '@lib/functions/Navigation';
import useTable from '@lib/hooks/UseTable';
import type { TableFilter } from '@lib/types/Filters';
import { companyFields, internalCompanyFields } from '../../forms/CompanyForms';
import {
  useCreateApiFormModal,
  useEditApiFormModal
} from '../../hooks/UseForm';
import { useUserState } from '../../states/UserState';
import {
  BooleanColumn,
  CompanyColumn,
  DescriptionColumn
} from '../ColumnRenderers';
import { InvenTreeTable } from '../InvenTreeTable';

/**
 * A table which displays a list of company records,
 * based on the provided filter parameters
 */
export function CompanyTable({
  companyType,
  params,
  path,
  initialData,
  showInternalColumns = false
}: Readonly<{
  companyType?: string;
  params?: any;
  path?: string;
  initialData?: any;
  showInternalColumns?: boolean;
}>) {
  const table = useTable(`company-${companyType ?? 'index'}`, {
    initialFilters: [
      {
        name: 'active',
        value: 'true'
      }
    ]
  });

  const navigate = useNavigate();
  const user = useUserState();

  const columns = useMemo(() => {
    const companyColumns: any[] = [
      {
        accessor: 'name',
        title: showInternalColumns ? t`Internal Company` : t`Company`,
        sortable: true,
        switchable: false,
        render: (record: any) => {
          return <CompanyColumn company={record} />;
        }
      },
      DescriptionColumn({}),
      BooleanColumn({
        accessor: 'active',
        title: t`Active`,
        sortable: true,
        switchable: true
      }),
      {
        accessor: 'website',
        sortable: false
      }
    ];

    if (showInternalColumns) {
      companyColumns.push(
        {
          accessor: 'representative',
          title: t`Representative`,
          sortable: true,
          switchable: true,
          copyable: true,
          render: (record: any) => record.representative || '-'
        },
        {
          accessor: 'representative_position',
          title: t`Position`,
          sortable: true,
          switchable: true,
          copyable: true,
          render: (record: any) => record.representative_position || '-'
        },
        BooleanColumn({
          accessor: 'is_internal',
          title: t`Internal`,
          sortable: true,
          switchable: true
        }),
        {
          accessor: 'parent_company',
          title: t`Parent Company`,
          sortable: true,
          switchable: true,
          render: (record: any) => {
            if (record.parent_company_detail?.name) {
              return <CompanyColumn company={record.parent_company_detail} />;
            }

            if (record.parent_company) {
              return <Text size='sm'>#{record.parent_company}</Text>;
            }

            return '-';
          }
        }
      );
    }

    return companyColumns;
  }, [showInternalColumns]);

  const newCompany = useCreateApiFormModal({
    url: ApiEndpoints.company_list,
    title: showInternalColumns ? t`Add Internal Company` : t`Add Company`,
    fields: showInternalColumns ? internalCompanyFields() : companyFields(),
    initialData: initialData ?? params,
    follow: true,
    modelType: ModelType.company,
    keepOpenOption: true
  });

  const [selectedCompany, setSelectedCompany] = useState<number>(0);

  const editCompany = useEditApiFormModal({
    url: ApiEndpoints.company_list,
    pk: selectedCompany,
    title: showInternalColumns ? t`Edit Internal Company` : t`Edit Company`,
    fields: showInternalColumns ? internalCompanyFields() : companyFields(),
    onFormSuccess: (record: any) => table.updateRecord(record)
  });

  const tableFilters: TableFilter[] = useMemo(() => {
    return [
      {
        name: 'active',
        label: t`Active`,
        description: t`Show active companies`
      },
      {
        name: 'is_supplier',
        label: t`Supplier`,
        description: t`Show companies which are suppliers`
      },
      {
        name: 'is_manufacturer',
        label: t`Manufacturer`,
        description: t`Show companies which are manufacturers`
      },
      {
        name: 'is_customer',
        label: t`Customer`,
        description: t`Show companies which are customers`
      }
    ];
  }, []);

  const tableActions = useMemo(() => {
    const can_add =
      user.hasAddRole(UserRoles.purchase_order) ||
      user.hasAddRole(UserRoles.sales_order);

    return [
      <AddItemButton
        key='add-company'
        tooltip={
          showInternalColumns ? t`Add Internal Company` : t`Add Company`
        }
        onClick={() => newCompany.open()}
        hidden={!can_add}
      />
    ];
  }, [user]);

  const rowActions = useCallback(
    (record: any): RowAction[] => {
      return [
        RowEditAction({
          hidden:
            !user.hasChangeRole(UserRoles.purchase_order) &&
            !user.hasChangeRole(UserRoles.sales_order),
          onClick: () => {
            setSelectedCompany(record.pk);
            editCompany.open();
          }
        })
      ];
    },
    [user]
  );

  return (
    <>
      {newCompany.modal}
      {editCompany.modal}
      <InvenTreeTable
        url={apiUrl(ApiEndpoints.company_list)}
        tableState={table}
        columns={columns}
        props={{
          params: {
            ...params
          },
          onRowClick: (record: any, index: number, event: any) => {
            if (record.pk) {
              const base = path ?? 'company';
              navigateToLink(`/${base}/${record.pk}`, navigate, event);
            }
          },
          modelType: ModelType.company,
          tableFilters: tableFilters,
          tableActions: tableActions,
          enableDownload: true,
          enableSelection: true,
          enableReports: true,
          rowActions: rowActions
        }}
      />
    </>
  );
}
