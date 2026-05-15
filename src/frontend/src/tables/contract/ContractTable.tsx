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
  onSelectContract,
  selectedContractId
}: Readonly<{
  contractType?: ContractType;
  salesContract?: any;
  salesContractId?: number;
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
          <Text fw={600}>{t`Tài liệu hợp đồng`}</Text>
          <Text size='sm' c='dimmed'>
            {t`Chọn tài liệu để upload sau khi hợp đồng được tạo thành công.`}
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
              <Text size='sm'>{t`Kéo thả hoặc chọn file hợp đồng để upload`}</Text>
            </Group>
          </Dropzone>
          {pendingDocuments.length > 0 && (
            <Stack gap={4}>
              {pendingDocuments.map((file, index) => (
                <Group key={`${file.name}-${index}`} justify='space-between' gap='xs'>
                  <Text size='sm'>{file.name}</Text>
                  <Tooltip label={t`Xóa khỏi danh sách upload`}>
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
    title: contractType === 'purchase' ? t`Thêm hợp đồng mua` : t`Thêm hợp đồng bán`,
    fields: contractFields,
    initialData: {
      contract_type: contractType,
      sales_contract: salesContractId
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
              title: t`Tài liệu hợp đồng đã được upload`,
              message: t`Đã upload ${documents.length} tài liệu cho hợp đồng`,
              color: 'green',
              icon: <IconCircleCheck />
            });
            setPendingDocuments([]);
          })
          .catch(() => {
            notifications.show({
              title: t`Không thể upload tài liệu hợp đồng`,
              message: t`Hợp đồng đã được tạo nhưng một số tài liệu chưa upload thành công`,
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
        tooltip={contractType === 'purchase' ? t`Thêm hợp đồng mua` : t`Thêm hợp đồng bán`}
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
        title: t`Loại hợp đồng`,
        sortable: true,
        render: (record: any) => (
          <Badge color={record.contract_type === 'purchase' ? 'orange' : 'blue'}>
            {record.contract_type === 'purchase' ? t`Hợp đồng mua` : t`Hợp đồng bán`}
          </Badge>
        )
      },
      DescriptionColumn({ accessor: 'title', title: t`Tiêu đề` }),
      ProjectCodeColumn({}),
      {
        accessor: 'sales_order_count',
        title: t`Đơn bán`,
        sortable: true
      },
      {
        accessor: 'purchase_order_count',
        title: t`Đơn mua`,
        sortable: true
      },
      {
        accessor: 'purchase_contract_count',
        title: t`Hợp đồng mua liên kết`,
        sortable: true,
        defaultVisible: contractType !== 'purchase'
      },
      {
        accessor: 'issue_date',
        title: t`Ngày ký`,
        sortable: true
      },
      {
        accessor: 'grand_total',
        title: t`Tổng giá trị`,
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
            project_code_detail: true,
            sales_contract_detail: true
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
