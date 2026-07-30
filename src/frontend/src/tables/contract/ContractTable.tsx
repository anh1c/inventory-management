import { t } from '@lingui/core/macro';
import { ActionIcon, Anchor, Badge, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { IconCircleCheck, IconFileUpload, IconUpload, IconX } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AddItemButton } from '@lib/components/AddItemButton';
import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import { getDetailUrl, navigateToLink } from '@lib/functions/Navigation';
import useTable from '@lib/hooks/UseTable';
import { useContractFields, type ContractType } from '../../forms/ContractForms';
import { useApi } from '../../contexts/ApiContext';
import { formatCurrency } from '../../defaults/formatters';
import { useCreateApiFormModal } from '../../hooks/UseForm';
import { useUserState } from '../../states/UserState';
import {
  CreationDateColumn,
  DescriptionColumn,
  LinkColumn,
  ProjectCodeColumn,
  ReferenceColumn,
  UpdatedAtColumn
} from '../ColumnRenderers';
import { InvenTreeTable } from '../InvenTreeTable';

export function ContractTable({
  contractType,
  salesContract,
  salesContractId,
  buyerId,
  sellerId,
  onSelectContract,
  selectedContractId
}: Readonly<{
  contractType?: ContractType;
  salesContract?: any;
  salesContractId?: number;
  buyerId?: number;
  sellerId?: number;
  onSelectContract?: (record: any) => void;
  selectedContractId?: number;
}>) {
  const table = useTable(`contract-${contractType ?? 'all'}`);
  const user = useUserState();
  const navigate = useNavigate();
  const api = useApi();
  const [pendingDocuments, setPendingDocuments] = useState<File[]>([]);

  const contractFields = useContractFields({ contractType, salesContract });

  const uploadPendingDocuments = useCallback(
    async (contractId: number, files: File[]) => {
      await Promise.all(
        files.map(async (file) => {
          const formData = new FormData();
          formData.append('attachment', file);
          formData.append('model_type', ModelType.contract);
          formData.append('model_id', contractId.toString());

          await api.post(apiUrl(ApiEndpoints.attachment_list), formData, {
            timeout: 30 * 1000,
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        })
      );
    },
    [api]
  );

  const pendingDocumentUpload = useMemo(() => {
    if (!user.hasAddPermission(ModelType.contract)) {
      return undefined;
    }

    return (
      <Paper p='sm' radius='sm' shadow='xs'>
        <Stack gap='xs'>
          <Text fw={600}>{t`Contract Documents`}</Text>
          <Text size='sm' c='dimmed'>
            {t`Choose documents to upload after the contract is created successfully.`}
          </Text>
          <Dropzone
            multiple
            onDrop={(files) => {
              setPendingDocuments((current) => [...current, ...files]);
            }}
          >
            <Group justify='center' gap='sm' mih={72}>
              <Dropzone.Accept>
                <IconUpload color='var(--mantine-color-blue-6)' />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX color='var(--mantine-color-red-6)' />
              </Dropzone.Reject>
              <Dropzone.Idle>
                <IconFileUpload color='var(--mantine-color-dimmed)' />
              </Dropzone.Idle>
              <Text size='sm'>{t`Drag and drop or select contract files to upload`}</Text>
            </Group>
          </Dropzone>
          {pendingDocuments.length > 0 && (
            <Stack gap={4}>
              {pendingDocuments.map((file, index) => (
                <Group key={`${file.name}-${index}`} justify='space-between' gap='xs'>
                  <Text size='sm'>{file.name}</Text>
                  <Tooltip label={t`Remove from upload list`}>
                    <ActionIcon
                      variant='subtle'
                      color='red'
                      onClick={() => {
                        setPendingDocuments((current) =>
                          current.filter((_, fileIndex) => fileIndex !== index)
                        );
                      }}
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>
    );
  }, [pendingDocuments, user]);

  const newContract = useCreateApiFormModal({
    url: ApiEndpoints.contract_list,
    title: contractType === 'purchase' ? t`Add Purchase Contract` : t`Add Sales Contract`,
    fields: contractFields,
    initialData: {
      contract_type: contractType,
      sales_contract: salesContractId,
      buyer: buyerId,
      seller: sellerId
    },
    modelType: ModelType.contract,
    keepOpenOption: true,
    postFormContent: pendingDocumentUpload,
    onFormSuccess: (record: { pk?: number }) => {
      table.refreshTable();

      if (record.pk && pendingDocuments.length > 0) {
        const documents = [...pendingDocuments];

        void uploadPendingDocuments(record.pk, documents)
          .then(() => {
            notifications.show({
              title: t`Contract documents uploaded`,
              message: t`Uploaded ${documents.length} documents for this contract`,
              color: 'green',
              icon: <IconCircleCheck />
            });
            setPendingDocuments([]);
          })
          .catch(() => {
            notifications.show({
              title: t`Could not upload contract documents`,
              message: t`The contract was created but some documents could not be uploaded`,
              color: 'red',
              icon: <IconX />
            });
          });
      }
    }
  });

  const tableActions = useMemo(() => {
    return [
      <AddItemButton
        key='add-contract'
        tooltip={contractType === 'purchase' ? t`Add Purchase Contract` : t`Add Sales Contract`}
        onClick={() => newContract.open()}
        hidden={
          !user.hasAddRole(UserRoles.purchase_order) &&
          !user.hasAddRole(UserRoles.sales_order)
        }
      />
    ];
  }, [contractType, newContract, user]);

  const tableColumns = useMemo(() => {
    return [
      ReferenceColumn({
        render: (record: any) => {
          if (!record.pk) {
            return <Text size='sm'>{record.reference}</Text>;
          }

          const detailUrl = getDetailUrl(ModelType.contract, record.pk);

          return (
            <Anchor
              href={detailUrl}
              onClick={(event) => navigateToLink(detailUrl, navigate, event)}
            >
              {record.reference}
            </Anchor>
          );
        }
      }),
      {
        accessor: 'contract_type',
        title: t`Contract Type`,
        sortable: true,
        render: (record: any) => (
          <Badge color={record.contract_type === 'purchase' ? 'orange' : 'blue'}>
            {record.contract_type === 'purchase' ? t`Purchase Contract` : t`Sales Contract`}
          </Badge>
        )
      },
      DescriptionColumn({ accessor: 'title', title: t`Contract Name` }),
      ProjectCodeColumn({}),
      {
        accessor: 'buyer_detail.name',
        title: t`Buyer`,
        sortable: false,
        render: (record: any) => record.buyer_detail?.name ?? record.party_b_name ?? '-'
      },
      {
        accessor: 'seller_detail.name',
        title: t`Seller`,
        sortable: false,
        render: (record: any) => record.seller_detail?.name ?? record.party_a_name ?? '-'
      },
      {
        accessor: 'sales_order_count',
        title: t`Sales Orders`,
        sortable: true
      },
      {
        accessor: 'purchase_order_count',
        title: t`Purchase Orders`,
        sortable: true
      },
      {
        accessor: 'purchase_contract_count',
        title: t`Linked Purchase Contracts`,
        sortable: true,
        defaultVisible: contractType !== 'purchase'
      },
      {
        accessor: 'issue_date',
        title: t`Issue Date`,
        sortable: true
      },
      {
        accessor: 'grand_total',
        title: t`Total Value`,
        sortable: true,
        render: (record: any) => formatCurrency(record.grand_total, { currency: 'VND' })
      },
      CreationDateColumn({ defaultVisible: false }),
      UpdatedAtColumn({ defaultVisible: false }),
      LinkColumn({ defaultVisible: false })
    ];
  }, [contractType, navigate]);

  return (
    <>
      {newContract.modal}
      <InvenTreeTable
        url={apiUrl(ApiEndpoints.contract_list)}
        tableState={table}
        columns={tableColumns}
        props={{
          params: {
            contract_type: contractType,
            sales_contract: salesContractId,
            buyer: buyerId,
            seller: sellerId,
            project_code_detail: true,
            sales_contract_detail: true,
            buyer_detail: true,
            seller_detail: true,
            party_a_contact_detail: true,
            party_b_contact_detail: true
          },
          tableActions,
          defaultSortColumn: 'reference',
          onRowClick: (record: any) => onSelectContract?.(record),
          rowStyle: (record: any) =>
            record.pk === selectedContractId ? { backgroundColor: 'var(--mantine-color-blue-light)' } : undefined
        }}
      />
    </>
  );
}
